const CCapture = require('ccapture.js')
const OrbitControls = require('three-orbit-controls')(THREE)
const Vehicle = require('./Vehicle')
const Path = require('./Path')

class App {
  constructor (opt) {
    this.lastTime = 0 // time of the last animation frame

    this.animate = true

    // Set defaults
    this.options = {
      vehicles: 1
    }
    Object.assign(this.options, opt || {})

    window.addEventListener('resize', this.onResize.bind(this), false)
    this.onResize() // get viewport size
  }

  /**
   * THREE scene, renderer, camera, shader material and particles mesh.
   */
  init3dScene () {
    // Scene
    this.scene = new THREE.Scene()

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    })
    this.renderer.setClearColor(0xCCCCCC, 1)
    this.renderer.setSize(this.width, this.height)
    document.body.appendChild(this.renderer.domElement)

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.01, 10000)
    this.camera.position.z = 80
    this.camera.position.y = 20

    // Camera controls
    this.controls = new OrbitControls(this.camera, document.body)

    // Create path
    this.pathMaxWidth = 100
    this.pathMaxHeight = 20
    this.pathMaxDepth = 20
    this.path = new Path(this.scene, this.pathMaxWidth, this.pathMaxHeight, this.pathMaxDepth)
    this.path.draw()

    // // Create vehicle
    this.vehicles = []
    for (let i = 0; i < this.options.vehicles; i++) {
      const maxspeed = 0.2 + Math.random() * 0.3
      const maxforce = Math.random() * 0.01
      const position = new THREE.Vector3()
      position.x = this.path.start.x
      position.y = this.path.start.y * Math.random()
      position.z = this.path.start.z * Math.random()
      this.vehicles[i] = new Vehicle(this.scene, position, maxspeed, maxforce, this.path)
      // console.log(this.vehicles[i])
    }

    // 3d grid
    const grid = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(40, 40, 10, 10),
      new THREE.MeshBasicMaterial({wireframe: true, color: '#CCCCCC', transparent: true, opacity: 0.2})
    )
    grid.rotation.x = 90 * Math.PI / 180
    this.scene.add(grid)

    // Boundaries
    // const box = new THREE.Mesh(
    //   new THREE.BoxGeometry(boundsSize, boundsSize, boundsSize),
    //   new THREE.MeshBasicMaterial({wireframe: true, color: '#00FFFF', transparent: true, opacity: 0.5})
    // )
    // this.scene.add(box)
  }

  update () {
    window.requestAnimationFrame(this.update.bind(this))

    this.stats.begin()
    const now = window.performance.now()
    let delta = (now - this.lastTime) / 1000
    if (delta > 1) delta = 1 // safety cap on large deltas
    this.lastTime = now
    this.render(now, delta)
    this.stats.end()
  }

  render (now, delta) {
    this.vehicles.forEach((v) => {
      if (this.animate) {
        v.follow(this.path)
        v.update()
      }
      v.draw()
    })

    // Render the scene on the screen
    this.renderer.render(this.scene, this.camera)

    // Capture images
    if (this.capture) {
      this.capturer.capture(this.renderer.domElement)
    }
  }

  initStats () {
    this.stats = new window.Stats()
    this.stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    this.stats.dom.id = 'stats'
    document.getElementById('ui').appendChild(this.stats.dom)
  }

  initEvents () {
    document.body.addEventListener('keyup', (e) => {
      if (e.key === 'a' || e.key === 'A') {
        this.animate = !this.animate
      }

      // Restart vehicles from center
      if (e.key === 'r' || e.key === 'R') {
        for (let i = 0, il = this.vehicles.length; i < il; i++) {
          this.vehicles[i].position.copy(this.vehicles[i].startPosition)
          if (this.vehicles[i].trail) {
            this.vehicles[i].resetTrail()
          }
        }
      }
    })
  }

  initUI () {
    document.body.classList.remove('show-loader')
    document.body.classList.add('show-ui-btn')

    document.getElementById('ui-btn').addEventListener('click', (e) => {
      document.body.classList.toggle('show-ui')
    })

    this.initStats()
  }

  initCapture () {
    this.capture = false
    this.capturer = new CCapture({
      format: 'webm'
      // format: 'png'
    })

    const btn = document.getElementById('captureBtn')

    btn.addEventListener('click', () => {
      this.capture = !this.capture
      if (this.capture) {
        btn.classList.remove('off')
        btn.classList.add('on')
        this.capturer.start()
      } else {
        btn.classList.remove('on')
        btn.classList.add('off')
        this.capturer.stop()
        this.capturer.save()
      }
    })
  }

  onResize () {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.halfWidth = this.width / 2
    this.halfHeight = this.height / 2

    if (this.camera) {
      this.camera.aspect = this.width / this.height
      this.camera.updateProjectionMatrix()
    }

    if (this.renderer) {
      this.renderer.setSize(this.width, this.height)
    }
  }

  start () {
    this.init3dScene()
    this.initUI()
    this.initEvents()
    this.initCapture()
    this.update()
  }
}

const app = new App({
  vehicles: 1
})
app.start()

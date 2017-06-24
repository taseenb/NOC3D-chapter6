const CCapture = require('ccapture.js')
const OrbitControls = require('three-orbit-controls')(THREE)
const Vehicle = require('./Vehicle')

class App {
  constructor (opt) {
    this.lastTime = 0 // time of the last animation frame

    this.animate = true
    this.modes = ['align', 'separate']
    this.currentMode = 0

    // Set defaults
    this.options = {
      vehicles: 10
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

    // Boundaries
    this.bounds = new THREE.Vector3(80, 60, 60)
    this.boundingBox = new THREE.Mesh(
      new THREE.BoxGeometry(this.bounds.x, this.bounds.y, this.bounds.z),
      new THREE.MeshBasicMaterial({wireframe: true, color: '#00FFFF', transparent: true, opacity: 0.5})
    )
    this.scene.add(this.boundingBox)

    // // Create vehicle
    this.vehicles = []
    for (let i = 0; i < this.options.vehicles; i++) {
      const maxspeed = 0.2 // Math.random() * 0.1
      const maxforce = 0.005 // Math.random() * 0.005
      const position = new THREE.Vector3()
      position.x = this.bounds.x * Math.random() - this.bounds.x / 2
      position.y = this.bounds.y * Math.random() - this.bounds.y / 2
      position.z = this.bounds.z * Math.random() - this.bounds.z / 2
      this.vehicles[i] = new Vehicle(i, this.scene, position, maxspeed, maxforce, this.bounds)
    }

    // 3d grid
    this.grid = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(40, 40, 10, 10),
      new THREE.MeshBasicMaterial({wireframe: true, color: '#69aedb', transparent: false, opacity: 0.2})
    )
    this.grid.rotation.x = 90 * Math.PI / 180
    this.scene.add(this.grid)
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
    this.vehicles.forEach((v, i) => {
      if (this.animate) {
        if (this.modes[this.currentMode] === 'align') {
          v.align(this.vehicles, i)
        } else if (this.modes[this.currentMode] === 'separate') {
          v.separate(this.vehicles, i)
        }
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
      // Restart vehicles from center
      if (e.key === 'r' || e.key === 'R') {
        for (let i = 0, il = this.vehicles.length; i < il; i++) {
          this.vehicles[i].position.copy(this.vehicles[i].startPosition)
          if (this.vehicles[i].trail) {
            this.vehicles[i].resetTrail()
          }
        }
      }

      if (e.key === 'g' || e.key === 'G') {
        this.grid.visible = !this.grid.visible
      }

      if (e.key === 'b' || e.key === 'B') {
        this.boundingBox.visible = !this.boundingBox.visible
      }

      if (e.key === 'a' || e.key === 'A') {
        this.animate = !this.animate
      }

      // Cycle through modes
      if (e.key === 'm' || e.key === 'M') {
        this.currentMode = (this.currentMode + 1) % this.modes.length
        console.log(this.modes[this.currentMode])
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
      // format: 'webm'
      format: 'png'
      // format: 'gif', workersPath: 'js/vendor/gif.js/'
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

    this.update() // start loop animation

    // for (let i = 0; i < 1; i++) {
    //   this.render() // only render n times
    // }
  }
}

const app = new App({
  vehicles: 300
})
app.start()

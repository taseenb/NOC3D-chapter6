const CCapture = require('ccapture.js')
const OrbitControls = require('three-orbit-controls')(THREE)
const Boid = require('./Boid')
const Path = require('./Path')
const qs = require('qs')

const qsValue = qs.parse(window.location.search.replace('?', ''))
// console.log(parseInt(qsValue['no-ui']))

class App {
  constructor (opt) {
    this.lastTime = 0 // time of the last animation frame

    this.useDolly = false
    this.animate = true

    // Set defaults
    this.options = {
      boids: 10
    }
    Object.assign(this.options, opt || {})

    window.addEventListener('resize', this.onResize.bind(this), false)
    this.onResize() // get viewport size
  }

  /**
   * THREE scene, renderer, camera, shader material and particles mesh.
   */
  init3dScene () {
    // Show UI button?
    this.showUI = parseInt(qsValue['no-ui']) !== 1
    this.useDolly = parseInt(qsValue['use-dolly']) === 1
    if (!this.showUI) {
      document.getElementById('ui-btn').style.display = 'none'
    }
    console.log(this.showUI, this.useDolly)

    // Scene
    this.scene = new THREE.Scene()

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    })
    this.renderer.setClearColor(0xcccccc, 1)
    this.renderer.setSize(this.width, this.height)
    document.body.appendChild(this.renderer.domElement)

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.width / this.height,
      0.01,
      10000
    )
    this.camera.position.z = 80
    this.camera.position.y = 20

    // Dolly camera
    this.dolly = new THREE.PerspectiveCamera(
      60,
      this.width / this.height,
      0.01,
      10000
    )
    this.dolly.rotation.y = 90 * Math.PI / 180

    // Camera controls
    this.controls = new OrbitControls(this.camera, document.body)

    // Create path
    this.pathMaxWidth = 100
    this.pathMaxHeight = 20
    this.pathMaxDepth = 30
    this.pointsCount = 6
    const radius = 2
    this.path = new Path(
      this.scene,
      this.pointsCount,
      this.pathMaxWidth,
      this.pathMaxHeight,
      this.pathMaxDepth,
      radius
    )

    // // Create vehicle
    this.boids = []
    for (let i = 0; i < this.options.boids; i++) {
      const maxspeed = 0.2 + Math.random() * 0.1
      const maxforce = 0.005
      const position = new THREE.Vector3()
      position.x = this.path.points[0].x
      position.y = this.path.points[0].y * Math.random()
      position.z = this.path.points[0].z * Math.random()
      this.boids.push(
        new Boid(i, this.scene, position, maxspeed, maxforce, this.path)
      )
      // console.log(i, this.vehicles[i])
      // console.log(maxspeed, maxforce)
    }

    // 3d grid
    this.grid = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(40, 40, 10, 10),
      new THREE.MeshBasicMaterial({
        wireframe: true,
        color: '#999999',
        transparent: true,
        opacity: 0.2
      })
    )
    this.grid.visible = false
    this.grid.rotation.x = 90 * Math.PI / 180
    this.scene.add(this.grid)

    // Boundaries
    // const box = new THREE.Mesh(
    //   new THREE.BoxGeometry(this.pathMaxWidth, this.pathMaxHeight, this.pathMaxDepth),
    //   new THREE.MeshBasicMaterial({wireframe: true, color: '#00FFFF', transparent: true, opacity: 0.5})
    // )
    // box.position.y = this.pathMaxHeight / 2
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
    this.boids.forEach(v => {
      if (this.animate) {
        v.follow(this.path)
        v.update()
      }
      v.draw()
    })

    if (this.useDolly) {
      const v = this.boids[this.options.boids - 1]
      this.dolly.position.set(
        v.position.x - 20,
        v.position.y,
        v.position.z + 10
      )
      this.dolly.lookAt(v.position)
    }

    // Render the scene on the screen
    if (this.useDolly) {
      this.renderer.render(this.scene, this.dolly)
    } else {
      this.renderer.render(this.scene, this.camera)
    }

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
    document.body.addEventListener('keyup', e => {
      // Restart vehicles from starting position
      if (e.key === 'r' || e.key === 'R') {
        for (let i = 0, il = this.boids.length; i < il; i++) {
          this.boids[i].position.copy(this.boids[i].startPosition)
          if (this.boids[i].trail) {
            this.boids[i].resetTrail()
          }
        }
      }

      if (e.key === 'g' || e.key === 'G') {
        this.grid.visible = !this.grid.visible
      }

      if (e.key === 'a' || e.key === 'A') {
        this.animate = !this.animate
      }

      if (e.key === 'p' || e.key === 'P') {
        this.path.createPoints()
        this.path.update()
      }

      if (e.key === 'c' || e.key === 'C') {
        this.useDolly = !this.useDolly
      }
    })
  }

  initUI () {
    document.body.classList.remove('show-loader')
    document.body.classList.add('show-ui-btn')

    document.getElementById('ui-btn').addEventListener('click', e => {
      document.body.classList.toggle('show-ui')
    })

    this.initStats()
  }

  initCapture () {
    this.capture = false
    this.capturer = new CCapture({
      // format: 'webm'
      format: 'png'
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
  boids: 100
})
app.start()

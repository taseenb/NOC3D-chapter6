
const OrbitControls = require('three-orbit-controls')(THREE)
const Vehicle = require('./Vehicle')
const Flowfield = require('./Flowfield')

class App {
  constructor (opt) {
    this.lastTime = 0 // time of the last animation frame

    this.animate = true

    // Set defaults
    this.options = {
      fieldWidth: 50,
      fieldHeight: 50,
      fieldDepth: 50,
      resolution: 10,
      vehicles: 5
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
    this.camera.position.z = 50
    this.camera.position.y = 10
    this.camera.lookAt(this.scene)

    // Camera controls
    this.controls = new OrbitControls(this.camera, document.body)

    // Create flow field
    const bounds = {
      x: this.options.fieldWidth,
      y: this.options.fieldHeight,
      z: this.options.fieldDepth
    }
    const resolution = this.options.resolution // fieldWidth / resolution must give results without decimals!
    this.drawField = false
    this.flowfield = new Flowfield(this.scene, bounds, resolution, this.drawField)

    // Create vehicle
    this.vehicles = []
    for (let i = 0; i < this.options.vehicles; i++) {
      const position = new THREE.Vector3(
        -(bounds.x / 2) + Math.random() * bounds.x,
        -(bounds.y / 2) + Math.random() * bounds.y,
        -(bounds.z / 2) + Math.random() * bounds.z
      )
      this.vehicles[i] = new Vehicle(this.scene, position, 0.2 + Math.random() * 0.3, Math.random() * 0.002, bounds)
    }
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
        v.follow(this.flowfield)
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

      // Create a new flow field
      if (e.key === 'f' || e.key === 'F') {
        if (this.flowfield) this.flowfield.init(this.drawField)
      }

      // Restart vehicles from center
      if (e.key === 'r' || e.key === 'R') {
        for (let i = 0, il = this.vehicles.length; i < il; i++) {
          this.vehicles[i].reset()
          this.vehicles[i].resetTrail()
        }
      }

      // Show/hide vectors in the vector field
      if (e.key === 'h' || e.key === 'H') {
        this.flowfield.toggleVectorsVisibility()
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

  start () {
    this.init3dScene()
    this.initUI()
    this.initEvents()
    this.initCapture()
    this.update()
  }
}

const app = new App({
  fieldWidth: 40,
  fieldHeight: 40,
  fieldDepth: 40,
  resolution: 5,
  vehicles: 200
})
app.start()

const CCapture = require('ccapture.js')
const OrbitControls = require('three-orbit-controls')(THREE)
const Vehicle = require('./Vehicle')

class App {
  constructor (opt) {
    this.lastTime = 0 // time of the last animation frame

    // Set defaults
    this.options = {}
    Object.assign(this.options, opt || {})

    // Debug helper
    this.debug = document.getElementById('debug')
    this.debug.style.display = 'none'

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
    this.camera.position.y = 20

    // Camera controls
    this.controls = new OrbitControls(this.camera, document.body)

    // Create vehicle
    this.vehicle = new Vehicle(this.scene, new THREE.Vector2(), 0.3, 0.004)

    // 3d grid
    this.grid = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(40, 40, 10, 10),
      new THREE.MeshBasicMaterial({wireframe: true, color: '#69aedb', transparent: false, opacity: 0.2})
    )
    this.grid.rotation.x = 90 * Math.PI / 180
    this.scene.add(this.grid)
  }

  /**
   * A way to get a 3d point from a 2d coordinate on the screen (mouse position).
   */
  initRaycaster () {
    this.raycaster = new THREE.Raycaster()
    this.intersection = new THREE.Vector3() // the point where the intersection occurs

    // Visual helper to see the intersection with the invisible plane
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: false
    })
    this.targetHelper = new THREE.Mesh(geometry, material)
    this.scene.add(this.targetHelper)

    // Create an invisible plane that will always be perpendicular to the camera (to get an intersection point)
    this.cameraPlane = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(this.width, this.height, 1, 1),
      new THREE.MeshBasicMaterial({transparent: true, opacity: 0})
    )
    // this.cameraPlane.visible = false
    this.scene.add(this.cameraPlane)

    // Update the plane position, so it always faces the camera
    this.controls.addEventListener('change', (e) => {
      // console.log(e.target)
      this.cameraPlane.lookAt(this.camera.position)
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
    // this.debug.innerHTML = `
    //   position: ${this.vehicle.position.x}, ${this.vehicle.position.y}<br>
    //   velocity: ${this.vehicle.velocity.x}, ${this.vehicle.velocity.y}<br>
    //   acceleration: ${this.vehicle.acceleration.x}, ${this.vehicle.acceleration.y}<br>
    //   desired: ${this.vehicle.desired.x}, ${this.vehicle.desired.y}<br>
    //   steer: ${this.vehicle.steer.x}, ${this.vehicle.steer.y}<br>
    //   pointer: ${this.pointer.x}, ${this.pointer.y}<br>
    // `

    // Raycaster
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersections = this.raycaster.intersectObject(this.cameraPlane)
    if (intersections && intersections[0]) {
      this.intersection = intersections[0].point
      this.targetHelper.position.copy(this.intersection)
    }

    this.vehicle.seek(this.intersection)
    this.vehicle.update()
    this.vehicle.draw()

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

  initUI () {
    document.body.classList.remove('show-loader')
    document.body.classList.add('show-ui-btn')

    document.getElementById('ui-btn').addEventListener('click', (e) => {
      document.body.classList.toggle('show-ui')
    })

    this.initStats()
  }

  initPointerEvents () {
    this.pointer = new THREE.Vector3()
    document.body.addEventListener('mousemove', (e) => {
      const x = (e.clientX / this.width) * 2 - 1
      const y = -(e.clientY / this.height) * 2 + 1
      this.pointer.set(x, y, 0)
    })
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
    this.initRaycaster()
    this.initPointerEvents()
    this.initUI()
    this.initCapture()
    this.update()
  }
}

const app = new App({})
app.start()

const Palette = require('./Palette')

class Vehicle {
  constructor (scene, position, maxspeed, maxforce, bounds) {
    this.scene = scene
    this.startPosition = position.clone()
    this.position = position
    this.maxspeed = maxspeed
    this.maxforce = maxforce
    this.bounds = bounds

    this.velocity = new THREE.Vector3()
    this.acceleration = new THREE.Vector3()
    this.steer = new THREE.Vector3()

    // Colors
    this.palette = new Palette()
    this.color = this.palette.getRandomColor()
    this.lineMaterial = new THREE.LineBasicMaterial({color: this.color, transparent: false})

    // Trail
    this.initTrail()

    // Container box (boundaries)
    this.boundsWidth = bounds.fieldWidth
    this.boundsHeight = bounds.fieldHeight
    this.boundsDepth = bounds.fieldDepth

    // Vehicle mesh
    this.mesh = this.createMesh(0.6, 1)
    this.scene.add(this.mesh)
  }

  initTrail () {
    this.trail = true

    this.positionsCount = 50
    this.oldPositions = []
    for (let i = 0; i < this.positionsCount; i++) {
      this.oldPositions[i] = this.position.clone()
    }

    const geometry = new THREE.Geometry()
    geometry.vertices = this.oldPositions
    this.trailLine = new THREE.Line(geometry, this.lineMaterial)
    this.trailLine.frustumCulled = false

    this.scene.add(this.trailLine)

    // Press T to show/hide trail
    document.body.addEventListener('keyup', (e) => {
      if (e.key === 't' || e.key === 'T') {
        this.trail = !this.trail
        if (this.trail) {
          this.resetTrail()
        }
      }

      this.trailLine.visible = this.trail
    })
  }

  updateTrail () {
    this.trailLine.geometry.vertices.push(this.position.clone())
    this.trailLine.geometry.vertices.shift()
    this.trailLine.geometry.verticesNeedUpdate = true
  }

  resetTrail () {
    for (let i = 0; i < this.positionsCount; i++) {
      this.oldPositions[i].copy(this.position)
    }
  }

  /**
   * Create an extruded triangle to represent the vehicle
   * @returns {Mesh}
   */
  createMesh (_width, _length) {
    const width = _width || 1
    const length = _length || 2
    const shape = new THREE.Shape()
    shape.moveTo(0, width / 2)
    shape.lineTo(length, 0)
    shape.lineTo(0, -width / 2)
    shape.lineTo(0, width / 2)

    const extrudeSettings = {
      steps: 1,
      amount: 0.1,
      bevelEnabled: false
    }

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    const material = new THREE.MeshBasicMaterial({color: this.color})
    return new THREE.Mesh(geometry, material)
  }

  reset () {
    this.position = this.startPosition.clone()
  }

  update () {
    this.velocity.add(this.acceleration)
    this.velocity.clampScalar(-this.maxspeed, this.maxspeed)
    this.position.add(this.velocity)
    this.acceleration.multiplyScalar(0)

    if (this.trail) {
      this.updateTrail()
    }

    this.checkBoundaries()
  }

  checkBoundaries () {
    let reset = false
    const halfX = this.bounds.x / 2
    const halfY = this.bounds.y / 2
    const halfZ = this.bounds.z / 2

    if (this.position.x > halfX) {
      this.position.x = -halfX
      reset = true
    } else if (this.position.y > halfY) {
      this.position.y = -halfY
      reset = true
    } else if (this.position.z > halfZ) {
      this.position.z = -halfZ
      reset = true
    } else if (this.position.x < -halfX) {
      this.position.x = halfX
      reset = true
    } else if (this.position.y < -halfY) {
      this.position.y = halfY
      reset = true
    } else if (this.position.z < -halfZ) {
      this.position.z = halfZ
      reset = true
    }

    if (reset && this.trail) this.resetTrail()
  }

  applyForce (force) {
    this.acceleration.add(force)
  }

  follow (flow) {
    let desired
    let maxforce = this.maxforce
    let maxspeed = this.maxspeed

    desired = flow.lookup(this.position)
    desired.normalize()
    desired.multiplyScalar(maxspeed)

    // Steering = Desired minus velocity
    this.steer.subVectors(desired, this.velocity)
    this.steer.clampScalar(-maxforce, maxforce)

    // Apply the steering force to the acceleration
    this.applyForce(this.steer)
  }

  draw () {
    this.mesh.position.copy(this.position)

    /**
     * Calculate rotation (not sure this is the best way but works)
     * Copied from: https://github.com/mrdoob/three.js/blob/master/examples/canvas_geometry_birds.html
     */
    this.mesh.rotation.y = Math.atan2(-this.velocity.z, this.velocity.x)
    this.mesh.rotation.z = Math.asin(this.velocity.y / this.velocity.length())
  }
}

module.exports = Vehicle

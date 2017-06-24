const Palette = require('./Palette')

class Vehicle {
  constructor (scene, position, maxspeed, maxforce, boxSize) {
    this.scene = scene
    this.position = new THREE.Vector3(position.x, position.y, 0)
    this.maxspeed = maxspeed
    this.maxforce = maxforce

    this.velocity = new THREE.Vector3()
    const vx = 0.3 + Math.random() * maxspeed
    const vy = 0.3 + Math.random() * maxspeed
    const vz = 0.3 + Math.random() * maxspeed
    this.velocity.x = -vx / 2 + vx
    this.velocity.y = -vy / 2 + vy
    this.velocity.z = -vz / 2 + vz

    this.acceleration = new THREE.Vector3()
    this.steer = new THREE.Vector3()

    // Container box (boundaries)
    this.boxSize = boxSize

    // Colors
    this.palette = new Palette()
    this.color = this.palette.getRandomColor()
    this.lineMaterial = new THREE.LineBasicMaterial({color: this.color, transparent: false})

    // Trail
    this.initTrail()

    // Vehicle mesh
    this.mesh = this.createMesh(0.6, 1)
    this.scene.add(this.mesh)
  }

  initTrail () {
    this.trail = true

    this.positionsCount = 400
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

  update () {
    this.velocity.add(this.acceleration)
    this.velocity.clampScalar(-this.maxspeed, this.maxspeed)
    this.position.add(this.velocity)
    this.acceleration.multiplyScalar(0)

    if (this.trail) {
      this.updateTrail()
    }
  }

  applyForce (force) {
    this.acceleration.add(force)
  }

  /**
   * Move the vehicle only within the walls of the box
   * (actually just move it back when it's already outside of the boundaries, in this case)
   */
  boundaries () {
    let desired = null
    const halfBox = this.boxSize / 2
    const x = this.velocity.x
    const y = this.velocity.y
    const z = this.velocity.z
    const ms = this.maxspeed

    if (this.position.x < -halfBox) {
      desired = new THREE.Vector3(ms, y, z)
    } else if (this.position.x > halfBox) {
      desired = new THREE.Vector3(-ms, y, z)
    }

    if (this.position.y < -halfBox) {
      desired = new THREE.Vector3(x, ms, z)
    } else if (this.position.y > halfBox) {
      desired = new THREE.Vector3(x, -ms, z)
    }

    if (this.position.z < -halfBox) {
      desired = new THREE.Vector3(x, y, ms)
    } else if (this.position.z > halfBox) {
      desired = new THREE.Vector3(x, y, -ms)
    }

    if (desired !== null) {
      desired.normalize()
      desired.multiplyScalar(this.maxspeed)

      // Steering = Desired minus velocity
      this.steer.subVectors(desired, this.velocity)
      this.steer.clampScalar(-this.maxforce, this.maxforce)

      // Apply the steering force to the acceleration
      this.applyForce(this.steer)
    }
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

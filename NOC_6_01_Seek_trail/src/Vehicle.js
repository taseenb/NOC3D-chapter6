const Palette = require('./Palette')

class Vehicle {
  constructor (scene, position, maxspeed, maxforce) {
    this.position = new THREE.Vector3(position.x, position.y, 0)
    this.maxspeed = maxspeed
    this.maxforce = maxforce
    this.velocity = new THREE.Vector3(this.maxspeed, 0, 0)
    this.acceleration = new THREE.Vector3()
    this.desired = new THREE.Vector3()
    this.steer = new THREE.Vector3()

    // Colors
    this.palette = new Palette()
    this.color = this.palette.getRandomColor()

    // Trail
    this.positionsCount = 50
    this.oldPositions = []
    this.trail = this.createTrail()
    scene.add(this.trail)

    // Vehicle mesh
    this.mesh = this.createMesh(1, 2)
    scene.add(this.mesh)
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
      amount: 0.25,
      bevelEnabled: false
    }

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    const material = new THREE.MeshBasicMaterial({color: this.color})
    return new THREE.Mesh(geometry, material)
  }

  createTrail () {
    for (let i = 0; i < this.positionsCount; i++) {
      this.oldPositions[i] = new THREE.Vector3()
    }
    const geometry = new THREE.Geometry()
    geometry.vertices = this.oldPositions
    const material = new THREE.LineBasicMaterial({color: this.color})
    return new THREE.Line(geometry, material)
  }

  update () {
    this.velocity.add(this.acceleration)
    this.velocity.clampScalar(-this.maxspeed, this.maxspeed)
    this.position.add(this.velocity)
    this.acceleration.multiplyScalar(0)

    // Update trail
    this.trail.geometry.vertices.push(this.position.clone())
    this.trail.geometry.vertices.shift()
    this.trail.geometry.verticesNeedUpdate = true
  }

  applyForce (force) {
    this.acceleration.add(force)
  }

  /**
   * A method that calculates a steering force towards a target
   * STEER = DESIRED MINUS VELOCITY
   * @param target
   */
  seek (target) {
    if (!target.x || !target.y) return

    // A vector pointing from the position to the target
    this.desired.subVectors(target, this.position)

    // Normalize the direction and scale to max speed
    this.desired.normalize()
    this.desired.multiplyScalar(1)

    // Steering = Desired minus velocity
    this.steer.subVectors(this.desired, this.velocity)
    this.steer.clampScalar(-this.maxforce, this.maxforce)

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

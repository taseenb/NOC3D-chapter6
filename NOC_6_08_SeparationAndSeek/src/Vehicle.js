const Palette = require('./Palette')

const vec3 = (a) => new THREE.Vector3(a)

class Vehicle {
  constructor (id, scene, position, maxspeed, maxforce, bounds) {
    this.id = id
    this.scene = scene
    this.startPosition = new THREE.Vector3().copy(position) // save this in case we need to reset position later
    this.position = new THREE.Vector3().copy(this.startPosition)
    this.maxspeed = maxspeed
    this.maxforce = maxforce
    this.bounds = bounds

    this.velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
    // this.velocity = new THREE.Vector3(-1 + Math.random() * 2, -1 + Math.random() * 2, -1 + Math.random() * 2)
    this.velocity.multiplyScalar(maxspeed * 2)
    this.acceleration = new THREE.Vector3()
    this.desired = new THREE.Vector3()
    this.steer = new THREE.Vector3()

    // Radius (for separation)
    this.r = 2

    // Colors
    this.palette = new Palette()
    this.color = this.palette.get(this.id)
    this.lineMaterial = new THREE.LineBasicMaterial({color: this.color, transparent: false})

    // Vehicle mesh
    // this.mesh = this.createMesh(0.5, 1)
    this.mesh = this.createMesh(0.8, 0.3)
    this.scene.add(this.mesh)

    // Trail
    this.initTrail()
  }

  /**
   * Create an extruded triangle to represent the vehicle
   * @returns {Mesh}
   */
  createMesh (_width, _height) {
    const width = _width || 1
    const height = _height || 2
    const halfW = width / 2
    const halfH = height / 2
    const shape = new THREE.Shape()

    shape.moveTo(-halfW, halfH)
    shape.lineTo(halfW, 0)
    shape.lineTo(-halfW, -halfH)
    shape.lineTo(-halfW, halfH)

    const extrudeSettings = {
      steps: 1,
      amount: 0.2,
      bevelEnabled: false
    }

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    const material = new THREE.MeshBasicMaterial({color: this.color})
    return new THREE.Mesh(geometry, material)
  }

  initTrail () {
    this.trail = false

    this.positionsCount = 100
    this.oldPositions = []
    for (let i = 0; i < this.positionsCount; i++) {
      this.oldPositions[i] = this.startPosition.clone()
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
   * Calculate a steering force to separate from the other vehicles
   * @param vehicles
   */
  separate (vehicles) {
    const sum = vec3()
    let distance = 0
    let count = 0

    // For every boid in the system, check if it's too close
    vehicles.forEach((v, i) => {
      distance = this.position.distanceTo(v.position)
      if (distance > 0 && distance < this.r) {
        // Calculate vector pointing away from neighbor
        const diff = vec3().subVectors(this.position, v.position)
        diff.normalize()
        diff.divideScalar(distance) // Weight by distance
        sum.add(diff)

        count++
      }
    })

    if (count > 0) {
      // Our desired vector is moving away maximum speed
      sum.normalize()
      sum.multiplyScalar(this.maxspeed)

      // Steering = Desired minus velocity
      this.steer.subVectors(sum, this.velocity)
      this.steer.clampScalar(-this.maxforce, this.maxforce)

      return this.steer
    } else {
      return vec3()
    }
  }

  /**
   * Calculate a steering force towards a target
   * STEER = DESIRED MINUS VELOCITY
   * @param target
   */
  seek (target) {
    // A vector pointing from the position to the target
    this.desired.subVectors(target, this.position)

    // Normalize the direction and scale to max speed
    this.desired.normalize()
    this.desired.multiplyScalar(this.maxspeed)

    // Steering = Desired minus velocity
    const steer = vec3()
    steer.subVectors(this.desired, this.velocity)
    steer.clampScalar(-this.maxforce, this.maxforce)

    return steer
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

  applyBehaviors (vehicles, target) {
    const separate = this.separate(vehicles)
    const seek = this.seek(target)

    // Weight forces
    separate.multiplyScalar(3) // more important
    seek.multiplyScalar(0.1) // less important

    this.applyForce(separate)
    this.applyForce(seek)
  }

  applyForce (force) {
    this.acceleration.add(force)
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

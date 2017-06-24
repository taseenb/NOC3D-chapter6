const Palette = require('./Palette')

class Vehicle {
  constructor (scene, position, maxspeed, maxforce, path) {
    this.scene = scene
    this.p = path
    this.startPosition = new THREE.Vector3().copy(position) // save this in case we need to reset position later
    this.position = new THREE.Vector3().copy(this.startPosition)
    this.maxspeed = maxspeed
    this.maxforce = maxforce
    this.velocity = new THREE.Vector3(maxspeed, 0, 0)
    this.acceleration = new THREE.Vector3()
    this.desired = new THREE.Vector3()
    this.steer = new THREE.Vector3()

    // Colors
    this.palette = new Palette()
    this.color = this.palette.getRandomColor()
    this.lineMaterial = new THREE.LineBasicMaterial({color: this.color, transparent: false})

    // Vehicle mesh
    // this.mesh = this.createMesh(0.5, 1)
    this.mesh = this.createMesh(3, 1.2)
    this.scene.add(this.mesh)

    // Debug
    this.initDebug()

    // Trail
    this.initTrail()
  }

  initDebug () {
    this.debug = true

    // Line showing the predicted position
    const predictLineGeo = new THREE.Geometry()
    predictLineGeo.vertices.push(new THREE.Vector3(), new THREE.Vector3())
    this.predictLine = new THREE.Line(predictLineGeo, this.lineMaterial)

    // Line showing the normal to the path
    const normalLineGeo = new THREE.Geometry()
    normalLineGeo.vertices.push(new THREE.Vector3(), new THREE.Vector3())
    this.normalLine = new THREE.Line(normalLineGeo, this.lineMaterial)

    this.scene.add(this.predictLine)
    this.scene.add(this.normalLine)

    // Press D to show/hide debug lines
    document.body.addEventListener('keyup', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        this.debug = !this.debug
      }

      this.predictLine.visible = this.debug
      this.normalLine.visible = this.debug
    })
  }

  resetDebug () {
    this.predictLine.geometry.vertices[0].copy(this.position)
    this.predictLine.geometry.vertices[1].copy(this.position)

    this.normalLine.geometry.vertices[0].copy(this.position)
    this.normalLine.geometry.vertices[1].copy(this.position)

    this.predictLine.geometry.verticesNeedUpdate = true
    this.normalLine.geometry.verticesNeedUpdate = true
  }

  updateDebug () {
    this.predictLine.geometry.vertices[0].copy(this.position)
    this.predictLine.geometry.vertices[1].copy(this.predictPosition)

    this.normalLine.geometry.vertices[0].copy(this.predictPosition)
    this.normalLine.geometry.vertices[1].copy(this.normalPoint)

    this.predictLine.geometry.verticesNeedUpdate = true
    this.normalLine.geometry.verticesNeedUpdate = true
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
    this.trail = true

    this.positionsCount = 100
    this.oldPositions = []
    for (let i = 0; i < this.positionsCount; i++) {
      this.oldPositions[i] = this.startPosition.clone()
    }

    const geometry = new THREE.Geometry()
    geometry.vertices = this.oldPositions
    this.trailLine = new THREE.Line(geometry, this.lineMaterial)

    this.scene.add(this.trailLine)

    // Press T to show/hide trail
    document.body.addEventListener('keyup', (e) => {
      if (e.key === 't' || e.key === 'T') {
        this.trail = !this.trail
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
   * Follow the given line path
   * @param path
   */
  follow (path) {
    const vec3 = (a) => new THREE.Vector3(a)

    // Predict position 2 frames ahead
    const predict = this.velocity.clone()
    predict.normalize()
    predict.multiplyScalar(4)
    this.predictPosition = vec3()
    this.predictPosition.addVectors(this.position, predict)

    // Look at the line segment
    const a = this.p.start
    const b = this.p.end

    // Get the normal point to that line
    this.normalPoint = this.getNormalPoint(this.predictPosition, a, b)

    // Find target point a little further ahead of normal
    const dir = vec3().subVectors(b, a)
    dir.normalize()
    dir.multiplyScalar(10) // This could be based on velocity instead of just an arbitrary 10 pixels
    const target = vec3().addVectors(this.normalPoint, dir)

    // How far away are we from the path?
    const distance = vec3().subVectors(this.predictPosition, this.normalPoint).length()

    // Only if the distance is greater than the path's radius do we bother to steer
    if (distance > path.radius) {
      this.seek(target)
    }
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

  getNormalPoint (predictpos, a, b) {
    // Vector from a to p
    const ap = new THREE.Vector3().subVectors(predictpos, a)

    // Vector from a to b
    const ab = new THREE.Vector3().subVectors(b, a)
    ab.normalize() // Normalize the path

    // Project vector "diff" onto line by using the dot product
    ab.multiplyScalar(ap.dot(ab))

    return new THREE.Vector3().addVectors(a, ab)
  }

  checkBoundaries () {
    if (this.position.x > this.p.end.x) {
      this.position.copy(this.startPosition)

      this.resetDebug()
      this.resetTrail()
    }
  }

  update () {
    this.velocity.add(this.acceleration)
    this.velocity.clampScalar(-this.maxspeed, this.maxspeed)
    this.position.add(this.velocity)
    this.acceleration.multiplyScalar(0)

    if (this.trail) {
      this.updateTrail()
    }

    if (this.debug) {
      this.updateDebug()
    }

    this.checkBoundaries()
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

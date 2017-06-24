const Palette = require('./Palette')

const vec3 = (a) => new THREE.Vector3(a)

class Vehicle {
  constructor (id, scene, position, maxspeed, maxforce, path) {
    this.id = id
    this.scene = scene
    this.startPosition = new THREE.Vector3().copy(position) // save this in case we need to reset position later
    this.position = new THREE.Vector3().copy(this.startPosition)
    this.maxspeed = maxspeed
    this.maxforce = maxforce
    this.p = path

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

    // Debug
    this.initDebug()

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

  initDebug () {
    this.debug = false

    // Normal points
    this.normalPoints = []
    for (let i = 0; i < this.p.pointsCount - 1; i++) {
      const normalMaterial = new THREE.MeshBasicMaterial({color: 0x333333, transparent: false})
      const normalDot = new THREE.BoxBufferGeometry(0.2, 0.2, 0.2)
      const mesh = new THREE.Mesh(normalDot, normalMaterial)
      this.normalPoints.push(mesh)
      this.scene.add(mesh)
    }

    // Line showing the predicted position
    const predictLineGeo = new THREE.Geometry()
    predictLineGeo.vertices.push(new THREE.Vector3(), new THREE.Vector3())
    this.predictLine = new THREE.Line(predictLineGeo, this.lineMaterial)
    this.predictLine.frustumCulled = false

    // Line showing the normal to the path
    const normalLineGeo = new THREE.Geometry()
    normalLineGeo.vertices.push(new THREE.Vector3(), new THREE.Vector3())
    this.normalLine = new THREE.Line(normalLineGeo, this.lineMaterial)
    this.normalLine.frustumCulled = false

    this.scene.add(this.predictLine)
    this.scene.add(this.normalLine)

    // Press D to show/hide debug lines
    document.body.addEventListener('keyup', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        this.debug = !this.debug
      }
      this.updateDebugVisibility()
    })

    this.updateDebugVisibility()
  }

  updateDebugVisibility () {
    this.predictLine.visible = this.debug
    this.normalLine.visible = this.debug
    this.normalPoints.forEach((n) => { n.visible = this.debug })
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

  /**
   * Check if p is between a and b, or outside
   * @param a Start of the segment
   * @param b End of the segment
   * @param p Point to check
   */
  isPointOnSegment (a, b, p) {
    const tolerance = 0.1
    const ab = a.distanceTo(b)
    const pa = p.distanceTo(a)
    const pb = p.distanceTo(b)
    const difference = ab - (pa + pb)

    return difference < tolerance && difference > -tolerance
  }

  /**
   * Follow a path made of several segments
   * @param path
   */
  follow (path) {
    // Predict position 2 frames ahead (this could be based on speed)
    this.predictPosition = this.velocity.clone()
    this.predictPosition.normalize().multiplyScalar(4)
    this.predictPosition.add(this.position)

    // Now we must find the normal to the path from the predicted position
    // We look at the normal for each line segment and pick out the closest one
    let normal = null
    let target = null
    let closestDistance = Infinity  // Start with a very high record distance that can easily be beaten

    for (let i = 0; i < path.pointsCount - 1; i++) {
      // Look at the line segment
      const a = path.points[i]
      const b = path.points[i + 1]

      // Get the normal point to that line
      normal = this.getNormalPoint(this.predictPosition, a, b)

      // Save the normal point for debug visualization
      if (this.debug) {
        this.normalPoints[i].position.copy(normal)
      }

      // How far away are we from the path?
      let distance

      // Check if the normal point is inside the line segment, and get the distance
      if (this.isPointOnSegment(a, b, normal)) {
        distance = this.predictPosition.distanceTo(normal)
      } else {
        // If we could not find a point on the segment,
        // let's take the closest between A and B
        const distanceA = this.predictPosition.distanceTo(a)
        const distanceB = this.predictPosition.distanceTo(b)
        distance = Math.min(distanceA, distanceB)
        normal = distanceA < distanceB ? a : b
      }

      // Did we found the closest point from the line?
      if (distance < closestDistance) {
        closestDistance = distance
        this.normalPoint = normal

        // Get the direction of the line segment...
        const dir = vec3().subVectors(b, a).normalize()

        // ...so we can seek a little bit ahead of the normal
        // dir.multiplyScalar(2) // This is an oversimplification (should be based on distance to path & velocity)

        dir.multiplyScalar(10 * (1 - 1 / distance))

        // The target is the normal point on the segment + the direction ahead
        target = this.normalPoint.clone()
        target.add(dir)
      }
    }

    // Only if the distance is greater than the path's radius do we bother to steer
    // Remember that distances are calculated SQUARED (for performance!),
    // so square the path radius too for the comparision!
    if (closestDistance > path.radius) {
      return this.seek(target)
    } else {
      return vec3()
    }
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
    if (this.position.x > this.p.points[this.p.pointsCount - 1].x) {
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

  applyBehaviors (vehicles) {
    const separate = this.separate(vehicles)
    const follow = this.follow(this.p)

    // Weight forces
    separate.multiplyScalar(3) // more important
    follow.multiplyScalar(1) // less important

    this.applyForce(separate)
    this.applyForce(follow)
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

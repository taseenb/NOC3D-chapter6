const Palette = require('./Palette')

const vec3 = (a) => new THREE.Vector3(a)

class Boid {
  constructor (id, scene, position, maxspeed, maxforce, path) {
    this.id = id
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
    this.color = this.palette.get(this.id)
    this.lineMaterial = new THREE.LineBasicMaterial({color: this.color, transparent: false})

    // Vehicle mesh
    this.vehicle = new THREE.Object3D()

    // Debug
    this.initDebug()

    // Trail
    const minLength = 5
    const maxLength = 25
    this.initTrail(minLength + ~~(Math.random() * (maxLength - minLength)), 'linear')
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

  initTrail (length, type) {
    this.trail = true

    // Create line vertices
    const geometry = new THREE.Geometry()
    for (let i = 0; i < length; i++) {
      // must initialize it to the number of positions it will keep or it will throw an error
      geometry.vertices.push(this.position.clone())
    }

    // Create the line mesh
    this.line = new window.MeshLine()

    // Line type
    switch (type) {
      case 'none':
        this.line.setGeometry(geometry)
        break
      case 'linear':
        this.line.setGeometry(geometry, function (p) { return p }) // makes width taper
        break
      case 'parabolic':
        this.line.setGeometry(geometry, function (p) { return 1 * Maf.parabola(p, 1)})
        break
      case 'wavy':
        this.line.setGeometry(geometry, function (p) { return 2 + Math.sin(50 * p) })
        break
    }

    // Create the line material
    this.lineMaterial = new window.MeshLineMaterial({
      color: new THREE.Color(this.color),
      lineWidth: 0.4,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      opacity: 1,
      sizeAttenuation: true,
      depthTest: false
    })

    // Create mesh
    this.lineMesh = new THREE.Mesh(this.line.geometry, this.lineMaterial)
    this.lineMesh.frustumCulled = false

    // Add to the scene
    this.scene.add(this.lineMesh)

    // Update resolution uniform on window resize (debounced)
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeDebounce)
      this.resizeDebounce = setTimeout(() => {
        this.lineMesh.material.uniforms.resolution.value.copy(new THREE.Vector2(window.innerWidth, window.innerHeight))
      }, 250)
    })
  }

  updateTrail () {
    // this.lineMesh.material.uniforms.color.value = this.lineMesh.material.color;
    this.line.advance(this.position)
  }

  resetTrail () {
    const geo = this.lineMesh.geometry
    const positions = geo.attributes.position.array
    const count = positions.length

    for (let i = 0; i < count; i += 3) {
      geo.attributes.position.array[i] = this.position.x
      geo.attributes.position.array[i + 1] = this.position.y
      geo.attributes.position.array[i + 2] = this.position.z
    }

    geo.attributes.position.needsUpdate = true
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

  applyForce (force) {
    this.acceleration.add(force)
  }

  draw () {
    this.vehicle.position.copy(this.position)

    /**
     * Calculate rotation (not sure this is the best way but works)
     * Copied from: https://github.com/mrdoob/three.js/blob/master/examples/canvas_geometry_birds.html
     */
    this.vehicle.rotation.y = Math.atan2(-this.velocity.z, this.velocity.x)
    this.vehicle.rotation.z = Math.asin(this.velocity.y / this.velocity.length())
  }
}

module.exports = Boid

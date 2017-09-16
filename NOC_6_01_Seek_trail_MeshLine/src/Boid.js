const Palette = require('./Palette')

class Boid {
  constructor (scene, position, maxspeed, maxforce) {
    this.scene = scene
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
    this.createTrail(100, 'linear')

    // Vehicle mesh
    this.vehicle = new THREE.Object3D()
    // this.mesh = this.createMesh(1, 2)
    // scene.add(this.mesh)
  }

  /**
   * Create an extruded triangle to represent the vehicle
   * @returns {Mesh}
   */
  // createMesh (_width, _length) {
  //   const width = _width || 1
  //   const length = _length || 2
  //   const shape = new THREE.Shape()
  //   shape.moveTo(0, width / 2)
  //   shape.lineTo(length, 0)
  //   shape.lineTo(0, -width / 2)
  //   shape.lineTo(0, width / 2)
  //
  //   const extrudeSettings = {
  //     steps: 1,
  //     amount: 0.25,
  //     bevelEnabled: false
  //   }
  //
  //   const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  //   const material = new THREE.MeshBasicMaterial({color: this.color})
  //   return new THREE.Mesh(geometry, material)
  // }

  createTrail (length, type) {
    const geometry = new THREE.Geometry()
    for (let i = 0; i < length; i++) {
      // must initialize it to the number of positions it will keep or it will throw an error
      geometry.vertices.push(this.position.clone())
    }

    // Create the line mesh
    this.line = new window.MeshLine()
    // this.line.setGeometry(geometry) // makes width taper

    // Line type
    switch (type) {
      case 'none':
        this.line.setGeometry(geometry)
        break
      case 'linear':
        this.line.setGeometry(geometry, function (p) { return p })
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
      lineWidth: 0.2,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      opacity: 1,
      sizeAttenuation: true
    })

    this.lineMesh = new THREE.Mesh(this.line.geometry, this.lineMaterial)
    this.lineMesh.frustumCulled = false

    this.scene.add(this.lineMesh)
  }

  update () {
    this.velocity.add(this.acceleration)
    this.velocity.clampScalar(-this.maxspeed, this.maxspeed)
    this.position.add(this.velocity)
    this.acceleration.multiplyScalar(0)

    // Update trail
    // this.lineMesh.material.uniforms.color.value = this.lineMesh.material.color;
    this.line.advance(this.position)
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

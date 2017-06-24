class Path {
  constructor (scene, pointsCount, w, h, d, radius) {
    this.scene = scene
    this.width = w || 40
    this.height = h || 20
    this.depth = d || 20

    this.pointsCount = pointsCount
    this.points = []
    this.radius = radius || 3

    this.startX = -this.width / 2
    this.endX = this.width / 2

    this.init()
  }

  /**
   * Create a path with points from the start to end (evenly spaced on the X axis)
   */
  createPoints () {
    const length = this.endX - this.startX
    const stepX = length / (this.pointsCount - 1)

    this.points = []

    for (let i = 0; i < this.pointsCount; i++) {
      const p = new THREE.Vector3()

      p.x = this.startX + stepX * i
      p.y = Math.random() * this.height
      p.z = Math.random() * this.depth - this.depth / 2

      this.points.push(p)
    }
  }

  update () {
    this.line.geometry.vertices.forEach((v, i) => {
      v.copy(this.points[i])
    })
    this.line.geometry.verticesNeedUpdate = true
  }

  toggleVisibilty () {

  }

  init () {
    this.createPoints()

    // Draw path line
    const geometry = new THREE.Geometry()
    this.points.forEach((p) => {
      geometry.vertices.push(p)
    })
    const material = new THREE.LineBasicMaterial({color: 0x666666})
    this.line = new THREE.Line(geometry, material)
    this.scene.add(this.line)

    // Press D to show/hide debug lines
    document.body.addEventListener('keyup', (e) => {
      if (e.key === 'v' || e.key === 'V') {
        if (this.line) {
          this.line.visible = !this.line.visible
        }
      }
    })

    // Draw path radius
    // const dir = new THREE.Vector3().subVectors(this.start, this.end) // get the vector representing the path line
    // const radius = new THREE.Mesh(
    //   new THREE.CylinderBufferGeometry(this.radius, this.radius, dir.length(), 10, 1, false),
    //   new THREE.MeshBasicMaterial({color: 0xCCCCCC, transparent: true, opacity: 0.2})
    // )
    // // Align a mesh to a unit vector
    // const axis = new THREE.Vector3(0, 1, 0)
    // radius.quaternion.setFromUnitVectors(axis, dir.clone().normalize())
    //
    // // Match the position of a vector
    // radius.position.y = (this.start.y + this.end.y) / 2

    // this.scene.add(radius)
  }
}

module.exports = Path

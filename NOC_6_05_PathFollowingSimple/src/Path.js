class Path {
  constructor (scene, w, h, d) {
    this.scene = scene
    this.width = w || 40
    this.height = h || 20
    this.depth = d || 20

    this.radius = 2
    this.start = new THREE.Vector3(-this.width / 2, this.height / 3, -this.depth / 2)
    this.end = new THREE.Vector3(this.width / 2, 2 * this.height / 3, this.depth / 2)

    // this.length = this.start.distanceTo(this.end)

    this.init()
  }

  init () {
    // Draw path line
    const geometry = new THREE.Geometry()
    geometry.vertices.push(this.start, this.end)
    const material = new THREE.LineBasicMaterial({color: 0x666666})
    const line = new THREE.Line(geometry, material)
    this.scene.add(line)

    // Draw path radius
    const dir = new THREE.Vector3().subVectors(this.start, this.end) // get the vector representing the path line
    const radius = new THREE.Mesh(
      new THREE.CylinderBufferGeometry(this.radius, this.radius, dir.length(), 10, 1, false),
      new THREE.MeshBasicMaterial({color: 0xFFFFFF, transparent: true, opacity: 0.2})
    )
    // Align a mesh to a unit vector
    const axis = new THREE.Vector3(0, 1, 0)
    radius.quaternion.setFromUnitVectors(axis, dir.clone().normalize())

    // Match the position of a vector
    radius.position.y = (this.start.y + this.end.y) / 2

    this.scene.add(radius)
  }

  draw () {

  }
}

module.exports = Path

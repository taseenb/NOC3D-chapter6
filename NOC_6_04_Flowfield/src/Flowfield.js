const SimplexNoise = require('simplex-noise')
const Alea = require('alea')

class Flowfield {
  constructor (scene, bounds, resolution, draw) {
    this.scene = scene
    this.resolution = resolution
    this.width = bounds.x
    this.height = bounds.y
    this.depth = bounds.z

    this.draw = draw

    this.init(this.draw)
  }

  init (draw) {
    this.seed = Math.random() * 10000000
    const field = []
    const noiseDiff = 0.005
    const random = new Alea(this.seed)
    const simplex = new SimplexNoise(random)
    const res = this.resolution
    const r = res / 2 // radius
    const sX = this.width / res
    const sY = this.height / res
    const sZ = this.depth / res

    let xoff = 0
    for (let x = 0; x < sX; x++) {
      field[x] = []
      let yoff = 0
      for (let y = 0; y < sY; y++) {
        field[x][y] = []
        let zoff = 0
        for (let z = 0; z < sZ; z++) {
          // See: https://en.wikipedia.org/wiki/Spherical_coordinate_system#Cartesian_coordinates
          // get noise for theta and phi angles
          const theta = simplex.noise2D(yoff, zoff) * Math.PI * 2
          const phi = simplex.noise2D(xoff, yoff) * Math.PI * 2
          // get cartesian coordinate from spherical coordinates (angles)
          const _x = r * Math.sin(theta) * Math.cos(phi) - r / 2
          const _y = r * Math.sin(theta) * Math.sin(phi) - r / 2
          const _z = r * Math.cos(theta) - r / 2

          field[x][y][z] = new THREE.Vector3(_x, _y, _z)
          zoff += noiseDiff
        }
        yoff += noiseDiff
      }
      xoff += noiseDiff
    }

    this.field = field

    if (this.draw) {
      this.drawVectors()
    }
  }

  drawVectors () {
    const sX = this.width / this.resolution
    const sY = this.height / this.resolution
    const sZ = this.depth / this.resolution

    if (this.notFirstTime) {
      this.updatePositionAttribute(this.lines.geometry.attributes.position.array)
      this.lines.geometry.attributes.position.needsUpdate = true
    } else {
      const material = new THREE.LineBasicMaterial({color: 0xFFFFFF})
      const geometry = new THREE.BufferGeometry()
      let position = new Float32Array(sX * sY * sZ * 6)
      geometry.addAttribute('position', new THREE.BufferAttribute(position, 3).setDynamic(false))
      this.updatePositionAttribute(position)
      this.lines = new THREE.LineSegments(geometry, material)
      this.scene.add(this.lines)
      this.notFirstTime = true
    }
  }

  toggleVectorsVisibility () {
    if (!this.notFirstTime) {
      this.draw = true
      this.drawVectors()
    } else {
      this.lines.visible = !this.lines.visible
    }
  }

  updatePositionAttribute (position) {
    const sX = this.width / this.resolution
    const sY = this.height / this.resolution
    const sZ = this.depth / this.resolution

    let i = 0
    for (let x = 0; x < sX; x++) {
      for (let y = 0; y < sY; y++) {
        for (let z = 0; z < sZ; z++) {
          const vector = this.field[x][y][z]

          position[i + 0] = x * this.resolution - this.width / 2
          position[i + 1] = y * this.resolution - this.height / 2
          position[i + 2] = z * this.resolution - this.depth / 2
          position[i + 3] = position[i + 0] + vector.x
          position[i + 4] = position[i + 1] + vector.y
          position[i + 5] = position[i + 2] + vector.z

          i += 6
        }
      }
    }
  }

  lookup (position) {
    const res = this.resolution
    const maxX = this.width / res - 1
    const maxY = this.height / res - 1
    const maxZ = this.depth / res - 1

    let x = Math.floor((position.x + this.width / 2) / res)
    let y = Math.floor((position.y + this.height / 2) / res)
    let z = Math.floor((position.z + this.depth / 2) / res)

    x = Math.max(0, Math.min(x, maxX))
    y = Math.max(0, Math.min(y, maxY))
    z = Math.max(0, Math.min(z, maxZ))

    return this.field[x][y][z]
  }
}

module.exports = Flowfield

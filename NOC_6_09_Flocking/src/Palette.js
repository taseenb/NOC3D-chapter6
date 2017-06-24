class Palette {
  constructor () {
    this.colors = [
      '#CFF09E',
      '#A8DBA8',
      '#79BD9A',
      '#3B8686',
      '#0B486B',
      '#69D2E7',
      '#A7DBD8',
      '#E0E4CC',
      '#F38630',
      '#FA6900'
    ]
  }

  get (id) {
    id = id || 0
    return this.colors[id % this.colors.length]
  }

  getRandomColor () {
    const i = Math.floor(this.colors.length * Math.random())
    return this.colors[i]
  }
}

module.exports = Palette

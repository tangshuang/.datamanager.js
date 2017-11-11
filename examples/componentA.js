import DataManager from '../datamanager'

export default class ComponentA {
  constructor(container) {
    this.container = container
    this.data = new DataManager([
      {
        id: 'studentsA',
        url: '/students',
        type: 'GET',
      },
    ])
    this.data.autorun(this.render.bind(this))
  }
  render() {
    let students = this.data.get('studentsA')
    if (!students) {
      return
    }
    let list = ''
    students.forEach(std => {
      list += '<li>' + std.name + ': ' + std.score + '</li>'
    })
    let html = `<ul>${list}</ul>`
    document.querySelector(this.container).innerHTML = html
  }
}
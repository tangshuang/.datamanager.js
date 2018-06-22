import DataManager from '../datamanager'

export default class ComponentA {
  constructor(container, DataSources) {
    this.container = container
    this.data = new DataManager({ id: 'A', snapshots: 10 })
    this.data.register(Object.assign({ id: 'studentsA' }, DataSources.STUDENTS))
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
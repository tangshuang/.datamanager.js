import DataManager from '../datamanager'

export default class ComponentA {
  constructor(container) {
    this.container = container
    let datasources = [
      {
        id: 'studentsB',
        url: '/students',
        type: 'GET',
      },
    ]
    this.data = new DataManager(datasources, { debug: true, expires: 1000 })
    this.data.autorun(this.render.bind(this))
  }
  render() {
    let students = this.data.get('studentsB')
    if (!students) {
      return
    }
    let list = ''
    students.forEach(std => {
      list += `
        <tr>
          <td>${std.name}</td>
          <td>${std.score}</td>
        </tr>
      `
    })
    let html = `
      <table border="0" cellspacing="0" cellpadding="0">
        ${list}
      </table>
    `
    document.querySelector(this.container).innerHTML = html
  }
}
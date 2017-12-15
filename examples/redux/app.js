import store from 'store'

function render() {
  let users = store.getState()
  let html = ''
  let container = document.querySelector('#container')
  users.forEach(item => html += `id:${item.id} name:${item.name}`)
  container.innerHTML = html
}

store.subscribe(render)
render()

document.querySelector('#add').addEventListener('click', e => {
  let user = { id: Math.random(), name: Math.random() }
  store.dispath({ type: 'Add', data: user })
})
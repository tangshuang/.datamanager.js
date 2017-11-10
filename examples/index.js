import ComponentA from './componentA'
import ComponentB from './componentB'

let $el = document.querySelector('#app')
$el.innerHTML = `
  <h3>rendered by componentA:</h3>
  <div id="container1"></div>
  <h3>rendered by componentB:</h3>
  <div id="container2"></div>
`

let a = new ComponentA('#container1')
let b = new ComponentB('#container2')

document.querySelector('#refresh').addEventListener('click', e => {
  b.render()
})
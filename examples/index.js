import ComponentA from './componentA'
import ComponentB from './componentB'
import * as DataSources from './datasources'

let $el = document.querySelector('#app')
$el.innerHTML = `
  <h1>Demo 1: request only once when using same datasource</h1>
  <h3>rendered by componentA:</h3>
  <div id="container1"></div>
  <h3>rendered by componentB:</h3>
  <div id="container2"></div>
  <p>Look into network request, you will find only one request is sent to server side</p>
  <h1>Demo 2: request from one component, all components will be notified</h1>
  <p>Click <button id="refresh">button</button> to refresh componentB, you will see componentA is notified too.</p>
  <p>Why quickly clicking causes several requests? You should adjust the 'expires' option in ComponentB. </p>
  <p>The demo 1 rules means when a request is pending, it will not be sent again, after the request success, new request will be sent. It is not meaning debounce.</p>
  <h1>Demo 3: save data to server side</h1>
  <p>Click <button id="save">button</button> to post data to server side.</p>
  <p>Look into my code, there are two 'this.data.save()', but only one request sent.</p>
`

let a = new ComponentA('#container1', DataSources)
let b = new ComponentB('#container2', DataSources)

document.querySelector('#refresh').addEventListener('click', e => {
  b.render()
})

document.querySelector('#save').addEventListener('click', e => {
  b.save()
})
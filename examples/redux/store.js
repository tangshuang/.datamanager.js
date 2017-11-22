/**
 * An example to demo use datamanager.js with redux
 */

import { createStore } from "redux"
import DataManager from "datamanager.js"

const datamanager = new DataManager([
  {
    id: 'users',
    url: 'yoururl',
    type: 'GET',
  },
])
const reducer = function(state, action) {
  state = Object.assign({}, state)
  if (action.type === "ADD") {
    let save = async function() {
      // show loding
      await datamanager.save('users', {}, action.data, { method: 'POST' })
      await datamanager.get('users', {}, {}, true)
      // hide loading
    }
    save()
  }
  else if (action.type === "UPDATE") {
    let id = action.data.id
    state[id] = data
  }
  return state
}
const store = createStore(reducer)


function update() {
  let users = datamanager.get('users')
  if (users === undefined) {
    return
  }
  users.forEach(user => store.dispatch({ type: 'UPDATE', data: user }))
}

datamanager.autorun(update)

export default store
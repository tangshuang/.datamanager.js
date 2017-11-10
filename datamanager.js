import hashstr from 'hash-string'
import deepclone from 'lodash.clonedeep'
import merge from 'lodash.merge'
import interpolate from 'interpolate'

const pool = {}
const queue = {}

function addDataSource(source) {
  let { hash, url, type } = source
  if (pool[hash]) {
    return
  }
  pool[hash] = {
    url,
    type,
    store: {},
    callbacks: [],
  }
}

function addDataItem(source, requestId, data) {
  let { store } = source
  let item = store[requestId] = store[requestId] || {}
  let snapshots = item.snapshots = item.snapshots || []
  let time = Date.now()
  let dataItem = {
    time,
    data,
  }
  snapshots.push(dataItem)
  item.time = time
  item.data = data
}
function trigger(callbacks, ...args) {
  callbacks.sort((a, b) => {
    if (a.priority > b.priority) {
      return -1
    }
    else if (a.priority < b.priority) {
      return 1
    }
    else {
      return 0
    }
  })
  callbacks.forEach(item => {
    item.callback(...args)
  })
}

function transform(data, transformers) {
  if (!transformers || !transformers.length) {
    return data
  }
  let result = data
  transformers.forEach(transformer => {
    result = transform(result)
  })
  return result
}

function isEqual(obj1, obj2) {
  if (Object.keys(obj1).length == 0 && Object.keys(obj2).length === 0) {
    return true
  }
  return obj1 === obj2
}

export default class DataManager {
  constructor(datasources = [], settings = {}) {
    this.datasources = {}
    this.id = 'datamanager.' + Date.now() + '.' + parseInt(Math.random() * 10000)
    this.settings = merge({ expires: 10*1000, debug: false }, settings)
    datasources.forEach(datasource => this.register(datasource))
    this._deps = []
  }
  _debug(...args) {
    if (this.settings.debug) {
      console.log(this.id, ...args)
    }
  }
  register(datasource) {
    let { id, url, type, transformers } = datasource
    let hash = hashstr(type + ':' + url)
    let source = {
      hash,
      type,
      url,
    }

    addDataSource(source)
    this.datasources[id] = merge({}, source, { transformers })
    
    return this
  }
  subscribe(id, callback, priority = 10) {
    let datasource = this.datasources[id]
    if (!datasource) {
      throw new Error('Datasource ' + id + ' is not exists.')
    }

    let source = pool[datasource.hash]
    let callbacks = source.callbacks
    callbacks.push({
      context: this.id,
      callback,
      priority,
    })

    return this
  }
  unsubscribe(id, callback) {
    let datasource = this.datasources[id]
    if (!datasource) {
      throw new Error('Datasource ' + id + ' is not exists.')
    }

    let source = pool[datasource.hash]
    let callbacks = source.callbacks

    source.callbacks = callbacks.filter(item => {
      if (item.context === this.id) {
        if (callback === undefined) {
          return false
        }
        if (item.callback === callback) {
          return false
        }
      }
      return true
    })

    return this
  }
  _wrapDep(fun) {
    this._dep = {
      target: fun,
    }
    fun()
    delete this._dep
  }
  _addDep() {
    let _dep = this._dep
    let { id, params, target } = _dep

    if (this._deps.find(item => item.id === id && isEqual(item.params, params) && item.target === target)) {
      return false
    }

    let callback = params => {
      if (isEqual(_dep.params, params)) {
        this._wrapDep(_dep.target)
      }
    }
    this._deps.push({
      target,
      id,
      params,
      callback,
    })
    this.subscribe(id, callback)

    return true
  }
  autorun(funcs) {
    if (!Array.isArray(funcs) && typeof funcs === 'function') {
      funcs = [ funcs ]
    }
    funcs.forEach(fun => {
      this._wrapDep(fun)
    })
  }
  autostop(funcs) {
    if (!Array.isArray(funcs) && typeof funcs === 'function') {
      funcs = [ funcs ]
    }
    funcs.forEach(fun => {
      let deps = this._deps.filter(item => item.target === fun)
      deps.forEach(dep => {
        this.unsubscribe(dep.id, dep.callback)
      })
      this._deps = this._deps.filter(item => item.target !== fun)
    })
  }
  get(id, params = {}, options = {}) {
    let datasource = this.datasources[id]
    if (!datasource) {
      throw new Error('Datasource ' + id + ' is not exists.')
    }

    // add dependences
    if (this._dep && this._dep.target) {
      this._dep.id = id
      this._dep.params = params
      this._addDep()
    }

    let { url, type, transformers } = datasource
    let requestId = hashstr(type + ':' + url + ':' + JSON.stringify(params) + (type.toUpperCase() === 'POST' && options.body ? ':' + JSON.stringify(options.body) : ''))
    let source = pool[datasource.hash]
    
    let request = () => {
      if (queue[requestId]) {
        return queue[requestId]
      }
      let requestURL = interpolate(url, params)
      options.method = options.method || type.toUpperCase()
      let requesting = fetch(requestURL, options)
      .then(res => {
        queue[requestId] = null
        return res.json()
      }) // only json supported
      .then(data => {
        addDataItem(source, requestId, data)
        let callbacks = source.callbacks
        trigger(callbacks, params)
      })
      .catch(e => {
        queue[requestId] = null
        throw e
      })
      return requesting
    }
    let use = data => {
      return transform(deepclone(data), transformers)
    }
    
    let { store } = source
    let item = store[requestId]
    let { expires } = this.settings

    // if there is no data in pool, request data now
    if (!item) {
      queue[requestId] = request()
    }

    // if expires is not set, it means user want to use current cached data any way
    if (!expires) {
      return item ? use(item.data) : undefined
    }
    else {
      // if data is not in our store now
      if (!item) {
        return undefined
      }

      let { time, data } = item
      // when data is not expired, use it
      if (time + expires > Date.now()) {
        return use(data)
      }

      // when data is expired, return undefined and request new data again
      queue[requestId] = request()
      return undefined
    }
  }
}
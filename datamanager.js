import deepclone from 'lodash.clonedeep'
import merge from 'lodash.merge'
import interpolate from 'interpolate'
import { getObjectHashCode } from 'hashcodeobject'
import axios from 'axios'

// for cache
const pool = {}
const queue = {}
const transactions = {}

// for request intercept
const middlewares = []
const modems = []

const configs = {
  host: '',
  expires: 10, 
  debug: false,
}

export function config(cfgs = {}) {
  merge(configs, cfgs)
}

export function use(mw) {
  middlewares.push(mw)
}

export function adapt(modem) {
  modems.push(modem)
}

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

function setDataItem(source, requestId, data) {
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
    result = transformer(result) || result
  })
  return result
}

function intercept(req, middlewares) {
  return new Promise((resolve, reject) => {
    let i = 0
    let roll = () => {
      let pipe = middlewares[i]
      if (!pipe) {
        resolve()
        return
      }
      i ++
      return new Promise((next, stop) => { pipe(req, next, stop) }).then(roll).catch(reject)
    }
    roll()
  })
}

function demodulate(res, modems) {
  return intercept(res, modems)
}

function isEqual(obj1, obj2) {
  if (Object.keys(obj1).length == 0 && Object.keys(obj2).length === 0) {
    return true
  }
  return obj1 === obj2
}

export default class DataManager {
  constructor(settings = {}) {
    this.datasources = {}
    this.id = settings.id || 'datamanager.' + Date.now() + '.' + parseInt(Math.random() * 10000)
    this.settings = merge({}, configs, settings)
    this._deps = []
  }
  _debug(...args) {
    if (this.settings.debug) {
      console.log(this.id, ...args)
    }
  }
  register(datasources) {
    if (!Array.isArray(datasources)) {
      datasources = [ datasources ]
    }

    datasources.forEach(datasource => {
      let { id, url, type, postData, transformers, immediate, middlewares, modems, expires } = datasource
      let settings = this.settings
      let { host } = this.settings
      let requestURL = url.indexOf('http://') > -1 || url.indexOf('https://') > -1 ? url : host + url
      let hash = getObjectHashCode({ type, url: requestURL, postData })
      let source = {
        hash,
        url: requestURL,
        type,
        postData,
      }
  
      addDataSource(source)
      this.datasources[id] = merge({}, source, { transformers, middlewares, modems, expires })
  
      if (immediate) {
        this.request(id)
      }
    })

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

    let callback = (data, params) => {
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
  autofree(funcs) {
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
  _create(id, params, options, force, usePromise, collectDependences) {
    let datasource = this.datasources[id]
    if (!datasource) {
      throw new Error('Datasource ' + id + ' is not exists.')
    }

    // add dependences
    if (collectDependences && this._dep && this._dep.target) {
      this._dep.id = id
      this._dep.params = params
      this._addDep()
    }

    let { url, type, transformers } = datasource
    let requestURL = interpolate(url, params)
    let requestId = getObjectHashCode({ type, url: requestURL, postData: options.data })
    let source = pool[datasource.hash]
    let settings = this.settings
    
    let transfer = data => {
      return transform(deepclone(data), transformers)
    }
    let request = () => {
      if (queue[requestId]) {
        return queue[requestId]
      }

      let req = merge({}, options)
      let postData = datasource.postData
      req.url = requestURL
      req.method = req.method || type.toUpperCase()
      req.data = merge({}, postData, req.data)

      let requester = intercept(req, middlewares.concat(settings.middlewares || []).concat(datasource.middlewares || []))
      .then(() => {
        this._debug('Request:', req)
        return axios(req)
        .then(res => {
          queue[requestId] = null

          return demodulate(res, modems.concat(settings.modems || []).concat(datasource.modems || []))
          .then(() => {
            this._debug('Response:', res)
            let data = res.data
            setDataItem(source, requestId, data)
            
            let callbacks = source.callbacks
            trigger(callbacks, data, params)
            
            return transfer(data)
          })
          .catch(e => {
            throw e
          })
        })
        .catch(e => {
          queue[requestId] = null
          throw e
        })  
      })
      
      queue[requestId] = requester
      return requester
    }

    // if force request data from server side
    if (force) {
      return request()
    }
    
    let { store } = source
    let item = store[requestId]
    let expires = datasource.expires === undefined ? settings.expires : datasource.expires

    // if there is no data in pool, request data now
    if (!item) {
      let requester = request()
      if (usePromise) {
        return requester
      }
      return undefined
    }

    // if expires is not set, it means user want to use current cached data any way
    // when data cache is not expired, use it
    if (!expires || item.time + expires > Date.now()) {
      let output = transfer(item.data)
      if (usePromise) {
        return Promise.resolve(output)
      }
      return output
    }

    let requester = request()
    if (usePromise) {
      return requester
    }
    // when data is expired, return undefined and request new data again
    return transfer(item.data)
  }
  request(id, params = {}, options = {}, force = false) {
    return this._create(id, params, options, force, true, false)
  }
  get(id, params = {}, options = {}, force = false) {
    return this._create(id, params, options, force, false, true)
  }
  save(id, params = {}, data, options = {}) {
    let datasource = this.datasources[id]
    if (!datasource) {
      throw new Error('Datasource ' + id + ' is not exists.')
    }

    let settings = this.settings
    let { url, type } = datasource
    let requestURL = interpolate(url, params)
    let requestId = getObjectHashCode({ type, url: requestURL, postData: options.data })

    let transaction = transactions[requestId]
    let reset = () => {
      return {
        resolves: [],
        promises: [],
        data: {},
        timer: null,
        processing: null,
      }
    }
    if (!transaction) {
      transaction = transactions[requestId] = reset()
    }

    let { resolves, promises, timer, processing } = transaction
    transaction.data = merge({}, transaction.data, options.data, data)
    promises.push(new Promise(resolve => resolves.push(resolve)))

    if (timer) {
      clearTimeout(timer)
    }

    transaction.timer = setTimeout(() => {
      resolves.forEach(resolve => resolve())
      transactions[requestId] = reset()
    }, 10)

    if (processing) {
      return processing
    }

    transaction.processing = new Promise((resolve, reject) => {
      Promise.all(promises)
      .then(() => {
        let req = merge({}, options)
        req.url = requestURL
        req.method = req.method || type
        req.data = merge({}, datasource.postData, transaction.data)

        intercept(req, middlewares.concat(settings.middlewares || []).concat(datasource.middlewares || []))
        .then(() => {
          this._debug('Request:', req)
          axios(req)
          .then(res => {
            demodulate(res, modems.concat(settings.modems || []).concat(datasource.modems || []))
            .then(() => {
              this._debug('Response:', res)
              resolve(res)
            })
            .catch(reject)
          })
          .catch(reject)
        })
        .catch(reject)
      })
      .catch(reject)
    })

    return transaction.processing
  }
}

# DataManger

A data manager package which can share data among different components/application.

## Usage

```
import DataManager from './datamanager'

export default class MyComponent {
  constructor() {
    // step 1: initialize a instance
    this.datamanager = new DataManager()
    // step 2: register datasources
    this.datamanager.register({
      id: 'myid',
      url: 'http://xxx/{id}',
      transformers: [data => { return data }],
      expires: 60*1000, // 1 min
    })
    // if you want to register several datasource, you can pass an array into constructor like this:
    // this.datamanager = new DataManager([ ... ])
    // or you can register several times
    // step 3: subscribe change callbacks
    this.datamanager.subscribe('myid', params => { 
      // data is a deep copy from your subscribed data,
      // params is what you passed when you call .get(id, params)
      // you can use params to determine whether to go on,
      // for example:
      if (params.id === '111') {
        this.render()
      }
    })
    // you can subscribe several callback functions here
    // then render your ui view with data
    this.render()
  }
  render() {
    // step 4: use data from datamanager
    let data = this.datamanager.get('myid', { id: '111' })
    // here I use id='111', so that the callback function will be trigger
    // step 5: create a condition to stop program if data is not exists
    if (data === undefined) {
      return
      // don't be worry, when you call .get, data manager will request data from server side,
      // after data back, subscribed callback function will run, and .render will be call again
    }
    // do your self ui action with data
  }
}
```

Look this code, when the component initialize first time, render method will do nothing because `this.datamanager.get()` return `undefined` at this time. But it fires requesting from server side, so that when the data back, subscribed callback function will be run, and `this.render()` will be run again. The second time, it will get data directly, because data is stored in datamanager.

## Methods

### constructor(datasources, options)

To new a datamanager instance.

**datasources**

*Array*. Read more in `register`.

**options**

```
{
  expires: 10*1000, // 10ms cached
  debug: false, // console.log some internal information, now no use
}
```

### register(datasource)

Register a datasource in datamanager, notice, data source is shared with other components which use datamanager, however, transformers are not shared.

**datasource**

*object*. 

```
{
  id: '', // string, identifation of this datasource, can be only called by current instance
  url: '', // string, absolute url to request data, you can use interpolations in it, i.e. 'https://xxx/{user_name}/{id}', and when you cal `.get` method, you can pass params in the second paramater.
  type: '', // string, 'GET' or 'POST', default request method to use. default is 'GET'
  expires: 1000, // number, ms to cache your data, if set to be 0, it means you want to request data every time
  transformers: [() => {}], // [function], transform your data before getting data from data manager, you should pass a bound function or an arrow function if you use `this` in it.
}
```

### subscribe(id, callback, priority)

Add a callback function in to callback list.
Notice, when data changed (new data requested from server side), all callback functions from components will be called.

**id**

Datasource id.

**callback**

Function. Has two paramaters: `callback(data, params)`. `data` it the new data after data changed, `params` is what you passed into `get` method.

**priority**

The order of callback functions to run, the bigger ones come first. Default is 10.

### unsubscribe(id, callback)

Remove corresponding callback from corresponding datamanager, so do not use anonymous functions as possible.

If callback is undefined, all callbacks of this datasource will be removed.

You must to do this before you destroy your component, or you will face memory problem.

### get(id, params, options)

Get data from datamanager. If data is not exists, it will request data from server side and return `undefined`.
Don't be worry about several calls. If in a page has several components request a url at the same time, only one request will be sent, and all of them will get `undefined` and will be notified by subscribed callback functions.

When the data is back from server side, all component will be notified.

If `expires` is set, cache data will be used if not expired, if the cache data is expired, it will get `undefined` and request again.

**params**

To replace interpolations in `url` option. For example, your data source url is 'https://xxx/{userId}/{status}', you can do like this:

```
let data = this.datamanager.get('myid', { userId: 'lily', status: '1' })
```

**options**

Request options, if you want to use 'POST' method, do like this:

```
let data = await this.datamanager.get('myid', {}, { method: 'POST', body: { data1: 'xx' } })
```

However, your datasource.type given by `register` always cover this value. Read more from web api `fetch`.

*Notice: you do not get the latest data request from server side, you just get latest data from managed cache.*

### autorun(funcs)

Look back to the beginning code, step 3. I use subscribe to add a listener and use `if (params.id === '111')` to judge wether to run the function. After step 3, I call `this.render()`.
This operation makes me unhappy. Why not more easy?

Now you can use `autorun` to simplify it:

```
import DataManager from './datamanager'

export default class MyComponent {
  constructor() {
    this.datamanager = new DataManager()
    this.datamanager.register({
      id: 'myid',
      url: 'http://xxx/{id}',
      transformers: [data => { return data }],
      expires: 60*1000, // 1 min
    })

    this.autorun(this.render.bind(this))
    // yes! That's all!
    // you do not need to call `this.render()` again, autorun will run the function once at the first time constructor run. And you do not need to care about `params` any more.
  }
  render() {
    let data = this.datamanager.get('myid', { id: '111' })
    if (data === undefined) {
      return
    }
    // do your own ui action with data here
  }
}
```

**funcs**

Array of functions. If you pass only one function, it is ok.

### autofree(funcs)

Freed watchings which created by `autorun`. You must to do this before you destroy your component if you have called `autorun`, or you will face memory problem.

## Shared datasource

Only `type` `url` and data is shared amoung different components, when using register, you should give `type` `url` options, use these two options, we can identify a datasource. If two component register datasources with same `type` and `url`, we treat they are the same datasource, their data are shared, and when one component get data which fire requesting, the other one will be notified after data back.

In componentA:

```
this.datamanager.register({
  id: 'ida',
  url: 'aaa',
  type: 'GET',
  transformers: [(data) => { return data.a }],
})
this.datamanager.subscribe('ida', () => {
  // this function will be called when componentB use .get to request data and get new data
})
```

In componentB:

```
this.datamanager.register({
  id: 'idb',
  url: 'aaa',
  type: 'GET',
})
this.datamanager.get('idb')
```

Although the id of componentA's datamanager is 'ida', it will be notified becuase of same url+type.

Transformers and subscribe callbacks will not be confused.

**Why do we need shared datasource?**

Different component is possible to call same data source, one ajax request has no need to be call twice in a short time. Shared datasource help us to keep only one block of data if the true data source is same.

## Demo

Run a demo on your local machine:

```
npm run start:datamanager
```

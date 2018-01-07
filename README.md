# DataManger.js

A frontend data sources management resolution among different components/application.

## Install

```
npm install --save datamanager.js
```

## Usage

```
import DataManager from 'datamanager.js'

export default class MyComponent {
  constructor() {
    // step 1: initialize a instance
    this.datamanager = new DataManager({ host: 'http://localhost:3000' })
    // step 2: register datasources
    this.datamanager.register({
      id: 'myid',
      url: '/users/{id}',
      expires: 60*1000, // 1 min cache
    })
    // step 3: subscribe change callbacks
    this.datamanager.subscribe('myid', (data, params) => { 
      // params is what you passed when you call .get(id, params) or .request(id, params)
      // you can use params to determine whether to go on,
      // for example:
      if (params.id === '111') {
        this.render()
      }
    })
    
    this.render()
  }
  render() {
    // step 4: use data from datamanager
    let data = this.datamanager.get('myid', { id: '111' })
    // step 5: create a condition to stop program if data is not exists
    if (data === undefined) {
      return
      // don't be worry, when you call .get, data manager will request data from server side,
      // after data back, subscribed callback function will run, and .render will be call again
    }
    // you code here using data
    ...

    // step 4: or use .request, not .get
    // this.datamanager.request('myid', { id: '111' }).then(data => {
    //    your code here using data
    // })
  }
}
```

Look this code, when the component initialize first time, render method will do nothing because `this.datamanager.get()` return `undefined` at this time. But it fires requesting from server side, so that when the data back, subscribed callback function will be run, and `this.render()` will be run again. The second time, it will get data directly, because data is stored in datamanager.

## Methods

### constructor(options)

To new a datamanager instance.

**options**

```
{
  host: '', // string, i.e. https://yourdomain.com/api, which will be connected with your given url in component
  expires: 10*1000, // 10ms cached
  debug: false, // console.log some internal information, now no use
  requester: fetch, // function(url, options), use which library to send request, you can use axios to create a function, default using `fetch`
  interceptors: [], // [function(req, next, stop)], functions to modify request options before send
  adapters: [], // [function(res, next, stop)], functions to modify response when request success
  storage: 'sessionStorage', // which storage driver to use, default 'sessionStorage', options: localStorage, sessionStorage, object
}
```

Read more from following `config` api.

### register(datasources)

Register datasources in datamanager, notice, data is shared with other components which use datamanager, however, transformers are not shared.

It is ok if you pass only one datasource here.

**datasource**

*object*. 

```
{
  id: '', // string, identifation of this datasource, can be only called by current instance
  url: '', // string, url to request data, 
    // you can use interpolations in it, i.e. 'https://xxx/{user_name}/{id}', 
    // and when you cal `.get` method, you can pass params in the second parameter,
    // if you pass relative url, it will be connected with options.host
  type: '', // string, 'GET' or 'POST', default request method to use. default is 'GET'
  postData: {}, // if your `type` is 'POST' or 'PUT', you may want to bring with some post data when you request, set these default post data here
  transformers: [() => {}], // [function], transform your data before getting data from data manager, you should pass a bound function or an arrow function if you use `this` in it.
  interceptors: [() => {}], // [function], transform each request before it is sent
  adapters: [], // [function(res, next, stop)], functions to modify response when request success
  expires: 10*1000, // number, ms
  immediate: false, // boolean, data will be requested after being registered immediately, 
    // Notice, this datasource should have no interpolation params, it will use `this.request(id)` to request.
    // And always, there is no callback functions at this time, so the only purpose is initialize data early.
}
```

When you `.get` `.request` or `.save` data, this datasource info will be used as basic information. However `options` which is passed to .get, .request and .save will be merged into this information, and the final request information is a merged object.

### subscribe(id, callback, priority)

Add a callback function in to callback list.
Notice, when data changed (new data requested from server side), all callback functions from components will be called.

**id**

Datasource id.

**callback(data, params, options)**

Function. `params` and `options` are used to check whether the notify should affect.

```
this.datamanager.subscribe('myid', (data, params, options) => {
  if (params.userId === 112 && options.data && options.data.taskId === 'xxx') {
    console.log(data)
  }
})

this.datamanager.request('myid', { userId: 112 }, { data: { taskId: 'xxx' } })
``` 

Why it is so complex? Because a datasource may have url interpolations, or have different request options. Different request should have different response plan.

**priority**

The order of callback functions to run, the bigger ones come first. Default is 10.

### unsubscribe(id, callback)

Remove corresponding callback from corresponding datamanager, so do not use anonymous functions as possible.

If callback is undefined, all callbacks of this datasource will be removed.

You must to do this before you destroy your component, or you will face memory problem.

### request(id, params, options, force)

Request data from datamanager. If data is not exists, it will request data from server side and return a Promise instance.
Don't be worry about several calls. If in a page has several components request a url at the same time, only one request will be sent, and all of them will get the same Promise instance and will be notified by subscribed callback functions.

When the data is back from server side, all component will be notified.

If `expires` is set, cache data will be used if not expired, if the cache data is expired, it will request again which cost time (which will trigger callback).
If not set, cache will always be used if exist.

*Notice: you do not get the latest data request from server side, you just get latest data from managed cache.*

**params**

To replace interpolations in `url` option. For example, your data source url is 'https://xxx/{user}/{no}', you can do like this:

```
async function() {
  let data = await this.datamanager.request('myid', { user: 'lily', no: '1' })
}
```

Notice, here I use async/await, you can use .then.

**options**

Request options, if you want to use 'POST' method, do like this:

```
this.datamanager.get('myid', {}, { method: 'POST', data: { data1: 'xx' } }).then(data => {
  ...
})
```

If options.method is set, it will be used to cover datasource.type.

We use *axios* as request engine, the options is follow the rules of aixos. So if you want to know more about this, you should read more about [axios](https://github.com/axios/axios).

**force**

Boolean. Wether to request data directly from server side, without using local cache:

```
this.datamanager.save('myid', {}, myData).then(async () => {
  let data = await this.datamanager.request('myid', {}, {}, true)
})
```

Notice: when you forcely request, subscribers will be fired after data come back, and local cache will be update too. So it is a good way to use force request when you want to refresh local cached data.

### get(id, params, options, force)

Get data from datamanager. If data is not exists, it will request data from server side and return `undefined`.
Don't be worry about several calls. If in a page has several components request a url at the same time, only one request will be sent, and all of them will get `undefined` and will be notified by subscribed callback functions.

When the data is back from server side, all component will be notified.

If `expires` is set, cache data will be used if not expired, if the cache data is expired, it will get last cache and request again (which will trigger callback).

*Notice: you do not get the latest data request from server side, you just get latest data from managed cache.*

**params**

To replace interpolations in `url` option. For example, your data source url is 'https://xxx/{user}/{no}', you can do like this:

```
let data = this.datamanager.get('myid', { user: 'lily', no: '1' })
```

**options**

Request options, if you want to use 'POST' method, do like this:

```
let data = this.datamanager.get('myid', {}, { method: 'POST', body: { data1: 'xx' } })
```

If options.method is set, it will be used to cover datasource.type.

Follow axios' config rules.

**force**

Boolean. Wether to request data immediately.
If force is set to be 'true', you will get current cached data, but a new request will be sent to get latest data:

```
this.datamanager.save('myid', {}, myData)
let data = this.datamanager.get('myid', {}, {}, true) // get current cache, but a request will be sent
```

Notice: when you forcely request, subscribers will be fired after data come back, and local cache will be update too. So it is a good way to use force request when you want to refresh local cached data. But the return value is the latest cache, and the next time when you .get, you will get the new data.

It seems the same between `get` and `request`. In fact, it is not, there are some differences.

1. `get` can be used with `autorun`, `request` can't
2. `get` will return undefined when there is no data in local cache, `request` will request from the server side waiting for a while
3. `get` will use the last cache if the cache is expired, or use force mode, `request` will send a request waiting util the data back

### autorun(funcs)

Look back to the beginning code, step 3. I use subscribe to add a listener and use `if (params.id === '111')` to judge wether to run the function. After step 3, I call `this.render()`.
This operation makes me unhappy. Why not more easy?

Now you can use `autorun` to simplify it:

```
import DataManager from 'datamanager.js'

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

Notice: `autorun` can be only used with `get`.

**funcs**

Array of functions. If you pass only one function, it is ok.

To understand how `autorun` works, you should learn about [mobx](https://github.com/mobxjs/mobx)'s autorun first.

### autofree(funcs)

Freed watchings which created by `autorun`. You must to do this before you destroy your component if you have called `autorun`, or you will face memory problem.

### save(id, params, data, options)

To save data to server side, I provide a save method. You can use it like put/post operation:

```
this.datamanger.save('myId', { userId: '1233' }, { name: 'lily', age: 10 })
```

Notice: save method will not update the local cached data, local cached data can only be updated by `get`/`request` method after request from server side. Callbacks will not be triggered. So when you use `.save`, you should  always `get`/`request` again in `.then` to get latest data.

**id**

datasource id.

**params**

Interpolations replacements variables.

**data**

post data.

**options**

Axios config.

**@return**

This method will return a promise, so you can use `then` or `catch` to do something when request is done.

`.save` method has some rules:

1. options.data will work, it will be merged with `data` parameter, but not recommended, you should always use `data` parameter
2. options.method come before datasource.type
3. several save requests will be merged

We use a simple transaction to forbide save request being sent twice/several times in a short time. If more than one saving request happens in *10ms*, they will be merged, post data will be merged, and the final request send merged data to server side. So if one property of post data is same from two saving request, the behind data property will be used, you should be careful about this.
If you know react's `setState`, you may know more about this transaction.

In fact, a datasource which follow RestFul Api principle, the same `id` of a datasource can be used by `.get` and `.save` methods:

```
this.datamanager.register({
  id: 'myrestapi',
  ...
})
...
let data = this.datamanager.get('myrestapi')

...
this.datamanager.save('myrestapi', {}, { ...myPostData }, { method: 'POST' }) // here method:'POST' is important in this case
.then(res => {
  // you can use `res` to do some logic
})
```

## API

### config(cfgs)

To set global config. Do like this:

```
import DataManager, { config } from './datamanger'

config({ host: 'http://mywebsite.com/api' })

...
```

Why we need to set global config? Because some time we want our components in one application have same basic config.
Current default configs is:

```
{
  requester: fetch,
  host: '',
  expires: 10*1000, 
  debug: false,
  storage: 'sessionStorage', // which storage driver to use, default 'sessionStorage', options: localStorage, sessionStorage, object
}
```

It means all components will use this options when they initialize.

Notice: if you use `config` after a initailiztion, you will find the previous instances have no change, and the behind instances will use new config. However, it is recommended to use `config()` before all using.

### intercept(interceptor)

Add a new interceptor into global interceptors list, if you want to set a special interceptor in your component, use settings.interceptors to set.
A interceptor has the ability to modify request information before request has been sent.
It is useful to do authentication.

A interceptor is a function like:

```
function(req, next, stop) {
  // req.url = ...
  // req.headers = {
  //   "Content-Type": "application/json",
  // }
  next()
}
```

NOTICE: In your interceptor, you MUST run `next()` to pass `req` to next interceptor, if you do not run `next()`, the request will NEVER be sent. `stop()` will forbide the request be sent out.

### adapt(adapter)

To modify response from server side, you should use `adapters`. A adapter function should like:

```
function(res, next, stop) {
  if (res.data.status >= 300) {
    stop()
  }
  next()
}
```

This is a easy for you to check the response is what you expect.

## Shared datasource

When using register, you should give `type` `url` options, `body` may be given. We can identify a datasource with type+url+body. If two component register datasources with same type+url+body, we treat they are the same datasource, their data are shared, and when one component get data which fire requesting, the other one will be notified after data back.

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

Although the id of componentA's datamanager is 'ida', it will be notified becuase of same url+type+body.

Transformers and subscribe callbacks will not be confused, each components has its own transformers and callbacks.

**Why do we need shared datasource?**

Shared datasource help us to keep only one block of data amoung same datasources.

Different component is possible to call same data source more than once in a short time, 
datamanager will help you to merge these requests, only once request happens.

## Development

Run a demo on your local machine:

```
npm run demo
```

## Tips

You can read my idea from [here](http://www.tangshuang.net/3818.html).

1) why we don't provide a `dispatch` method to modify data in datamanager?

Because data is static context, it means data should not be changed. 
A situation about change data is that: when you save data to server side, you do not want to wait the reqeust finished, you want to update datamanager, and update views at the same time.

But in fact, a request to server side may occur errors, if the request fail, you should not update views at that time. So the recommended way is: use `.save` to update data to server side, and use `.get` to get data after request success.

2) transformers

Use transformers to convert output data to your imagine construct. Each transformer function recieve a parameter `data` so you can modify it:

```
let transform1 = data => {
  data.forEach((item, i) => item.name = i)
}
this.datamanager.register({
  ...
  transformers: [ transform1 ],
  ...
})
```

In fact, you can use `return` in transform function to replace original data:

```
function transform(data) {
  ...
  return newData
}
```

So that is it easy to use your own data.

3) interceptors

Use interceptors to modify request information before each request is sent. 
Global mode and single mode are both supported. You can use `use` api to apply a interceptor to all requests in your application, or pass a interceptor to options.interceptors when you use `.register` method.

Now let's talk about a interceptor function:

```
function myinterceptor(req, next) {}
```

`req` is the object which contains all information of a request. You can modify everything in it.
After everything is done, you MUST run `next()` to go into next interceptor, or to run the real request.
If you forget to run next(), your request will never be send. This is very important!

So you can request another datasource before a certain one, like:

```
let myfun = (req, next) => {
  this.datamanager.get('myOauth', {}, {}, true).then(authData => {
    req.headers = merge({}, req.headers, {
      'X-auth': authData,
    })
    next()
  })
}
this.datamanger.register({
  ...
  interceptors: [ myfun ],
})
```

Here I use force `get` to get a authData and use it as headers info to send my request.
Order of interceptors: use(interceptor) > constructor(options.interceptors) > .register(options.interceptors).
interceptors will not shared amoung different instances.

4) deep cloned data

When you use `.get` to get data from datamanager, you get a deep cloned data.
It means your modifying this data will not affect other components' data.

If you want to get same data structure for several components, you should share transformers amoung these components.

5) how to choose `get` or `request`

Normally, `request` is more easy to understand. If you just want to use datamanager as a requester which has anti-shake feature amoung some requests during a short time, you should just choose `request`. And use `subscribe` to do something if you want to be triggered when data come back from server side when other components request the some datasource.

```
const ComponentA = (props) => ({
  init(props) {
    this.datamanager = new DataManager()
    ...
    // notified by other components, when another component request the some data source and get data, ComponentA will update
    this.datamanager.subscribe(id, () => {
      this.update()
    })
    // run by myself
    this.update()
  },
  update() {
    this.datamanager.request(id, params).then(data => {
      this.data = data
      this.render()
    })
  },
  render() {},
})
```

This is easy to understand. However, if you want to be more geek, use `get` and `autorun`. You should know more knowledge about moderm Obsever Mode implementation, for example Redux, Mobx, VueJS and so on.

```
const ComponentA = (props) => ({
  init(props) {
    this.datamanager = new DataManager()
    ...
    this.datamanager.autorun(this.update.bind(this))
  },
  update() {
    let data = this.datamanager.get(id, params)
    if (data === undefined) {
      return
    }
    this.data = data
    this.render()
  },
  render() {},
})
```

However, `get` can be used with `subscribe`.

They are in two different idea. So choose what you like or which you can easliy understand.

6) Shared instance

To develop an application, you may want to use a single datamanager instance in your application, so that all modules share one list of datasources. Do like this:

```
// datamanager.js
const datamanager = new DataManager()
datamanager.register([ ... ])

export default datamanager
```

And in other modules, you can do:

```
// componentA.js
import datamanager from './datamanager'

function render() {
  let user = datamanager.get('user') // here, you do not need to know how datamanager instance implemenet, you just use its api
  if (user === undefined) {
    return
  }
  console.log(user)
}
datamanager.autorun(render)
```

Or in your application:

```
// app.js
import datamanager from './datamanager'
import ComponentB from './ComponentB'

const B = new ComponentB()

function update() {
  let data = datamanager.get('list')
  if (data === undefined) {
    return
  }
  B.update(data)
}

B.render()
datamanager.autorun(update)
```

It is a little like redux's store, you always use only instance in an application.

## MIT License

Copyright 2017 tangshuang

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
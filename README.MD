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
  host: '', // string, i.e. https://yourdomain.com/api, which will be connected with your given url in component
  expires: 10*1000, // 10ms cached
  debug: false, // console.log some internal information, now no use
  requester: fetch, // function(url, options), use which library to send request, you can use axios to create a function, default using `fetch`
  middlewares: [], // [function(options, next)], middlewares to modify request options before send, read more from `middleware` api.
}
```

Read more from following `config` api.

### register(datasource)

Register a datasource in datamanager, notice, data source is shared with other components which use datamanager, however, transformers are not shared.

**datasource**

*object*. 

```
{
  id: '', // string, identifation of this datasource, can be only called by current instance
  url: '', // string, url to request data, 
    // you can use interpolations in it, i.e. 'https://xxx/{user_name}/{id}', 
    // and when you cal `.get` method, you can pass params in the second paramater,
    // if you pass relative url, it will be connected with options.host
  type: '', // string, 'GET' or 'POST', default request method to use. default is 'GET'
  body: {}, // if your `type` is 'POST', you may want to bring with some post data when you request, set these default post data here
  transformers: [() => {}], // [function], transform your data before getting data from data manager, you should pass a bound function or an arrow function if you use `this` in it.
}
```

When you `.get` or `.save` data, this datasource info will be used as basic information. However `options` which is passed to .get and .save will be merged into this information, and the final request information is a merged object.

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

To replace interpolations in `url` option. For example, your data source url is 'https://xxx/{user}/{no}', you can do like this:

```
let data = this.datamanager.get('myid', { user: 'lily', no: '1' })
```

**options**

Request options, if you want to use 'POST' method, do like this:

```
let data = await this.datamanager.get('myid', {}, { method: 'POST', body: { data1: 'xx' } })
```

If options.method is set, it will be used to cover datasource.type.

However, your datasource.type given by `register` always cover this value. Read more from web api `fetch`.

*Notice: you do not get the latest data request from server side, you just get latest data from managed cache.*

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

**funcs**

Array of functions. If you pass only one function, it is ok.

### autofree(funcs)

Freed watchings which created by `autorun`. You must to do this before you destroy your component if you have called `autorun`, or you will face memory problem.

### save(id, params, data, options)

To save data to server side, I provide a save method. You can use it like put/post operation:

```
this.datamanger.save('myId', { userId: '1233' }, { name: 'lily', age: 10 })
```

Notice: save method will not update the local cached data, local cached data can only be updated by `.get` method after request from server side. So when you use `.save`, you should  always `.get` again in `.then`.

**id**

datasource id.

**params**

Interpolations replacements variables.

**data**

post data.

**options**

`fetch` options.

**@return**

This method will return a promise, so you can use `then` or `catch` to do something when request is done.

`.save` method has some rules:

1. options.body will not work, instead of `data`
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
}
```

It means all components will use this options when they initialize.

Notice: if you use `config` after a initailiztion, you will find the previous instances have no change, and the behind instances will use new config.

### middleware(mw)

Add a new middleware into global middlewares list, if you want to set a special middleware in your component, use settings.middlewares to set.
A middleware has the ability to modify request options (`fetch(url, options)`'s options) before request has been sent.
It is useful to do authentication.

A middleware is a function like:

```
function(options, next) {
  // options.headers = {
  //   "Content-Type": "application/json",
  // }
  next()
}
```

In your middleware, you should run `next()` if you want to pass options to next middleware, if you do not run `next()`, the request will be sent after this middleware is executed.

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
npm run start
```

## MIT License

Copyright 2017 tangshuang

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
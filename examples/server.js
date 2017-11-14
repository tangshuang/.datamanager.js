var express = require('express')
var app = express()
var open = require('open')

var data = () => ([
  {
    name: 'lily',
    score: 128,
  },
  {
    name: 'gaofei',
    score: 140,
  },
  {
    name: 'jojo',
    score: 129,
  },
  {
    name: 'babi (has random score)',
    score: parseInt(Math.random() * 1000),
  },
])

app.get('/students', (req, res) => {
  res.json(data())
})
app.get('/*', express.static(__dirname))

open('http://localhost:3999')

app.listen('3999')
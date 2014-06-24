var sequest = require('../')
  , tape = require('tape')
  , user = process.env.USER
  , host = user+'@localhost'
  , child_process = require('child_process')
  , exec = child_process.exec
  , path = require('path')
  , rimraf = require('rimraf')
  , bl = require('bl')
  , fs = require('fs')
  , testFile = path.join(__dirname, 'test-get-put.js')
  ;

tape('put', function (t) {
  t.plan(1)
  var p = path.join(__dirname, '__test-put-file')
    , f = fs.createReadStream(testFile)
    , s = f.pipe(sequest.put(host, p))
    , b1 = bl()
    ;
  f.pipe(b1)
  s.on('close', function () {
    var b2 = bl()
      , f = fs.createReadStream(p)
      ;
    f.pipe(b2)
    f.on('end', function () {
      t.equal(b1.toString(), b2.toString())
    })
  })
})

tape('get', function (t) {
  t.plan(1)
  var s = sequest.get(host, testFile)
    , f = fs.createReadStream(testFile)
    , b1 = bl()
    , b2 = bl()
    ;
  s.pipe(b1)
  f.pipe(b2)
  s.on('end', function () {
    t.equal(b1.toString(), b2.toString())
  })
})

tape('cleanup', function (t) {
  rimraf.sync(path.join(__dirname, '__test-put-file'))
  t.end()
})

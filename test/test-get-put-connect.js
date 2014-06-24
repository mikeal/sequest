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
  , testFile = path.join(__dirname, 'test-get-put-connect.js')
  , c = sequest.connect(host)
  ;

tape('put connect', function (t) {
  t.plan(1)
  var p = path.join(__dirname, '__test-put-file2')
    , f = fs.createReadStream(testFile)
    , s = f.pipe(c.put(p))
    , b1 = bl()
    ;
  f.pipe(b1)
  s.on('close', function () {
    setTimeout(function () {
      var b2 = bl()
        , f = fs.createReadStream(p)
        ;
      f.pipe(b2)
      f.on('end', function () {
        t.equal(b1.toString(), b2.toString())
      })
    }, 500)

  })
})

tape('get connect', function (t) {
  t.plan(1)
  var s = c.get(testFile)
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
  rimraf.sync(path.join(__dirname, '__test-put-file2'))
  c.end()
  t.end()
})

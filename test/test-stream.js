var sequest = require('../')
  , tape = require('tape')
  , user = process.env.USER
  , host = user+'@localhost'
  , child_process = require('child_process')
  , exec = child_process.exec
  , path = require('path')
  , rimraf = require('rimraf')
  , bl = require('bl')
  ;

tape('streamed ls', function (t) {
  t.plan(2)
  var command = 'ls '+__dirname
    , touchTest = 'touch '+__dirname+'/__testfile'
    ;

  exec(command, function (e, stdout) {
    if (e) throw e
    var expected = stdout
    var s = sequest(host)
    var output = bl()
    s.pipe(output)

    s.write(command)
    s.write(touchTest)
    s.write(command)
    s.on('error', function (e) {
      throw e
    })

    setTimeout(function () {
      exec(command, function (e, stdout) {
        t.equal(output.toString(), expected + stdout)
        expected = expected + stdout + stdout
        s.write(command)
        setTimeout(function () {
          t.equal(output.toString(), expected)
          s.end()
        }, 500)
      })
    }, 500)
  })
})

tape('error in middle', function (t) {
  t.plan(1)
  var command = 'ls '+__dirname

  exec(command, function (e, stdout) {
    if (e) throw e
    var expected = stdout
    var s = sequest(host)
    var output = bl()
    s.pipe(output)

    s.write(command)
    s.write('totallyMadeUpThing')
    s.write(command)
    s.on('error', function (e) {
      var outs = output.toString()
      t.equal(outs, expected)
    })
  })
})

tape('cleanup', function (t) {
  rimraf.sync(path.join(__dirname, '__testfile'))
  t.end()
})

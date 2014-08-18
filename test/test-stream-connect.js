var sequest = require('../')
  , tape = require('tape')
  , user = process.env.USER
  , host = user+'@localhost'
  , child_process = require('child_process')
  , exec = child_process.exec
  , path = require('path')
  , rimraf = require('rimraf')
  , bl = require('bl')
  , c = sequest.connect(host)
  ;

tape('connected streamed ls', function (t) {
  t.plan(2)
  var command = 'ls '+__dirname
    , touchTest = 'touch '+__dirname+'/__testfile2'
    ;

  exec(command, function (e, stdout) {
    if (e) throw e
    var expected = stdout
    var s = c()
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

tape('connected error in middle', function (t) {
  t.plan(2)
  var command = 'ls '+__dirname

  exec(command, function (e, stdout) {
    if (e) throw e
    var expected = stdout
    var s = c()
    var output = bl()
    s.pipe(output)

    s.write(command)
    s.write('totallyMadeUpThing')
    s.write(command)
    s.on('error', function (e) {
      var outs = output.toString()
      t.equal(outs, expected)

      // make sure the error didn't close the connection
      c(command, function (e, stdout) {
        if (e) throw e
        t.equal(stdout, expected)
      })
    })
  })
})

tape('cleanup', function (t) {
  c.end()
  rimraf.sync(path.join(__dirname, '__testfile2'))
  t.end()
})

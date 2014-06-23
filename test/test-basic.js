var sequest = require('../')
  , tape = require('tape')
  , user = process.env.USER
  , host = user+'@localhost'
  , child_process = require('child_process')
  , exec = child_process.exec
  ;

tape('basic ls', function (t) {
  t.plan(1)
  var command = 'ls -la '+__dirname
  sequest(host, command, function (e, output) {
    if (e) throw e
    exec(command, function (e, stdout) {
      if (e) throw e
      // linux ls sorts non-deterministically
      stdout = stdout.split(/\n/).sort().join(/\n/)
      output = output.split(/\n/).sort().join(/\n/)
      t.equal(stdout, output)
    })
  })
})

tape('connect', function (t) {
  var command = 'ls -la '+__dirname
  var seq = sequest.connect(host)
  t.plan(2)
  seq(command, function (e, output) {
    if (e) throw e
    t.ok(true)
    seq(command, function (e, output) {
      if (e) throw e
      t.ok(true)
      seq.end()
    })
  })
})

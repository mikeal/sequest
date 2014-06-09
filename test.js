var sequest = require('./')
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
      t.equal(stdout, output)
    })
  })
})

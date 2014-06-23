## Sequest -- Simple ssh client API, inspired by request

```javascript
var sequest = require('sequest')
sequest('root@127.0.0.1', 'ls' function (e, stdout) {
  if (e) throw e
  console.log(stdout.split('\n'))
})
```

A simpler/faster way to do many commands against the same host.

```javascript
var seq = sequest('root@127.0.0.1')
seq('ls', function (e, stdout) {
  seq('ls '+stdout.split('\n')[0], function (e, stdout) {
    console.log(stdout.split('\n'))
    seq.end() // will keep process open if you don't end it
  })
})
```

#### Continuous mode

```javascript
var seq = sequest('root@127.0.0.1')
seq.pipe(process.stdout)
seq.write('ls -la')
seq.write('touch testfile')
seq.write('ls -la')
seq.end()
```

Each command will complete before the next is sent to the server. If any command returns a non-zero exit code it will emit an error which effectively ends the stream and the processing of subsequent commands.

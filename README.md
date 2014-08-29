## Sequest -- Simple ssh client

## `sequest(host[, command[, opts]])`

By default sequest will use your local `ssh-agent` to authenticate to remote hosts which should make it unnecessary to enter username, password or privateKey information.

```javascript
var sequest = require('sequest')
sequest('root@127.0.0.1', 'ls', function (e, stdout) {
  if (e) throw e
  console.log(stdout.split('\n'))
})
```

### Continuous mode

```javascript
var seq = sequest('root@127.0.0.1')
seq.pipe(process.stdout) // only necessary if you want to see the output in your terminal
seq.write('ls -la')
seq.write('touch testfile')
seq.write('ls -la')
seq.end()
```

Each command will complete before the next is sent to the server. If any command returns a non-zero exit code it will emit an error which effectively ends the stream and the processing of subsequent commands.

### Connection Options

Accepts all [ssh2 connection options](https://github.com/mscdex/ssh2#connection-methods), most of which are unnecessary as you can define user and host information in the host string and because `ssh-agent` authentication is used when not supplying a `privateKey`.

The most common are listed below.

* **username** - < _string_ > - Username for authentication. **Default:** (none)

* **password** - < _string_ > - Password for password-based user authentication. **Default:** (none)

* **agent** - < _string_ > - Path to ssh-agent's UNIX socket for ssh-agent-based user authentication. `sequest` defaults this to `process.env.SSH_AUTH_SOCK`.

* **privateKey** - < _mixed_ > - Buffer or string that contains a private key for key-based user authentication (OpenSSH format). **Default:** (none)

* **passphrase** - < _string_ > - For an encrypted private key, this is the passphrase used to decrypt it. **Default:** (none)

* **publicKey** - < _mixed_ > - Optional Buffer or string that contains a public key for key-based user authentication (OpenSSH format). If `publicKey` is not set, it will be generated from the `privateKey`. **Default:** (none)

#### Custom options

* **proxy** - < _string_ > - Host to proxy connection through. **Default:** (none) :: (e.g `root@72.9.543.901`)

### Using options

```javascript
var fs = require('fs')
var sequest = require('sequest')
// Load privateKey synchronously
var key = fs.readFileSync(process.env.HOME + '/.ssh/id_rsa')

// Callback API
sequest('root@10.555.44.99', {
  command: 'uptime',
  proxy: 'root@72.9.543.901',
  privateKey: key
  }, function (err, stdout) {
    if (err) console.error(err)
    console.log(stdout)
})

// Streaming api
var seq = sequest('root@19.555.44.99', { proxy: 'root@72.9.543.901'})
seq.pipe(process.stdout);
seq.write('ifconfig')

```

## `.connect(host[, opts])`

Convenience API for making several calls to the same host.

```javascript
var seq = sequest.connect('root@127.0.0.1')
seq('ls', function (e, stdout) {
  seq('ls '+stdout.split('\n')[0], function (e, stdout) {
    console.log(stdout.split('\n'))
    seq.end() // will keep process open if you don't end it
  })
})
```

## `.get(host, path[, opts])`
### get remote file

```javascript
var reader = sequest.get('root@127.0.0.1', '/remote/path/to/file')
reader.pipe(process.stdout)
```

Also works with `.connect()`

```javascript
var c = sequest.connect('root@127.0.0.1')
  , reader = c.get('/remote/path/to/file')
  ;
reader.pipe(process.stdout)
```

Default options, as defined by [ssh2](https://github.com/mscdex/ssh2#sftp-methods), are as follows:

```javascript
{ flags: 'r',
  encoding: null,
  mode: 0666,
  bufferSize: 64 * 1024
}
```


## `.put(host, path[, opts])`
### write remote file

```javascript
var writer = sequest.put('root@127.0.0.1', '/remote/path/to/file')
fs.createReadStream('/local/path').pipe(writer)
writer.on('close', function () {
  // finished writing.
})
```

Also works with `.connect()`

```javascript
var c = sequest.connect('root@127.0.0.1')
  , writer = c.put('/remote/path/to/file')
  ;
fs.createReadStream('/local/path').pipe(writer)
writer.on('close', function () {
  // finished writing.
})
```

Default options, as defined by [ssh2](https://github.com/mscdex/ssh2#sftp-methods), are as follows:

```javascript
{ flags: 'w',
  encoding: null,
  mode: 0666,
  autoClose: true
}
```

## Credits

This would not be possible without [Brian White](https://github.com/mscdex)'s amazing [ssh2](https://github.com/mscdex/ssh2) module.

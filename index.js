var Connection = require('ssh2')
  , stream = require('stream')
  , util = require('util')
  , bl = require('bl')
  ;

function getConnection (str, opts) {
  var user = 'root'
    , port = 22
    , host
    ;
  if (str.indexOf('@') !== -1) {
    user = str.slice(0, str.indexOf('@'))
    str = str.slice(str.indexOf('@')+1)
  }
  if (str.indexOf(':') !== -1) {
    port = str.slice(str.indexOf(':')+1)
    port = parseInt(port)
    str = str.slice(0, str.indexOf(':'))
  }
  host = str
  var conn = new Connection()
    , copts =
      { host: host,
        port: port,
        username: user
      }
    ;
  if (opts.privateKey) {
    copts.privateKey = opts.privateKey
  } else {
    copts.agent = opts.agent || process.env.SSH_AUTH_SOCK
  }

  conn.connect(copts)
  return conn
}

function Sequest (conn, opts, cb) {
  stream.Duplex.call(this)
  if (!opts) {
    opts = {continuous:true}
  } else {
    if (typeof opts === 'string') {
      if (opts[0] === '/') opts = {path:opts} // file path
      else opts = {command:opts}
    }
  }

  if (typeof conn === 'string') {
    var conn = getConnection(conn, opts)
  }

  this.connection = conn
  this.opts = opts
  this.cb = cb
  this.queue = []
  this.dests = []
  this.sources = []

  if (conn._state !== 'authenticated') {
    this.connection.on('ready', this.onConnectionReady.bind(this))
  } else {
    this.onConnectionReady()
  }
  this.on('pipe', this.sources.push.bind(this.sources))
}
util.inherits(Sequest, stream.Duplex)

Sequest.prototype.onConnectionReady = function () {
  var self = this
  this.isReady = true
  if (this.opts.command) {
    this.write(this.opts.command)
    var cb = this.cb
    if (cb) {
      this.once('exec', function (e, cmd, code, signal, stdout, stderr) {
        var o = {cmd:cmd, code:code, signal:signal, stderr:stderr}
        if (e) return cb(e, stdout, o)
        if (code !== 0) {
          e = new Error('Exit code is non-zero.')
          e.code = code
          e.signal = signal
          return cb(e, stdout, o)
        }
        cb(e, stdout, o)
      })
    }
    this.once('exec', function (e) {
      if (e) self.emit('error', e)
      else self.emit('end')
    })
  }
}
Sequest.prototype.__write = function (chunk, encoding, cb) {
  var self = this
  if (this.opts.command || this.opts.continuous) {
    var cmd = chunk.toString()
    this.connection.exec(cmd, function (e, stream) {
      if (e) {
        self.emit('exec', e, cmd)
        return cb(e)
      }
      self._pipeDests(stream)
      if (self.cb) {
        var stdout = bl()
          , stderr = bl()
          , signal
          , code
          ;
        stream.pipe(stdout)
        if (stream.stderr) stream.stderr.pipe(stderr)
        stream.on('exit', function (_code, _signal) {
          signal = _signal
          code = _code
        })
        stream.on('close', function () {
          self.emit('exec', e, cmd, code, signal, stdout.toString(), stderr.toString())
          if (self.opts.command) self.connection.end()
        })
      }
    })
  } else if (this.path) {
    this.push(chunk)
    cb()
  }
}
Sequest.prototype._write = function (chunk, encoding, cb) {
  if (!this.isReady) {
    this.queue.push([chunk, encoding, cb])
  } else {
    this.__write(chunk, encoding, cb)
  }
}
Sequest.prototype.pipe = function () {
  this.dests.push(arguments[0])
  stream.Duplex.prototype.pipe.apply(this, arguments)
}
Sequest.prototype._pipeDests = function (stream) {
  this.dests.forEach(function (dest) {
    stream.pipe(dest, {end:false})
  })
}

function sequest (remote, command, cb) {
  return new Sequest(remote, command, cb)
}
module.exports = sequest

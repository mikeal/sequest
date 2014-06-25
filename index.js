var Connection = require('ssh2')
  , stream = require('stream')
  , util = require('util')
  , bl = require('bl')
  , once = require('once')
  ;

function getConnection (str, opts) {
  var user = 'root'
    , port = 22
    , host
    ;
  opts = opts || {}
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
  if (cb) this.cb = once(cb)
  this.queue = []
  this.dests = []
  this.sources = []
  this.bufferStream = new stream.PassThrough()

  if (conn._state !== 'authenticated') {
    var self = this
    this.onError = function (e) { self.emit('error', e) }
    this.connection.on('error', this.onError)
    this.connection.on('ready', this.onConnectionReady.bind(this))
  } else {
    this.onConnectionReady()
  }
  this.on('pipe', this.sources.push.bind(this.sources))
  if (this.cb) this.on('error', this.cb)
}
util.inherits(Sequest, stream.Duplex)

Sequest.prototype.onConnectionReady = function () {
  var self = this
  this.isReady = true
  if (this.onError) this.removeListener('error', this.onError)
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
    } else {
      this.once('exec', function (e) {
        if (e) self.emit('error', e)
        else self.emit('end')
      })
    }
  } else if (this.opts.continuous) {
    if (this.pending) this.__write.apply(this, this.pending)
  }
}
Sequest.prototype.__write = function (chunk, encoding, cb) {
  var self = this
  if (this.opts.command || this.opts.continuous) {
    var cmd = chunk.toString()
    this.executing = true
    this.connection.exec(cmd, function (e, stream) {
      self.executing = false
      if (e) {
        self.emit('exec', e, cmd)
        return cb(e)
      }
      self._pipeDests(stream)
      
      // Don't buffer data that is not consumed when we are handling with callback interface
      if (!self.cb) stream.pipe(self.bufferStream, {end:false})
      
      var signal
        , code
        ;
      if (self.cb) {
        var stdout = bl()
          , stderr = bl()
          ;
        stream.pipe(stdout)

        if (stream.stderr) stream.stderr.pipe(stderr)
        stream.on('exit', function (_code, _signal) {
          signal = _signal
          code = _code
        })
        stream.on('close', function () {
          self.emit('exec', e, cmd, code, signal, stdout.toString(), stderr.toString())
          if (self.opts.command && !self.leaveOpen) self.connection.end()
          cb()
        })
      } else {
        if (e) {
          if (!self.leaveOpen) self.connection.end()
          return self.emit('error', e)
        }
        stream.on('exit', function (_code, _signal) {
          signal = _signal
          code = _code
          if (code) {
            if (!self.leaveOpen) self.connection.end()
            return self.emit('error', new Error('Exit code non-zero, '+code))
          }
        })
        stream.on('close', function () {
          self.emit('exec', e, cmd, code, signal)
          if (!code) cb()
        })
      }
    })
  } else if (this.path) {
    // TODO: implement sftp push
  }
}
Sequest.prototype._write = function (chunk, encoding, cb) {
  if (!this.isReady) {
    this.pending = [chunk, encoding, cb]
  } else {
    this.__write(chunk, encoding, cb)
  }
}
Sequest.prototype._read = function (size) {
  return this.bufferStream.read(size)
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
Sequest.prototype.end = function () {
  if (!this.leaveOpen) this.connection.end()
  stream.Duplex.prototype.end.apply(this, arguments)
}

function sequest (remote, command, cb) {
  return new Sequest(remote, command, cb)
}
module.exports = sequest
module.exports.getConnection = getConnection
module.exports.connect = function (host, opts) {
  var conn = getConnection(host, opts)
  function ret () {
    var args = [conn].concat(Array.prototype.slice.call(arguments))
      , r = sequest.apply(sequest, args)
      ;
    r.leaveOpen = true
    if (r.onCall) r.onCall(r)
    if (ret.onError) r.on('error', ret.onError)
    return r
  }
  ret.end = function () {conn.end()}
  ret.put = function () {
    var args = [conn].concat(Array.prototype.slice.call(arguments))
      , r = sequest.put.apply(sequest, args)
      ;
    r.leaveOpen = true
    if (r.onCall) r.onCall(r)
    if (ret.onError) r.on('error', ret.onError)
    return r
  }
  ret.get = function () {
    var args = [conn].concat(Array.prototype.slice.call(arguments))
      , r = sequest.get.apply(sequest, args)
      ;
    r.leaveOpen = true
    if (r.onCall) r.onCall(r)
    if (ret.onError) r.on('error', ret.onError)
    return r
  }
  return ret
}

function SequestPut (conn, opts, path) {
  stream.PassThrough.call(this)
  if (!path) {
    path = opts
    opts = {}
  }
  if (typeof conn === 'string') {
    var conn = getConnection(conn, opts)
  }

  this.connection = conn
  this.opts = opts
  this.path = path
  var self = this
  if (conn._state !== 'authenticated') {
    this.connection.on('ready', this.onConnectionReady.bind(this))
  } else {
    process.nextTick(function () {
      self.onConnectionReady()
    })
  }
}
util.inherits(SequestPut, stream.PassThrough)
SequestPut.prototype.onConnectionReady = function () {
  var self = this
  this.connection.sftp(function (err, sftp) {
    if (err) self.emit('error', err)
    var stream = sftp.createWriteStream(self.path, self.opts)
    self.pipe(stream)
    self.stream = stream
    stream.on('error', function (e) {
      self.emit('error', e)
    })
    stream.on('close', function () {
      self.emit('close')
      if (!self.leaveOpen) self.connection.end()
    })
  })
}

function SequestGet (conn, opts, path) {
  SequestPut.call(this, conn, opts, path)
}
util.inherits(SequestGet, SequestPut)
SequestGet.prototype.onConnectionReady = function () {
  var self = this
  this.connection.sftp(function (err, sftp) {
    if (err) self.emit('error', err)
    var stream = sftp.createReadStream(self.path, self.opts)
    stream.pipe(self)
    self.stream = stream
    stream.on('error', function (e) {
      self.emit('error', e)
    })
    if (!self.leaveOpen) {
      self.on('end', function () {
        self.connection.end()
      })
    }
  })
}
SequestGet.prototype.end = stream.PassThrough.prototype.end


module.exports.put = function (conn, path, opts) {
  return new SequestPut(conn, opts, path)
}
module.exports.get = function (conn, path, opts) {
  return new SequestGet(conn, opts, path)
}

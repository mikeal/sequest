var EE = require('events').EventEmitter
  , util = require('util')
  , SSH = require('ssh2')
  , extend = util._extend
  ;

// A simple shallow copy
function copy (obj) {
  return extend({}, obj)
}

function connectOpts (opts) {
  var keys = Object.keys(opts)
    , length = keys.length
    , obj = {}
    ;

  for(var i=0; i<length; i++)
    if (keys[i] !== 'host')
      obj[keys[i]] = opts[keys[i]]


  return obj;
}

function Connection (options) {
  EE.call(this);
  options = options || {}

  this.options = options
  this.proxyOpts = options.proxy
    ? copy(options.proxy)
    : undefined

  // simulate state of underlying connections
  this._state = 'closed'

  if (this.proxyOpts && options.privateKey) {
    this.proxyOpts.privateKey = options.privateKey
    if (options.passphrase)
      this.proxyOpts.passphrase = options.passphrase
  }

  if (this.proxyOpts)
    this.proxyConnect()
  else
    this.connect(this.options)

  return this
}

util.inherits(Connection, EE);

Connection.prototype.connect = function (opts) {
  this.connection = new SSH()

  this.connection.on('error', this.emit.bind(this, 'error'))
  this.connection.on('ready', this._onReady.bind(this))

  this.connection.connect(opts)
}

Connection.prototype.proxyConnect = function () {
  this.proxy = new SSH()

  this.proxy.on('error', this.emit.bind(this, 'error'))
  this.proxy.on('ready', this._onProxyConnect.bind(this))

  this.proxy.connect(this.proxyOpts)
}

Connection.prototype._onProxyConnect = function () {
  var self = this
    , host = this.options.host
    , port = this.options.port
    , opts = connectOpts(this.options)
    ;

  this.connection = new SSH()
  this.proxy.exec(['nc', host, port].join(' '), function (err, stream) {
    if (err) {
      self.emit('error', err)
      return self.proxy.end()
    }
    opts.sock = stream;
    self.connect(opts);
  })

}

Connection.prototype._onReady = function () {
  this._state = 'authenticated';
  this.emit('ready');
}

// Pass through functions
Connection.prototype.exec = function () {
  return this.connection.exec.apply(this.connection, arguments);
}

Connection.prototype.sftp = function () {
  return this.connection.sftp.apply(this.connection, arguments);
}

Connection.prototype.end = function () {
  this._state = 'closed'
  return this.proxy ? this.proxy.end() : this.connection.end()
}

module.exports = Connection;

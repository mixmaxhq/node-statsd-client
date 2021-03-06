/*
 * Set up the statsd-client.
 *
 * Requires the `hostname`. Options currently allows for `port` and `debug` to
 * be set.
 */
function StatsDClient(options) {
  this.options = options || {};
  this._helpers = undefined;

  this.options.tags = this.options.tags || {};

  // Set defaults
  this.options.prefix = this.options.prefix || '';

  // Prefix?
  if (this.options.prefix && this.options.prefix !== '') {
    // Add trailing dot if it's missing
    const p = this.options.prefix;
    this.options.prefix = p[p.length - 1] === '.' ? p : p + '.';
  }

  // Figure out which socket to use
  if (this.options._socket) {
    // Re-use given socket
    this._socket = this.options._socket;
  } else if (this.options.tcp) {
    //User specifically wants a tcp socket
    this._socket = new (require('./TCPSocket'))(this.options);
  } else if (this.options.host && this.options.host.match(/^http(s?):\/\//i)) {
    // Starts with 'http://', then create a HTTP socket
    this._socket = new (require('./HttpSocket'))(this.options);
  } else {
    // Fall back to a UDP ephemeral socket
    this._socket = new (require('./EphemeralSocket'))(this.options);
  }
}

/*
 * Get a "child" client with a sub-prefix.
 */
StatsDClient.prototype.getChildClient = function getChildClient(extraPrefix) {
  return new StatsDClient({
    prefix: this.options.prefix + extraPrefix,
    _socket: this._socket,
    tags: this.options.tags,
  });
};

/*
 * gauge(name, value, tags)
 */
StatsDClient.prototype.gauge = function gauge(name, value, tags) {
  this._socket.send(this.options.prefix + name + ':' + value + '|g' + this.formatTags(tags));

  return this;
};

/*
 * gaugeDelta(name, delta, tags)
 */
StatsDClient.prototype.gaugeDelta = function gaugeDelta(name, delta, tags) {
  const sign = delta >= 0 ? '+' : '-';
  this._socket.send(
    this.options.prefix + name + ':' + sign + Math.abs(delta) + '|g' + this.formatTags(tags)
  );

  return this;
};

/*
 * set(name, value, tags)
 */
StatsDClient.prototype.set = function set(name, value, tags) {
  this._socket.send(this.options.prefix + name + ':' + value + '|s' + this.formatTags(tags));

  return this;
};

/*
 * counter(name, delta, tags)
 */
StatsDClient.prototype.counter = function counter(name, delta, tags) {
  this._socket.send(this.options.prefix + name + ':' + delta + '|c' + this.formatTags(tags));

  return this;
};

/*
 * increment(name, [delta=1], tags)
 */
StatsDClient.prototype.increment = function increment(name, delta, tags) {
  this.counter(name, Math.abs(delta === undefined ? 1 : delta), tags);

  return this;
};

/*
 * decrement(name, [delta=-1], tags)
 */
StatsDClient.prototype.decrement = function decrement(name, delta, tags) {
  this.counter(name, -1 * Math.abs(delta === undefined ? 1 : delta), tags);

  return this;
};

/*
 * timing(name, date-object | ms, tags)
 */
StatsDClient.prototype.timing = function timing(name, time, tags) {
  // Date-object or integer?
  const t = time instanceof Date ? new Date() - time : time;

  this._socket.send(this.options.prefix + name + ':' + t + '|ms' + this.formatTags(tags));

  return this;
};

/*
 * histogram(name, value, tags)
 */
StatsDClient.prototype.histogram = function histogram(name, value, tags) {
  this._socket.send(this.options.prefix + name + ':' + value + '|h' + this.formatTags(tags));

  return this;
};

/*
 * formatTags(tags)
 */
StatsDClient.prototype.formatTags = function formatTags(metric_tags) {
  const tags = {};

  // Merge global tags and metric tags.
  // Metric tags overwrite global tags for the same key.
  let key;
  for (key in this.options.tags) {
    tags[key] = this.options.tags[key];
  }
  for (key in metric_tags) {
    tags[key] = metric_tags[key];
  }

  if (!tags || Object.keys(tags).length === 0) {
    return '';
  }
  return (
    '|#' +
    Object.keys(tags)
      .map(function(key) {
        return key + ':' + tags[key];
      })
      .join(',')
  );
};

/*
 * Send raw data to the underlying socket. Useful for dealing with custom
 * statsd-extensions in a pinch.
 */
StatsDClient.prototype.raw = function raw(rawData) {
  this._socket.send(rawData);

  return this;
};

/*
 * Close the socket, if in use and cancel the interval-check, if running.
 */
StatsDClient.prototype.close = function close() {
  this._socket.close();

  return this;
};

// Load the helpers explicitly to facilitate easier type inference in type systems like Flow.
const loadHelpers = (statsd) => ({
  getExpressMiddleware: require('./helpers/getExpressMiddleware.js')(statsd),
  wrapCallback: require('./helpers/wrapCallback.js')(statsd),
});
let helpers;

/*
 * Return an object with available helpers.
 */
Object.defineProperty(StatsDClient.prototype, 'helpers', {
  get() {
    if (!helpers) {
      helpers = loadHelpers(this);
    }

    return helpers;
  },
});

module.exports = StatsDClient;

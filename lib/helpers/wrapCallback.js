/*
 * Return a wrapped callback function shimmed to send metrics
 * once it is invoked. The returned function is to be used
 * exactly the same way as the original callback.
 */
function factory(parentClient) {
  return function(prefix, callback, options) {
    options = options || {};

    const client = parentClient.getChildClient(prefix);
    const startTime = new Date();
    const tags = options.tags || {};

    return function(error) {
      if (error) {
        client.increment('err', 1, tags);
      } else {
        client.increment('ok', 1, tags);
      }
      client.timing('time', startTime, tags);
      return callback.apply(null, arguments);
    };
  };
}

module.exports = factory;

/* A small fake UDP-server.
 */
function MessageCollector() {
  this._packetsReceived = [];
  this._expectedPackets = [];
}

MessageCollector.prototype.addMessage = function(msg) {
  const that = this;
  msg
    .toString()
    .split('\n')
    .forEach(function(part) {
      that._packetsReceived.push(part);
    });
  this.checkMessages();
};

/* Expect `message` to arrive and call `cb` if/when it does.
 */
MessageCollector.prototype.expectMessage = function(message, cb) {
  const that = this;
  this._expectedPackets.push({
    message,
    callback: cb,
  });
  process.nextTick(function() {
    that.checkMessages();
  });
};

/* Check for expected messages.
 */
MessageCollector.prototype.checkMessages = function() {
  const that = this;
  this._expectedPackets.forEach(function(details, detailIndex) {
    // Is it in there?
    const i = that._packetsReceived.indexOf(details.message);
    if (i !== -1) {
      // Remove message and the listener from their respective lists
      that._packetsReceived.splice(i, 1);
      that._expectedPackets.splice(detailIndex, 1);
      details.callback();
    }
  });
};

module.exports = MessageCollector;

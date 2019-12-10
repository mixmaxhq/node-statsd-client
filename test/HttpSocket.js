/* Test the Http socket
 */

const HttpSocket = require('../lib/HttpSocket'),
  http = require('http'),
  MessageCollector = require('./messageCollector'),
  assert = require('chai').assert;

/*global before after*/

describe('HttpSocket', function() {
  let s, e, messages, lastHeaders;

  before(function(done) {
    e = new HttpSocket({ host: 'http://localhost:8125' });
    lastHeaders = null;
    messages = new MessageCollector();
    s = http.createServer(function(req, res) {
      lastHeaders = req.headers;
      req.setEncoding('ascii');
      let m = '';
      req.on('data', function(data) {
        m += data;
      });
      req.on('end', function(data) {
        if (data) {
          m += data;
        }
        messages.addMessage(m);
        res.end();
      });
    });
    s.listen(8125, undefined, undefined, done);
  });

  after(function() {
    s.close();
  });

  it('Respects host-configuration', function(done) {
    const w = new HttpSocket({ host: 'some_other_host.sbhr.dk' });
    w.send('wrong_message');

    setTimeout(function() {
      assert.lengthOf(messages._packetsReceived, 0);
      done();
    }, 25);
  });

  it('Sends data immediately with maxBufferSize = 0', function(done) {
    const withoutBuffer = new HttpSocket({ maxBufferSize: 0, host: 'http://localhost:8125' }),
      start = Date.now();

    withoutBuffer.send('do_not_buffer');

    messages.expectMessage(
      'do_not_buffer',
      function() {
        assert.closeTo(Date.now() - start, 0, 100);
        withoutBuffer.close();
        done();
      },
      500
    );
  });

  it("Doesn't send data immediately with maxBufferSize > 0", function(done) {
    const withBuffer = new HttpSocket({ socketTimeout: 25, host: 'http://localhost:8125' });
    withBuffer.send('buffer_this');
    const start = Date.now();

    messages.expectMessage('buffer_this', function(err) {
      assert.operator(Date.now() - start, '>=', 25);
      withBuffer.close();
      done(err);
    });
  });

  it('Sends headers', function(done) {
    const headers = { 'X-Test': 'Test' };
    const withHeaders = new HttpSocket({ headers, host: 'http://localhost:8125' });
    withHeaders.send('no heders kthxbai');
    messages.expectMessage('no heders kthxbai', function(err) {
      assert.isNotNull(lastHeaders);
      assert.equal(lastHeaders['x-test'], 'Test');
      withHeaders.close();
      done(err);
    });
  });

  it('Send 500 messages', function(done) {
    this.slow(500);

    // Send messages
    for (let i = 0; i < 500; i += 1) {
      e.send('foobar' + i);
    }
    e.close();

    setTimeout(function() {
      // Received some packets
      assert.closeTo(
        messages._packetsReceived.length,
        500, // Should get 500
        5 // ±5
      );
      messages._packetsReceived = [];
      return done();
    }, 25);
  });
});

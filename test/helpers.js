const StatsDClient = require('../lib/statsd-client'),
  FakeServer = require('./FakeServer'),
  assert = require('chai').assert,
  express = require('express'),
  supertest = require('supertest'),
  sinon = require('sinon');

/*global describe before it*/

describe('Helpers', function() {
  let c;
  let s;
  let es;
  let baseUrl;

  before(function(done) {
    s = new FakeServer();
    c = new StatsDClient({
      maxBufferSize: 0,
    });

    const app = express();

    app.use(c.helpers.getExpressMiddleware('express', { timeByUrl: true }));

    // Routes defined on the express app itself.
    app.get('/', function(req, res) {
      res.sendStatus(200);
    });

    app.get('/foo', function(req, res) {
      res.sendStatus(200);
    });

    app.post('/foo', function(req, res) {
      res.sendStatus(200);
    });

    app.get('/foo/:param/bar', function(req, res) {
      res.sendStatus(200);
    });

    // Routes defined on the a subrouter or "micro-app".
    const router = express.Router({ mergeParams: true });

    router.get('/foo', function(req, res) {
      res.sendStatus(200);
    });

    router.get('/foo/:subparam', function(req, res) {
      res.sendStatus(200);
    });

    app.use('/subrouter/:param', router);

    es = app.listen(3000, function() {
      baseUrl = 'http://localhost:' + 3000;
      s.start(done);
    });
  });

  after(function(done) {
    es.on('close', function() {
      s.stop();
      done();
    });
    es.close();
  });

  it('.helpers is an object', function() {
    assert.isObject(c.helpers);
  });

  it('.getExpressMiddleware(prefix) → function (err, res, next)', function() {
    const f = c.helpers.getExpressMiddleware('prefix');
    assert.isFunction(f);
    assert.lengthOf(f, 3);
  });

  describe('response times', function() {
    let sandbox;
    beforeEach(function() {
      sandbox = sinon.sandbox.create();
      sandbox.useFakeTimers(new Date().valueOf(), 'Date');
    });

    afterEach(function() {
      sandbox.restore();
    });

    describe('GET', function() {
      it('should count the response code', function(done) {
        supertest(baseUrl)
          .get('/')
          .expect(200)
          .end(function(err /*, res*/) {
            if (err) return done(err);
            s.expectMessage('express.response_code.200:1|c', done);
          });
      });

      it('should count the response code with the url prefix', function(done) {
        supertest(baseUrl)
          .get('/')
          .expect(200)
          .end(function(err /*, res*/) {
            if (err) return done(err);
            s.expectMessage('express.response_code.GET_root.200:1|c', done);
          });
      });

      it('/ → "GET_root"', function(done) {
        supertest(baseUrl)
          .get('/')
          .expect(200)
          .end(function(err /*, res*/) {
            if (err) return done(err);
            s.expectMessage('express.response_time.GET_root:0|ms', done);
          });
      });

      it('/foo → "GET_foo"', function(done) {
        supertest(baseUrl)
          .get('/foo')
          .expect(200)
          .end(function(err /*, res*/) {
            if (err) return done(err);
            s.expectMessage('express.response_time.GET_foo:0|ms', done);
          });
      });

      it('/foo/:param/bar → "GET_foo_param_bar"', function(done) {
        supertest(baseUrl)
          .get('/foo/mydynamicparameter/bar')
          .expect(200)
          .end(function(err /*, res*/) {
            if (err) return done(err);
            s.expectMessage('express.response_time.GET_foo_param_bar:0|ms', done);
          });
      });

      describe('sub-router', function() {
        it('/subrouter/:param/foo → "GET_subrouter_param_foo"', function(done) {
          supertest(baseUrl)
            .get('/subrouter/test/foo')
            .expect(200)
            .end(function(err /*, res*/) {
              if (err) return done(err);
              s.expectMessage('express.response_time.GET_subrouter_param_foo:0|ms', done);
            });
        });

        it('/subrouter/:param/foo/:subparam → "GET_subrouter_param_foo_subparam"', function(done) {
          supertest(baseUrl)
            .get('/subrouter/test_param/foo/test_sub_param')
            .expect(200)
            .end(function(err /*, res*/) {
              if (err) return done(err);
              s.expectMessage('express.response_time.GET_subrouter_param_foo_subparam:0|ms', done);
            });
        });
      });
    });

    describe('POST', function() {
      it('/foo → "POST_foo"', function(done) {
        supertest(baseUrl)
          .post('/foo')
          .expect(200)
          .end(function(err /*, res*/) {
            if (err) return done(err);
            s.expectMessage('express.response_time.POST_foo:0|ms', done);
          });
      });
    });
  });

  it('.wrapCallback(prefix, callback, options) → function', function() {
    const callback = function() {};
    const f = c.helpers.wrapCallback('prefix', callback);
    assert.isFunction(f);
  });

  describe('wrapped callback', function() {
    let sandbox;
    beforeEach(function() {
      sandbox = sinon.sandbox.create();
      sandbox.useFakeTimers(new Date().valueOf(), 'Date');
    });

    afterEach(function() {
      sandbox.restore();
    });

    it('invokes original callback', function(done) {
      const e = new Error('test'),
        v = 20;
      const callback = function(arg1, arg2) {
        assert.strictEqual(arg1, e);
        assert.strictEqual(arg2, v);
        return done();
      };
      const f = c.helpers.wrapCallback('prefix', callback);
      f(e, v);
    });

    describe('sends metrics', function() {
      const callback = function() {};
      let f;
      before(function() {
        f = c.helpers.wrapCallback('callback', callback, {
          tags: { foo: 'bar' },
        });
        f();
      });

      it('sends timing', function(done) {
        s.expectMessage('callback.time:0|ms|#foo:bar', done);
      });

      it('counts errors', function(done) {
        f(new Error('test'));
        s.expectMessage('callback.err:1|c|#foo:bar', done);
      });

      it('counts successes', function(done) {
        s.expectMessage('callback.ok:1|c|#foo:bar', done);
      });
    });
  });
});

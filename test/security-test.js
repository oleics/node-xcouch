

var Store = require('..')
  , assert = require('assert')
  , opts = require('./options')
  ;

describe('xCouch: Security', function() {
  var user, get, db, nano;
  
  before(function(cb) {
    cb()
  })
  after(function(cb) {
    Store.destroyUser(opts.user_one.name, opts.user_one.pass, function() {
      Store.destroyUser(opts.user_two.name, opts.user_two.pass, function() {
        cb()
      })
    })
  })
  
  it('we need to connect', function(cb) {
    Store.connect(opts.dsn, cb)
  })
  it('someone creates UserOne', function(cb) {
    Store.createUser(opts.user_one.name, opts.user_one.pass, cb)
  })
  it('someone creates UserTwo', function(cb) {
    Store.createUser(opts.user_two.name, opts.user_two.pass, cb)
  })
  it('UserOne connects', function(cb) {
    Store.connectUser(opts.user_one.name, opts.user_one.pass, function(err, user_, get_, db_, nano_) {
      if(err) return cb(err)
      user = user_
      get = get_
      db = db_
      nano = nano_
      cb()
    })
  })
  it('UserOne tries put a doc into the db of UserTwo: Not allowed.', function(cb) {
    nano.use(opts.user_two.name).insert({now: Date.now()}, function(err) {
      assert.ok(err)
      assert.equal(err.status_code, 401)
      cb()
    })
  })
  it('UserOne tries to read a doc from the db of UserTwo: Not allowed.', function(cb) {
    nano.use(opts.user_two.name).get('abcdefg1234567', function(err) {
      assert.ok(err)
      assert.equal(err.status_code, 401)
      cb()
    })
  })
  it('UserOne tries to remove a doc from the db of UserTwo: Not allowed.', function(cb) {
    nano.use(opts.user_two.name).destroy('abcdefg1234567', 'blah', function(err) {
      assert.ok(err)
      assert.equal(err.status_code, 401)
      cb()
    })
  })
  it('UserOne tries to list db "_users": Not allowed.', function(cb) {
    nano.use('_users').list(function(err, d) {
      assert.ok(err)
      assert.equal(err.status_code, 401)
      cb()
    })
  })
  it('UserOne tries to list the db of UserTwo: Not allowed.', function(cb) {
    nano.use(opts.user_two.name).list(function(err, d) {
      assert.ok(err)
      assert.equal(err.status_code, 401)
      cb()
    })
  })
  /* it('UserOne tries to list all dbs: Not allowed.', function(cb) {
    nano.db.list(function(err, d) {
      assert.ok(err)
      assert.equal(err.status_code, 401)
      // console.log(d)
      cb()
    })
  }) */
})

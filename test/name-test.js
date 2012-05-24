
var Store = require('..')
  , Item = require('./item')
  , assert = require('assert')
  , opts = require('./options')
  , names =
    { 'foo': true
    , 'bar': true
    , 'r_2': true
    
    , '': false
    , '1': false
    , '1two': false
    , '_r2': false
    , 'r/_2': true
    }
  ;

describe('xCouch: Names', function() {
  it('.isValidName()', function() {
    Object.keys(names).forEach(function(name) {
      assert.ok(names[name] === Store.isValidName(name))
    })
  })
})

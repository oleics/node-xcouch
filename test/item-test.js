
var Store = require('..')
  , Item = require('./item')
  , assert = require('assert')
  , opts = require('./options')
  ;

describe('xCouch: Store', function() {
  var user, getObject, db, nano;
  
  before(function(cb) {
    cb()
  })
  after(function(cb) {
    Store.destroyUser(opts.user.name, opts.user.pass, cb)
  })
  
  it('needs to connect', function(cb) {
    Store.connect(opts.dsn, cb)
  })
  
  describe('The Store User', function() {
    it('must have a valid username (^[a-z][a-z0-9\\_\\$()\\+\\-\\/]*$)', function(cb) {
      Store.createUser('321abc', 'cba123', function(err) {
        assert.ok(err)
        cb()
      })
    })
    it('must be created', function(cb) {
      Store.createUser(opts.user.name, opts.user.pass, cb)
    })
    it('and needs to connect too', function(cb) {
      Store.connectUser(opts.user.name, opts.user.pass, function(err, user_, getObject_, db_, nano_) {
        if(err) return cb(err)
        user = user_
        getObject = getObject_
        db = db_
        nano = nano_
        cb()
      })
    })
    
    describe('The connect of the user gave us', function() {
      it('the user-document', function() {
        assert.ok(user instanceof Object)
      })
      it('a function getObject() to get objects from the db of the user', function() {
        assert.ok(getObject instanceof Function)
      })
      it('the db of the user as an nano-db-object', function() {
        assert.ok(db instanceof Object)
      })
      it('a nano-object to interact with the couch as the user', function() {
        assert.ok(nano instanceof Object)
      })
    })
    
    describe('A Store Object', function() {
      var item
      it('will be created with getObject()', function() {
        item = getObject('Item')
        assert.ok(item instanceof Store)
      })
      it('inherits from Store', function() {
        assert.ok(item instanceof Store)
      })
      it('is some .type()', function() {
        assert.ok(item.type())
      })
      it('has .get() to get and .set() to set fields of data', function() {
        assert.ok(item.get instanceof Function)
        assert.ok(item.set instanceof Function)
        
        var now = Date.now()
        item.set('now', now)
        assert.strictEqual(now, item.get('now'))
        
        var rand = Math.random()
        item.set({rand: rand})
        assert.strictEqual(rand, item.get('rand'))
        
        assert.deepEqual({now: now, rand: rand}, item.get())
      })
      it('is .dirty after a change', function() {
        assert.ok(item.dirty)
      })
      
      describe('can be saved with .save()', function() {
        it('will be written if dirty', function(cb) {
          item.save(function(err, written) {
            if(err) return cb(err)
            assert.ok(written)
            cb()
          })
        })
        it('will not be written if not dirty', function(cb) {
          item.save(function(err, written) {
            if(err) return cb(err)
            assert.ok(written === false)
            cb()
          })
        })
        it('can be forced to be written even if not dirty', function(cb) {
          item.save(true, function(err, written) {
            if(err) return cb(err)
            assert.ok(written)
            cb()
          })
        })
      })
      
      describe('After a save, the data', function() {
        it('has a data property that equals the return value of .get()', function() {
          assert.ok(item.data)
          assert.strictEqual(item.data, item.get())
        })
        it('has a _id field that equals the return value of .id()', function() {
          assert.ok(item.get('_id'))
          assert.strictEqual(item.get('_id'), item.id())
        })
        it('has a _rev field that equals the return value of .rev()', function() {
          assert.ok(item.get('_rev'))
          assert.strictEqual(item.get('_rev'), item.rev())
        })
        it('has a type field that equals the return value of .type()', function() {
          assert.ok(item.get('type'))
          assert.strictEqual(item.get('type'), item.type())
        })
      })
      
      describe('can be loaded from the store with .load()', function() {
        it('will hold the same data', function(cb) {
          var item2 = getObject('Item', item.get('_id'))
          item2.load(function(err) {
            if(err) return cb(err)
            assert.deepEqual(item.get(), item2.get())
            cb()
          })
        })
      })
      
      describe('can be removed from the store with .remove()', function(cb) {
        var id
        it('.', function(cb) {
          id = item.id()
          item.remove(function(err, written) {
            if(err) return cb(err)
            assert.ok(written)
            cb()
          })
        })
        it('will be gone in database', function(cb) {
          var item2 = getObject('Item', id)
          item2.load(function(err) {
            assert.ok(err)
            assert.ok(err instanceof Error)
            cb()
          })
        })
      })
    })
    
    describe('A new Store Object', function() {
      var item
      it('will always be written on .save()', function(cb) {
        item = getObject('Item')
        item.save(function(err, written) {
          if(err) return cb(err)
          assert.ok(written)
          cb()
        })
      })
    })
    
    describe('Related Objects', function() {
      describe('One to One', function() {
        var item, item2
        
        describe('.addOne()', function() {
          it('adds an object', function(cb) {
            item = getObject('Item')
            item2 = getObject('Item')
            item.addOne(item2)
            cb()
          })
        })
        
        describe('.save() will save all related objects and the object to the db', function() {
          it('', function(cb) {
            item.save(function(err) {
              if(err) return cb(err)
              item.getOne('Item', function(err, item3) {
                if(err) return cb(err)
                assert.ok(item3)
                assert.deepEqual(item2.get(), item3.get())
                item3.exists(function(err, exists) {
                  if(err) return cb(err)
                  assert.ok(exists === true)
                  cb()
                })
              })
            })
          })
        })
        
        describe('.getOne()', function() {
          it('gets the object previously added and saved', function(cb) {
            var item4 = getObject('Item', item.id())
            item4.load(function(err) {
              if(err) return cb(err)
              assert.deepEqual(item4.get(), item.get())
              item4.getOne('Item', function(err, item3) {
                if(err) return cb(err)
                assert.ok(item3)
                assert.deepEqual(item2.get(), item3.get())
                cb()
              })
            })
          })
        })
        
        describe('.remove() will remove all related objects and the object from the db', function() {
          it('', function(cb) {
            item.remove(function(err) {
              if(err) return cb(err)
              item.getOne('Item', function(err, item3) {
                if(err) return cb(err)
                assert.ok(item3)
                assert.deepEqual(item2.get(), item3.get())
                item3.exists(function(err, exists) {
                  if(err) return cb(err)
                  assert.ok(exists === false)
                  cb()
                })
              })
            })
          })
        })
      })
      
      describe('One to Many', function() {
        var item, item2, items = []
        
        describe('.addMany()', function() {
          it('adds many objects', function(cb) {
            item = getObject('Item')
            item2 = getObject('Item')
            item.addMany(item2)
            items.push(getObject('Item'))
            items.push(getObject('Item'))
            items.push(getObject('Item'))
            items.push(getObject('Item'))
            items.push(getObject('Item'))
            item.addMany(items)
            cb()
          })
        })
        
        describe('.save() will save all related objects and the object to the db', function() {
          it('', function(cb) {
            item.save(function(err) {
              if(err) return cb(err)
              item.getMany('Item', function(err, items_) {
                if(err) return cb(err)
                assert.ok(items_)
                assert.deepEqual(item2.get(), items_[0].get())
                assert.strictEqual(item2, items_[0])
                items.forEach(function(obj, index) {
                  assert.deepEqual(obj.get(), items_[index+1].get())
                  assert.strictEqual(obj, items_[index+1])
                })
                
                var pending = items_.length
                items_.forEach(function(obj) {
                  obj.exists(function(err, exists) {
                    assert.ok(exists === true)
                    pending -= 1
                    if(pending === 0) cb()
                  })
                })
              })
            })
          })
        })
        
        describe('.getMany()', function() {
          it('gets the objects previously added and saved', function(cb) {
            var item4 = getObject('Item', item.id())
            item4.load(function(err) {
              if(err) return cb(err)
              assert.deepEqual(item4.get(), item.get())
              item4.getMany('Item', function(err, items_) {
                if(err) return cb(err)
                assert.ok(items_)
                assert.strictEqual(items.length+1, items_.length)
                assert.deepEqual(item2.get(), items_[0].get())
                items.forEach(function(obj, index) {
                  assert.deepEqual(obj.get(), items_[index+1].get())
                })
                cb()
              })
            })
          })
        })
        
        describe('.remove() will remove all related objects and the object from the db', function() {
          it('', function(cb) {
            item.remove(function(err) {
              if(err) return cb(err)
              item.getMany('Item', function(err, items_) {
                if(err) return cb(err)
                assert.ok(items_)
                assert.deepEqual(item2.get(), items_[0].get())
                assert.strictEqual(item2, items_[0])
                items.forEach(function(obj, index) {
                  assert.deepEqual(obj.get(), items_[index+1].get())
                  assert.strictEqual(obj, items_[index+1])
                })
                
                var pending = items_.length
                items_.forEach(function(obj) {
                  obj.exists(function(err, exists) {
                    assert.ok(exists === false)
                    pending -= 1
                    if(pending === 0) cb()
                  })
                })
              })
            })
          })
        })
      })
    })
    
    describe('Changes', function() {
        it('.subscribe()')
        it('.unsubscribe()')
    })
  })
})

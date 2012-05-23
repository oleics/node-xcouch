
module.exports = Store

var registry = require('./registry')
Object.keys(registry).forEach(function(k) {
  module.exports[k] = registry[k]
})

// 
function dcb(err) {
  if(err) throw err
}

// 
function Store(id, rev) {
  if(!(this instanceof Store)) return new Store(id, rev)
  
  this.data = {}
  if(id != null) {
    this.data._id = id
  }
  if(rev != null) {
    this.data._rev = rev
  }
  
  this.dirty = false
  
  this.db = null
  
  this.onFeedChange = this.onFeedChange.bind(this)
  
  // this._genIdInit(function(){})
  // this.installDesign()
  
}

// Type of the store
Store.prototype.type = function(type) {
  if(type!=null) {
    var old = this._type
    this._type = type
    return old
  }
  return this._type
}

// Id of the store
Store.prototype.id = function(id) {
  if(id!=null) {
    var old = this.data._id
    this.data._id = id
    return old
  }
  return this.data._id
}

// Rev of the store
Store.prototype.rev = function(rev) {
  if(rev!=null) {
    var old = this.data._rev
    this.data._rev = rev
    return old
  }
  return this.data._rev
}

// Get a field
Store.prototype.get = function(field) {
  if(field!=null) {
    return this.data[field]
  }
  return this.data
}

// Get and/or set the data
// [hash || [field, value]]
Store.prototype.set = function(field, value) {
  switch(arguments.length) {
    case 2:
      var old = this.data[field]
      this.data[field] = value
      if(value !== old) {
        this.dirty = true
      }
      return old
      break
    case 1:
      var self = this, old = {}, dirty = false
      Object.keys(field).forEach(function(k) {
        old[k] = self.data[k]
        self.data[k] = field[k]
        if(!dirty && field[k] !== old[k]) {
          dirty = true
        }
      })
      if(dirty) {
        self.dirty = self.dirty || dirty
      }
      return old
      break
    default:
      return this.data
      break
  }
}

// Persistance

Store.prototype.idExists = function(id, cb) {
  cb = cb || dcb
  this.db.head(id, function(err) {
    if(err) cb(null, false)
    else cb(null, true)
  })
  return this
}

Store.prototype.exists = function(cb) {
  cb = cb || dcb
  this.db.head(this.data._id, function(err) {
    if(err) cb(null, false)
    else cb(null, true)
  })
  return this
}

Store.prototype.load = function(cb) {
  var self = this
  
  cb = cb || dcb
  
  if(!(this.data._id!=null)) {
    process.nextTick(function() {
      cb()
    })
    return this
  }
  
  this.db.get(this.data._id, function(err, d) {
    if(err) return cb(err)
    self.set(d || {})
    self.dirty = false
    cb()
  })
  
  return this
}

Store.prototype.save = function(force, cb) {
  var self = this
  
  if(typeof force === 'function') {
    cb = force
    force = false
  }
  cb = cb || dcb
  
  if(this.data._id && !this.dirty && !force) {
    process.nextTick(function() {
      cb(null, false)
    })
    return this
  }
  
  // Save related objects
  this._saveOneToOne(function(err) {
    if(err) return cb(err)
    self._setOneToOne()
    
    self._saveOneToMany(function(err) {
      if(err) return cb(err)
      self._setOneToMany()
      
      // Save this
      self.data.type = self.type()
      self.db.insert(self.data, function(err, d) {
        if(err) return cb(err)
        self.data._id = d.id
        self.data._rev = d.rev
        self.dirty = false
        cb(null, true)
      })
    })
  })
  
  return this
}

Store.prototype.remove = function(cb) {
  var self = this
  
  cb = cb || dcb
  
  if(!(this.data._id!=null)) {
    process.nextTick(function() {
      cb(null, false)
    })
    return this
  }
  
  // Remove related objects
  self._removeOneToOne(function(err) {
    if(err) return cb(err)
    
    self._removeOneToMany(function(err) {
      if(err) return cb(err)
      
      // Remove this
      self.db.destroy(self.data._id, self.data._rev, function(err, info) {
        if(err && err.status_code !== 404) return cb(err)
        if(info.id) self.data._id = info.id
        if(info.rev) self.data._rev = info.rev
        cb(null, err ? false : true)
      })
    })
  })
  
  return this
}

// Design

Store.prototype.byItem = function(id, cb) {
  this.db.view(this.type(), 'byItem', {key: id}, function(err, d) {
    if(err) return cb(err)
    if(d.rows) {
      var res = []
      d.rows.forEach(function(row) {
        res.push(row.id)
      })
      cb(null, res)
    }
  })
}

Store.prototype.installDesign = function(cb) {
  var self = this
    , ddoc =
      { _id: '_design/'+this.type()
      , views:
        { byItem:
          { map: 'function(d){if(d.type==="'+this.type()+'"&&d.items) for(var i in d.items) emit(d.items[i], null);}'
          }
        }
      }
  this.db.get(ddoc._id, function(err, d) {
    if(!d || err) {
      d = {}
    }
    Object.keys(ddoc).forEach(function(k) {
      d[k] = ddoc[k]
    })
    // console.log(d)
    self.db.insert(d)
  });
}

// Related Objects

// Gets the object in .oneToOne or in .data.oneToOne
Store.prototype.getOne = function(type, cb) {
  var self = this
  
  if(this.oneToOne && this.oneToOne[type]) {
    process.nextTick(function() {
      cb(null, self.oneToOne[type])
    })
    return this
  }
  
  if(this.data.oneToOne && this.data.oneToOne[type] != null) {
    if(!self.oneToOne) self.oneToOne = {}
    var obj = this.getObject(type, this.data.oneToOne[type])
    obj.load(function(err) {
      if(err) return cb(err)
      self.oneToOne[type] = obj
      cb(null, obj)
    })
    
    return this
  }
  
  process.nextTick(cb)
  return this
}

// Gets the objects in .oneToMany or in .data.oneToMany
Store.prototype.getMany = function(type, cb) {
  var self = this
  
  // Load every object by its id in .data.oneToMany that is not
  // already in .oneToMany
  if(this.data.oneToMany && this.data.oneToMany[type]) {
    if(!this.oneToMany) this.oneToMany = {}
    if(!this.oneToMany[type]) this.oneToMany[type] = []
    
    function exists(type, id) {
      return self.oneToMany[type] && self.oneToMany[type].some(function(obj) {
        return obj && obj.id() === id
      })
    }
    
    // Make room
    var num = this.data.oneToMany[type].length
    while(num>this.oneToMany[type].length) {
      this.oneToMany[type].push(false)
    }
    
    var pending = 0
    this.data.oneToMany[type].forEach(function(id, index) {
      if(!exists(type, id)) {
        pending += 1
        
        var obj = self.getObject(type, id)
        obj.load(function(err) {
          if(err) throw err
          
          // self.oneToMany[type].splice(index, 0, obj)
          self.oneToMany[type][index] = obj
          
          pending -= 1
          if(pending === 0) {
            cb(null, self.oneToMany[type])
          }
        })
      }
    })
    if(pending !== 0) return this
  }
  
  if(this.oneToMany && this.oneToMany[type]) {
    process.nextTick(function() {
      cb(null, self.oneToMany[type])
    })
    return this
  }
  
  process.nextTick(cb)
  return this
}

// Adds the object to .oneToOne
Store.prototype.addOne = function(obj) {
  var type = obj.type()
  
  if(!this.oneToOne) this.oneToOne = {}
  if(this.oneToOne[type] === obj) return this
  
  this.oneToOne[type] = obj
  this.dirty = true
  
  return this
}

// Adds the object to .oneToMany
Store.prototype.addMany = function(obj) {
  if(obj instanceof Array) {
    var self = this
    obj.forEach(function(o) {
      self.addMany(o)
    })
  } else {
    var type = obj.type()
    
    if(!this.oneToMany) this.oneToMany = {}
    if(!this.oneToMany[type]) this.oneToMany[type] = []
    if(this.oneToMany[type].indexOf(obj) !== -1) return this
    
    this.oneToMany[type].push(obj)
    this.dirty = true
  }
  return this
}

// Calls .save() on every object in .oneToOne
Store.prototype._saveOneToOne = function(cb) {
  if(this.oneToOne) {
    var self = this
      , keys = Object.keys(self.oneToOne)
      , pending = keys.length
      ;
    
    keys.forEach(function(type) {
      self.oneToOne[type].save(function(err) {
        if(err) throw err
        
        pending -= 1
        if(pending === 0) cb()
      })
    })
    
    if(pending === 0) process.nextTick(cb)
    return
  }
  process.nextTick(cb)
}

// Calls .save() on every object in .oneToMany
Store.prototype._saveOneToMany = function(cb) {
  if(this.oneToMany) {
    var self = this
      , pending = 0
      ;
    
    Object.keys(self.oneToMany).forEach(function(type) {
      pending += self.oneToMany[type].length
      
      self.oneToMany[type].forEach(function(obj) {
        obj.save(function(err) {
          if(err) throw err
          
          pending -= 1
          if(pending === 0) cb()
        })
      })
      
      if(pending === 0) process.nextTick(cb)
    })
    
    if(pending === 0) process.nextTick(cb)
    return
  }
  process.nextTick(cb)
}

// Sets the ids of the objects in .oneToOne to .data.oneToOne
Store.prototype._setOneToOne = function() {
  var self = this
  
  if(self.oneToOne) {
    if(!self.data.oneToOne) self.data.oneToOne = {}
    
    Object.keys(self.oneToOne).forEach(function(type) {
      var id = self.oneToOne[type].id()
      
      if(!self.data.oneToOne[type]) self.data.oneToOne[type] = {}
      if(self.data.oneToOne[type] === id) return
      
      self.data.oneToOne[type] = id
      self.dirty = true
    })
  }
  
  return this
}

// Sets the ids of the objects in .oneToMany to .data.oneToMany
Store.prototype._setOneToMany = function() {
  var self = this
  
  if(self.oneToMany) {
    if(!self.data.oneToMany) self.data.oneToMany = {}
    
    Object.keys(self.oneToMany).forEach(function(type) {
      if(!self.data.oneToMany[type]) self.data.oneToMany[type] = []
    
      // Make room
      var num = self.oneToMany[type].length
      while(num>self.data.oneToMany[type].length) {
        self.data.oneToMany[type].push(false)
      }
      
      self.oneToMany[type].forEach(function(obj, index) {
        var id = obj.id()
        
        if(self.data.oneToMany[type].indexOf(id) !== -1) return
        
        // self.data.oneToMany[type].splice(index, 0, id)
        self.data.oneToMany[type][index] = id
        self.dirty = true
      })
    })
  }
  return this
}

// Calls .remove() on every object in .oneToOne
Store.prototype._removeOneToOne = function(cb) {
  if(this.oneToOne) {
    var self = this
      , keys = Object.keys(self.oneToOne)
      , pending = keys.length
      ;
    
    keys.forEach(function(type) {
      self.oneToOne[type].remove(function(err) {
        if(err) throw err
        
        pending -= 1
        if(pending === 0) cb()
      })
    })
    
    if(pending === 0) process.nextTick(cb)
    return
  }
  process.nextTick(cb)
}

// Calls .remove() on every object in .oneToMany
Store.prototype._removeOneToMany = function(cb) {
  if(this.oneToMany) {
    var self = this
      , pending = 0
      ;
    
    Object.keys(self.oneToMany).forEach(function(type) {
      pending += self.oneToMany[type].length
      
      self.oneToMany[type].forEach(function(obj) {
        obj.remove(function(err) {
          if(err) throw err
          
          pending -= 1
          if(pending === 0) cb()
        })
      })
      
      if(pending === 0) process.nextTick(cb)
    })
    
    if(pending === 0) process.nextTick(cb)
    return
  }
  process.nextTick(cb)
}

//// Changes

Store.prototype.subscribe = function() {
  this.db.feed.on('change', this.onFeedChange)
}

Store.prototype.unsubscribe = function() {
  this.db.feed.removeListener('change', this.onFeedChange)
}

Store.prototype.onFeedChange = function(change) {
  if(change.id === this.id()) {
    console.log('change:', change)
  }
}

// Items

Store.prototype.addItem = function(id) {
  if(!this.data.items) this.data.items = []
  var index = this.data.items.indexOf(id)
  if(index === -1) {
    this.data.items.push(id)
    this.dirty = true
  }
  return this
}

Store.prototype.removeItem = function(id) {
  if(!this.data.items) return this
  var index = this.data.items.indexOf(id)
  if(index === -1) return this
  this.data.items.splice(index, 1)
  this.dirty = true
  return this
}

Store.prototype.hasItem = function(id) {
  if(!this.data.items) return false
  var index = this.data.items.indexOf(id)
  if(index === -1) return false
  return true
}

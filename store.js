
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
  
  // this._genIdInit(function(){})
  // this.installDesign()
  
}

// Namespace of the store
Store.prototype.type = function(type) {
  if(type!=null) {
    var old = this._type
    this._type = type
    return old
  }
  return this._type
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

// Keygen
/* 
Store.prototype._genIdInit = function(cb) {
  var self = this
  this.db.head(this.type(), function(err) {
    if(err) {
      self.db.insert({type: self.type(), nextId: 0}, self.type(), function(err) {
        if(err) return cb(err)
        cb()
      })
      return
    }
    cb()
  })
}

Store.prototype._genId = function(cb) {
  var self = this
    , id
  this.db.get(this.type(), function(err, d) {
    if(err) {
      self._genIdInit(function(err) {
        if(err) return cb(err)
        self._genId(cb)
      })
      return
    }
    id = d.nextId
    d.nextId += 1
    self.db.insert(d, function() {
      if(err) return cb(err)
      cb(null, id)
    })
  })
}
 */
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
/*   
  if(!(this.data._id != null)) {
    // Create new id
    this.dirty = true
    this._genId(function(err, id) {
      if(err) return cb(err)
      self.data._id = id
      self.save(cb)
    })
    return this
  }
 */  
  if(this.data._id && !this.dirty && !force) {
    process.nextTick(function() {
      cb(null, false)
    })
    return this
  }
  
  this.data.type = this.type()
  this.db.insert(this.data, function(err, d) {
    if(err) return cb(err)
    self.data._id = d.id
    self.data._rev = d.rev
    self.dirty = false
    cb(null, true)
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
  
  this.db.destroy(this.data._id, this.data._rev, function(err) {
    if(err && err.status_code !== 404) return cb(err)
    cb(null, err ? false : true)
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

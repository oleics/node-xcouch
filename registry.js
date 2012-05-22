
module.exports =
  { connect: connect
  
  , addModel: addModel
  
  , createUser: createUser
  // , userLogin: userLogin
  , connectUser: connectUser
  , destroyUser: destroyUser
  }

var NANO = require('../_nano')
  , crypto = require('crypto')
  , url = require('url')
  , _ci
  , _security = {}
  , _nano
  , registry = {}
  
  , nameRegExp = new RegExp('^[a-z][a-z0-9\_\$()\+\-\/]*$')

  , user_dbname = '_users'
  , user_namespace = 'org.couchdb.user'
  ;

//// Store Setup

// Connects
function connect(uri, cb) {
  _ci = url.parse(uri)
  _nano = NANO(_ci.protocol+'//'+(_ci.auth?_ci.auth+'@':'')+_ci.host+'')
  
  // Get _security of _users and use it as a template
  getSecurity('_users', function(err, d) {
    // Looks like we are not allowed to do this
    if(err) return cb(err)
    
    // As the user within uri is allowed to fetch _securtiy,
    // she will 'probably' be allowed to add itself to _security:
    if(_ci.auth) {
      user = _ci.auth.split(':',1).shift()
      if(d.admins.names.indexOf(user) === -1) {
        d.admins.names.push(user)
      }
      if(d.readers.names.indexOf(user) === -1) {
        d.readers.names.push(user)
      }
    }
    
    // Sets the template for further _security changes
    _security = mergeSecurity(_security, d)
    
    // Write _security to _users
    setSecurity('_users', _security, function(err) {
      if(err) return cb(err)
      cb()
    })
  })
}

// Returns the master nano instance
function nano() {
  return _nano
}

//// Store Security

function arrayMergeUnique(a, b) {
  return a.concat(b).filter(function(v,i,c) {
    if(i === c.indexOf(v)) return true
    return false
  })
}

function fixSecurity(d) {
  if(!d) d = {}
  if(!d.admins) d.admins = {}
  if(!d.admins.names) d.admins.names = []
  if(!d.admins.roles) d.admins.roles = []
  if(!d.readers) d.readers = {}
  if(!d.readers.names) d.readers.names = []
  if(!d.readers.roles) d.readers.roles = []
  return d
}

function mergeSecurity(a, b) {
  a = fixSecurity(a)
  b = fixSecurity(b)
  var c = fixSecurity()
  c.admins.names = arrayMergeUnique(a.admins.names, b.admins.names)
  c.admins.roles = arrayMergeUnique(a.admins.roles, b.admins.roles)
  c.readers.names = arrayMergeUnique(a.readers.names, b.readers.names)
  c.readers.roles = arrayMergeUnique(a.readers.roles, b.readers.roles)
  return c
}

function getSecurity(dbname, cb) {
  nano().use(dbname).get('_security', function(err, d) {
    if(err && err.status_code !== 404) return cb(err)
    if(err && err.status_code === 404) d = {}
    d = fixSecurity(d)
    cb(null, d)
  })
}

function setSecurity(dbname, _security, cb) {
  nano().use(dbname).insert(_security, '_security', function(err, d) {
    if(err) return cb(err)
    cb(null, d.ok)
  })
}

//// Store Items

// Adds a new model to the model-registry
function addModel(type, ctor) {
  registry[type] = ctor
}

// Users and their databases

// Connects a user
function connectUser(name, pass, cb) {
  userLogin(name, pass, function(err, user) {
    if(err) return cb(err)
    
    var nano = NANO(_ci.protocol+'//'+name+':'+pass+'@'+_ci.host+'/')
      , db = nano.use(name)
      ;
    
    function getObject(type, id, rev) {
      var ctor = registry[type]
        , obj = new ctor(id, rev)
      obj.type(type)
      if(ctor.dbname) {
        obj.db = nano.use(ctor.dbname)
      } else {
        obj.db = db
      }
      return obj
    }
    
    cb(null, user, getObject, db, nano)
  })
}

// Creates a new user
function createUser(name, pass, cb) {
  // Check name
  if(nameRegExp.test(name) !== true) return cb(new Error('Invalid name: '+name))
  // gen salt
  var salt = crypto.randomBytes(16).toString('hex')
  // gen sha1
  var hash = crypto.createHash('sha1')
  hash.update(pass)
  hash.update(salt)
  var password_sha = hash.digest('hex')
  
  var new_doc =
      { _id: user_namespace+':'+name
      , name: name
      , roles: []
      , type: 'user'
      , password_sha: password_sha
      , salt: salt
      }
    ;
  
  nano().use(user_dbname).insert(new_doc, function(err, doc, h) {
    if(err) return cb(err)
    
    // Every user gets its own database
    createDatabase(name, function(err) {
      if(err) return cb(err)
      
      // Sets the _security
      setDatabaseSecurity(name, function(err) {
        if(err) return cb(err)
        cb(null, doc.id, doc.rev)
      })
    })
  })
}

// Creates a database
// We assume that every database belongs to exactly one user.
// Both share the same name.
function createDatabase(name, cb) {
  nano().db.create(name, function(err) {
    if(err && err.status_code !== 412) return cb(err)
    cb(null, err ? false : true)
  })
}

// Sets the _security document of a database
function setDatabaseSecurity(name, cb) {
  // Get _security first
  getSecurity(name, function(err, d) {
    if(err) return cb(err)
    
    // Make name an admin
    if(d.admins.names.indexOf(name) === -1) {
      d.admins.names.push(name)
    }
    
    // Make name a reader
    if(d.readers.names.indexOf(name) === -1) {
      d.readers.names.push(name)
    }
    
    // Merge with _security template
    d = mergeSecurity(_security, d)
    
    // Apply changes
    setSecurity(name, d, function(err) {
      if(err) return cb(err)
      cb()
    })
  })
}

// Checks userLogin credenciales
function userLogin(name, pass, cb) {
  // Get the user
  var db = nano().use(user_dbname)
  db.get(user_namespace+':'+name, function(err, doc) {
    if(err) return cb(err)
    
    // Check pass
    var hash = crypto.createHash('sha1')
    hash.update(pass)
    hash.update(doc.salt)
    password_sha = hash.digest('hex')
    if(doc.password_sha === password_sha) {
      return cb(null, doc)
    }
    
    cb(new Error('Access denied.'))
  })
}

// Destroys a database
function destroyDatabase(name, cb) {
  if(name === user_dbname)
    throw new Error('We never ever delete that database.')
  nano().db.destroy(name, function(err) {
    if(err && err.status_code !== 404) return cb(err)
    cb(null, err ? false : true)
  })
}

// Destroys a user AND her database
function destroyUser(name, pass, cb) {
  userLogin(name, pass, function(err, user) {
    if(err) return cb(err)
    nano().use(user_dbname).destroy(user._id, user._rev, function(err, doc) {
      if(err) return cb(err)
      user._id = doc.id
      user._rev = doc.rev
      destroyDatabase(name, function(err) {
        if(err) return cb(err)
        cb(null, user)
      })
    })
  })
  // var db = nano().use(user_dbname)
  // db.head(user_namespace+':'+name, function(err, b, h) {
    // if(err) return cb(err)
    // db.destroy(user_namespace+':'+name, JSON.parse(h.etag), function(err, doc) {
      // if(err) return cb(err)
      // destroyDatabase(name, function(err) {
        // if(err) return cb(err)
        // cb(null, doc)
      // })
    // })
  // })
}

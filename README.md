xCouch
======

Installation
------------

``npm install xcouch``

Usage Examples
--------------

```js
var Store = require('xcouch')

Store.connect('http://admin:pass@localhost:5984', function(err) {
  if(err) throw err
  Store.createUser('testUser', 'testPass', function(err) {
  })
})
```

How To Create Own Store Object Models
-------------------------------------

Create a file ``mymodel.js``:

```js
var util = require('util')
  , Store = require('xcouch')
  ;

// Add the model to the model-registry of the store
Store.addModel('MyModel', MyModel)

// Create a new model
function MyModel(id, rev) {
  if(!(this instanceof MyModel)) return new MyModel(id, rev)
  Store.call(this, id, rev)
}
util.inherits(MyModel, Store) // The model must inherit from Store
```

To use ``MyModel`` do the following:

```js
var Store = require('xcouch')

// Load the model
require('./mymodel')

// Connects to the store (CouchDB)
Store.connect('http://admin:pass@localhost:9548', function(err) {
  if(err) throw err
  
  // Connects as a user of the store
  Store.connectUser('name', 'pass', function(err, user, getObject, db, nano) {
    if(err) throw err
    
    // Creates a new object
    var myObject = getObject('MyModel')
    
    // Saves the new object
    myObject.save(function(err, written) {
      if(err) throw err
      
      if(written) {
        // changes saved
      } else {
        // nothing changed, so nothing written :-)
      }
    })
    
    // Loads an existing object (document)
    var myObject2 = getObject('MyModel', 'idOfTheDocument')
    myObject2.load(function(err) {
      if(err) {
        // Not found
        // We could save it here under the id 'idOfTheDocument'
        // But we'll throw:
        throw err
      }
      // Print the data
      console.log(myObject2.get())
    })
  })
})
```

Security
--------

### Rules

  * One database per user.
  * By default, the user owns its database exclusively. No other  
    user can read from or write to it.
  * Admins can do everything.
  * xCouch will never create accounts with administrative
    privileges.
  * Only admins can create users. Direct sign-up to the CouchDB  
    will be disabled per '_security' document.

How To Run The Tests
--------------------

*WARNING:* The tests and xCouch will make changes to your CouchDB  
and those changes will not be reverted automatically. Please make  
backups if you have to undo the changes xCouch made to your  
CouchDB.

Understood? Ready? Then:

Copy ``test/options.json-dist`` to ``test/options.json`` and edit  
the copy:

```js
{
  "dsn": "http://[admin]:[pass]@localhost:5984",
  "user": {
    "name": "xcouchtestuser",
    "pass": "acb123"
  },
  "user_one": {
    "name": "xcouchtestuserone",
    "pass": "acb123"
  },
  "user_two": {
    "name": "xcouchtestusertwo",
    "pass": "acb123"
  }
}
```

Now type ``mocha -R spec --ignore-leaks`` and hit enter.

And again, running the tests will change your CouchDB in a way  
you might not like. Don't blame the author for lost data or ask  
the author to clean up your database afterwards.

API
---

### Setup

Store.connect(dsn, callback)  
``callback(err)``

### Users

Store.createUser(name, pass, callback)  
``callback(err, id, rev)``

Store.connectUser(name, pass, callback)  
``callback(err, doc, getObject, db, nano)``

Store.destroyUser(name, pass, callback)  
``callback(err, doc)``

### Store Objects

Store.register(name, constructor)

Class: Store
------------

### Properties

.dirty

.data

.db

### Methods

#### Configuration Accessors

.type([type])

#### Field Accessors

.get([field])

.set([hash] || [field, value])

#### Persistence

.exists(callback)  
``callback(err, exists)``

.load(callback)  
``callback(err)``

.save([force, ] callback)  
``callback(err, written)``

.remove(callback)  
``callback(err, written)``

#### Related Object Accessors

.getOne(type)

.addOne(obj)

.getMany(type)

.addMany(obj || array of objects)

MIT License
-----------

Copyright (c) 2012 Oliver Leics <oliver.leics@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

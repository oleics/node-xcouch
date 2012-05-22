
module.exports = Item

var util = require('util')
  , Store = require('..')

Store.addModel('Item', Item)

function Item(id, rev) {
  if(!(this instanceof Item)) return new Item(id, rev)
  Store.call(this, id, rev)
}
util.inherits(Item, Store)

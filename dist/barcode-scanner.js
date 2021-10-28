(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}

},{}],2:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
(function (global){(function (){
if(!global.Barcode) global.Barcode = require('./scanner');

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./scanner":10}],4:[function(require,module,exports){
(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['sift'], factory);
    }else if(typeof exports === 'object'){
        module.exports = factory(require('sift'));
    }else{
        root.AsyncArrays = factory(root.Sift);
    }
}(this, function(sift){
    var asyncarray = {
        forAllEmissionsInPool : function(array, poolSize, callback, complete){
            var a = {count : 0};
            var collection = array;
            var queue = [];
            var activeCount = 0;
            var returnArgs = [];
            var begin = function(action){
                if(a.count >= poolSize){
                    queue.push(action)
                }else{
                    a.count++;
                    action();
                }
            };
            var finish = function(index, args){
                if(args.length == 1) returnArgs[index] = args[0];
                if(args.length > 1) returnArgs[index] = args;
                a.count--;
                if(queue.length > 0){
                    a.count++;
                    queue.shift()();
                }else if(a.count == 0 && complete) complete.apply(complete, returnArgs);
            };
            Array.prototype.forEach.apply(array, [function(value, key){
                begin(function(){
                    callback(value, key, function(){
                       finish(key, Array.prototype.slice.apply(arguments, [0])); 
                    });
                });
            }]);
            if(a.count == 0 && complete) complete.apply(complete, returnArgs);
        },
        forAllEmissions : function(list, callback, complete){
            var ref = {count : 0};
            Array.prototype.forEach.apply(list, [function(value, key){
                ref.count++;
                setTimeout(function(){
                    callback(value, key, function(){
                            ref.count--;
                            if(ref.count < 0) throw new Error('continued iterating past stop');
                            if(ref.count == 0) return complete();
                    });
                },1);
            }]);
            if(!list.length) complete();
        },
        mapEmissions : function(list, callback, complete, parallel){
            var results = [];
            var fnName = parallel?'forAllEmissions':'forEachEmission';
            asyncarray[fnName](list, function(item, index, done){
                callback(item, function(item){
                   if(item) results.push(item);
                   done();
                });
            }, function(){
                complete(results);
            });
        },
        forEachEmission : function(array, callback, complete){
            var a = {count : 0};
            var collection = array;
            var returnArgs = [];
            var len = collection.length;
            var fn = function(collection, callback, complete){
                if(a.count >= collection.length){
                    setTimeout(function(){
                        if(complete) complete.apply(complete, returnArgs);
                    },1); return;
                }else{
                    setTimeout(function(){
                        callback(collection[a.count], a.count, function(){
                            var args = Array.prototype.slice.apply(arguments, [0]);
                            if(args.length == 1) returnArgs[a.count] = args[0];
                            if(args.length > 1) returnArgs[a.count] = args;
                            a.count++;
                            fn(collection, callback, complete);
                        });
                    },1);
                }
            };
            fn(collection, callback, complete);
        },
        uForEach : function(array, callback){
            var len = array.length;
            for (var j = 0; j < len; j++) {
                callback(array[j], j);
            }
        },
        combine : function(thisArray, thatArray){ //parallel
            var result = [];
            Array.prototype.forEach.apply(thisArray, [function(value, key){
                if(result.indexOf[value] === -1) result.push(value);
            }]);
            Array.prototype.forEach.apply(thatArray, [function(value, key){
                if(result.indexOf[value] === -1) result.push(value);
            }]);
            return result;
        },
        contains : function(haystack, needle){
            if(typeof needle == 'array'){
                result = false;
                Array.prototype.forEach.apply(needle, [function(pin){
                    result = result || object.contains(haystack, pin);
                }]);
                return result;
            }
            else return haystack.indexOf(needle) != -1;
        },
        delta : function(a, b){
            var delta = [];
            Array.prototype.forEach.apply(a, [function(item){
                if(b.indexOf(item) != -1) delta.push(item);
            }]);
            Array.prototype.forEach.apply(b, [function(item){
                if(a.indexOf(item) != -1 && delta.indexOf(item) == -1) delta.push(item);
            }]);
            return delta;
        },
        //mutators (return modified elements)
        erase : function(arr, field){
            if(typeof field != 'object'){
                var index;
                var item;
                while((index = arr.indexOf(field)) != -1){ //get 'em all
                    item = arr[index];
                    arr.splice(index, 1); //delete the one we found
                }
                return item;
            }else{
                var filter = sift(field);
                var filtered = [];
                for(var i = arr.length; i--; ){
                    if(filter.test(arr[i])){
                        filtered.push(arr[i]);
                        arr.splice(i, 1);
                    }
                }
                return filtered;
            }
        },
        empty : function(arr){
            var removed = arr.slice(0);
            arr.splice(0, arr.length);
            return removed;
        },
        proto : function(){
            if(!Array.prototype.uForEach) Array.prototype.uForEach = function(callback){
                return asyncarray.uForEach(this, callback);
            };

            // allows you to act on each member in an array one at a time 
            // (while being able to perform asynchronous tasks internally)
            if(!Array.prototype.forEachEmission){
                Array.prototype.forEachEmission = function(callback, complete){
                    return asyncarray.forEachEmission(this, callback, complete);
                };
            }

            //allows you to act on each member in a chain in parallel
            if(!Array.prototype.forAllEmissions){
                Array.prototype.forAllEmissions = function(callback, complete){
                    return asyncarray.forAllEmissions(this, callback, complete);
                };
            }

            //allows you to act on each member in a pool, with a maximum number of active jobs until complete
            if(!Array.prototype.forAllEmissionsInPool){
                Array.prototype.forAllEmissionsInPool = function(poolSize, callback, complete){
                    return asyncarray.forAllEmissionsInPool(this, poolSize, callback, complete);
                };
            }
            
            //map an array, asynchronously
            if(!Array.prototype.mapEmissions){
                Array.prototype.mapEmissions = function(poolSize, callback, complete){
                    return asyncarray.mapEmissions(this, poolSize, callback, complete);
                };
            }
            if(!Array.prototype.combine) Array.prototype.combine = function(array){
                return asyncarray.combine(this, array);
            };
            if(!Array.prototype.contains) Array.prototype.contains = function(item){
                return asyncarray.contains(this, item);
            };
            if(!Array.prototype.erase) Array.prototype.erase = function(field){
                return asyncarray.erase(this, field);
            };
            if(!Array.prototype.empty) Array.prototype.empty = function(field){
                return asyncarray.erase(this, field);
            };
        }
    };
    asyncarray.forEachBatch = asyncarray.forAllEmissionsInPool
    asyncarray.forEach = asyncarray.forAllEmissionsInPool
    asyncarray.forAll = asyncarray.forAllEmissionsInPool
    asyncarray.map = asyncarray.mapEmissions
    asyncarray.map.each = function(list, callback, complete){
        return asyncarray.mapEmissions(list, callback, complete);
    }
    asyncarray.map.all = function(list, callback, complete){
        return asyncarray.mapEmissions(list, callback, complete, true);
    }
    return asyncarray;
}));
},{"sift":8}],5:[function(require,module,exports){
(function (root, factory){
    if (typeof define === 'function' && define.amd){
        define(['async-arrays'], factory);
    }else if (typeof exports === 'object'){
        module.exports = factory(require('async-arrays'));
    }else{
        root.AsyncObjects = factory(root.AsyncArrays);
    }
}(this, function (arrays){
    var on = function(ob){
        ob = ob || {};
        if(!ob.clone) ob.clone = function(obj){
            if(!obj) return;
            var result;
            if(obj.clone && type(obj.clone) == 'function') return obj.clone();
            else 
            switch(type(obj)){
                case 'object':
                    result = {};
                    for(var key in obj){
                        result[key] = clone(obj[key]);
                    }
                    break;
                case 'array':
                    result = obj.map(function(item){return ob.clone(item); });
                    break;
                default : result = obj;
            }
            return result;
        };

        if(!ob.forEach) ob.forEach = function(object, callback){
            Object.keys(object).forEach(function(key, index){
                callback(object[key], key);
            });
        };

        // allows you to act on each member in an array one at a time 
        // (while being able to perform asynchronous tasks internally)
        if(!ob.forEachEmission) ob.forEachEmission = function(object, callback, complete){
            arrays.forEachEmission(Object.keys(object), function(key, index, done){
                callback(object[key], key, done);
            }, complete);
        };

        //allows you to act on each member in a chain in parallel
        if(!ob.forAllEmissions) ob.forAllEmissions = function(object, callback, complete){
            arrays.forAllEmissions(Object.keys(object), function(key, index, done){
                callback(object[key], key, done);
            }, complete);
        };

        //allows you to act on each member in a pool, with a maximum number of active jobs until complete
        if(!ob.forAllEmissionsInPool) ob.forAllEmissionsInPool = function(object, poolSize, callback, complete){
            arrays.forAllEmissionsInPool(Object.keys(object), poolSize, function(key, index, done){
                callback(object[key], key, done);
            }, complete);
        };
    
        if(!ob.interleave) ob.interleave = function(data, ob){
            ob = ob.clone(ob);
            ob.forEach(data, function(item, key){
                if(type(item) == 'object' && type(ob[key]) == 'object') ob[key] = ob.interleave(item, ob[key]);
                else{
                    if((!ob[key])) ob[key] = item;
                }
            });
            return ob;
        };
        
        if(!ob.random) ob.random = function(object, callback){
            var keys = Object.keys(object);
            var randomIndex = Math.floor(Math.random()*Object.keys(object).length);
            callback(object[keys[randomIndex]], keys[randomIndex]);
        }
    
        if(!ob.merge) ob.merge = function(objOne, objTwo){
            var result = {};
            ob.forEach(objOne, function(item, key){
                result[key] = item;
            });
            ob.forEach(objTwo, function(item, key){
                if(!result[key]) result[key] = item;
            });
            return result;
        };

        if(!ob.map) ob.map = function(obj, callback, excludeUndefined){
            var result = {}
            ob.forEach(obj, function(item, index){
                var res = callback(item, index, result);
                if(excludeUndefined && res === undefined) return;
                result[index] = res;
            });
            return result;
        };

        if(!ob.filter) ob.filter = function(data, test, callback){
            var results = {};
            ob.forEach(data, function(item, key){
                if(test(key, item)) results[key] = item;
            });
            return results;
        };
        
        return ob;
    }
    
    var result = on({});
    result.on = on;
    return result;
}));
},{"async-arrays":4}],6:[function(require,module,exports){
var Emitter = require('extended-emitter');

var ScanBuffer = function(options){
    if(!options) options ={};
    this.buffer = [];
    this.largestInterval = 0;
    this.times = [];
    this.scanners = {};
    this.intervals = {};
    (new Emitter()).onto(this);
};

ScanBuffer.prototype.addScanner = function(options){
	if(typeof options == "function"){
		options = {scan:options}
	}
	var ob = this;
	if(!options.interval) options.interval = 1000;
	if(options.interval > this.largestInterval) this.largestInterval = options.interval;
	if(!this.scanners[options.interval]) this.scanners[options.interval] = [];
	var pattern = options.pattern;
	if(options.pattern && !options.scan) options.scan = function(str){
        return str.match(pattern);	
	};
	this.scanners[options.interval].push(options);
};

ScanBuffer.prototype.removeAllScanners = function(){
	var ob = this;
	Object.keys(this.intervals).forEach(function(interval){
		clearInterval()
	});
}

ScanBuffer.prototype.allScanners = function(callback){
	var ob = this;
	Object.keys(this.scanners).forEach(function(scannerInterval){
		ob.scanners[scannerInterval].forEach(function(scanner){
			callback(scanner);
		});
	});
};

ScanBuffer.prototype.removeAllScanners = function(){
	var ob = this;
	Object.keys(this.intervals).forEach(function(interval){
		clearInterval()
	});
}

ScanBuffer.prototype.scan = function(scanners){
	var terminated = false;
	var ob = this;
	var now = Date.now();
	this.allScanners(function(scanner){
		if(terminated) return;
		var buffer = ob.buffer.filter(function(item){
			return item.time + scanner.interval >= now
				&& ((!scanner.flushed) || scanner.flushed < item.time);
		}).map(function(item){ return item.value }).join('');
		var result;
		if(result = scanner.scan(buffer)){
			scanner.flushed = now;
			if(scanner.callback) scanner.callback(result);
			if(scanner.name) ob.emit(scanner.name, result)
			if(scanner.terminates) terminated = true;
		}
	});
};

ScanBuffer.prototype.input = function(value){
	var now = new Date().getTime();
	var largest = this.largestInterval;
	this.buffer = this.buffer.filter(function(item){
		return item.time + largest >= now;
	});
	this.buffer.push({
		value : value,
		time : now
	});
	this.scan();
};

module.exports = ScanBuffer;

},{"extended-emitter":7}],7:[function(require,module,exports){
(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['wolfy87-eventemitter', 'sift'], factory);
    }else if(typeof exports === 'object'){
        module.exports = factory(require('events').EventEmitter, require('sift'));
    }else{
        root.ExtendedEmitter = factory(root.EventEmitter, root.Sift);
    }
}(this, function(EventEmitter, sift){
    if(sift.default) sift = sift.default;

    function processArgs(args, hasTarget){
        var result = {};
        args = Array.prototype.slice.call(args);
        if(typeof args[args.length-1] === 'function'){
            result.callback = args[args.length-1];
            args.splice(args.length-1, 1);
        }
        result.name = args.shift();
        if(hasTarget) result.target = args.pop();
        result.conditions = args[args.length-1] || args[0] || {};
        return result;
    }

    function meetsCriteria(name, object, testName, testObject){
        if(name != testName) return false;
        if(!object) return true;
        var filter = sift(testObject);
        var result = filter(object);
        return result;
    }

    function ExtendedEmitter(emitter){
        this.emitter = emitter || (new EventEmitter());
        if (typeof module === 'object' && module.exports && this.emitter.setMaxListeners) this.emitter.setMaxListeners(100);
    }

    ExtendedEmitter.prototype.onto = function(objectDefinition){
        var ob = this;
        objectDefinition.on = function(){ return ob.on.apply(ob, arguments) };
        objectDefinition.off = function(){ return ob.off.apply(ob, arguments) };
        objectDefinition.once = function(){ return ob.once.apply(ob, arguments) };
        objectDefinition.emit = function(){ return ob.emit.apply(ob, arguments) };
    };

    ExtendedEmitter.prototype.off = function(event, fn){
        return this.emitter.removeListener.apply(this.emitter, arguments)
    };

    ExtendedEmitter.prototype.allOff = function(event, fn){
        return this.emitter.removeAllListeners.apply(this.emitter, arguments)
    };

    ExtendedEmitter.prototype.on = function(name){
        var args = processArgs(arguments);
        var proxyFn = function(data){
            if(meetsCriteria(name, data, args.name, args.conditions)){
                args.callback.apply(args.callback, arguments);
            }
        };
        this.emitter.on.apply(this.emitter, [args.name, proxyFn]);
        return proxyFn;
    }

    ExtendedEmitter.prototype.emit = function(){
        return this.emitter.emit.apply(this.emitter, arguments);
    }

    //for some reason some emitter love the send fn, which *should* be the same
    //make this nuance addressible by having the fn execute in a non-breaky way
    ExtendedEmitter.prototype.send = function(){
        var fn = this.emitter.send || this.emitter.emit;
        return fn.apply(this.emitter, arguments);
    }

    ExtendedEmitter.prototype.once = function(name){
        var args = processArgs(arguments);
        var ob = this;
        //NOTE: in certain situations nonstandard emitter push an event through
        //      first, wrecking everything hence: `data1, data2`
        var proxyFn = function cb(data1, data2){
            var data = data2 || data1;
            if(meetsCriteria(name, data, args.name, args.conditions)){
                ob.off.apply(ob, [args.name, cb]);
                args.callback.apply(args.callback, arguments);
            }
        };
        this.emitter.on.apply(this.emitter, [args.name, proxyFn]);
        return proxyFn;
    }

    ExtendedEmitter.prototype.when = function(events, callback){
        var count = 0;
        var returns = [];
        var ob = this;
        events.forEach(function(event, index){
            var respond = function(emission){
                count++;
                returns[index] = emission;
                if(count == events.length) callback.apply(callback, returns);
            }
            if(event.then){ //promise handling
                event.then(function(resolve, error, notify){
                    respond();
                    resolve();
                });
                return;
            }
            if(typeof event == 'function') event(respond);
            else return ob.emitter.once(event, respond);
        });
    };

    return ExtendedEmitter;
}));

},{"events":1,"sift":8}],8:[function(require,module,exports){
const lib = require("./lib");

module.exports = lib.default;
Object.assign(module.exports, lib);

},{"./lib":9}],9:[function(require,module,exports){
(function (process){(function (){
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.sift = {}));
}(this, (function (exports) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var typeChecker = function (type) {
        var typeString = "[object " + type + "]";
        return function (value) {
            return getClassName(value) === typeString;
        };
    };
    var getClassName = function (value) { return Object.prototype.toString.call(value); };
    var comparable = function (value) {
        if (value instanceof Date) {
            return value.getTime();
        }
        else if (isArray(value)) {
            return value.map(comparable);
        }
        else if (value && typeof value.toJSON === "function") {
            return value.toJSON();
        }
        return value;
    };
    var isArray = typeChecker("Array");
    var isObject = typeChecker("Object");
    var isFunction = typeChecker("Function");
    var isVanillaObject = function (value) {
        return (value &&
            (value.constructor === Object ||
                value.constructor === Array ||
                value.constructor.toString() === "function Object() { [native code] }" ||
                value.constructor.toString() === "function Array() { [native code] }") &&
            !value.toJSON);
    };
    var equals = function (a, b) {
        if (a == null && a == b) {
            return true;
        }
        if (a === b) {
            return true;
        }
        if (Object.prototype.toString.call(a) !== Object.prototype.toString.call(b)) {
            return false;
        }
        if (isArray(a)) {
            if (a.length !== b.length) {
                return false;
            }
            for (var i = 0, length_1 = a.length; i < length_1; i++) {
                if (!equals(a[i], b[i]))
                    return false;
            }
            return true;
        }
        else if (isObject(a)) {
            if (Object.keys(a).length !== Object.keys(b).length) {
                return false;
            }
            for (var key in a) {
                if (!equals(a[key], b[key]))
                    return false;
            }
            return true;
        }
        return false;
    };

    /**
     * Walks through each value given the context - used for nested operations. E.g:
     * { "person.address": { $eq: "blarg" }}
     */
    var walkKeyPathValues = function (item, keyPath, next, depth, key, owner) {
        var currentKey = keyPath[depth];
        // if array, then try matching. Might fall through for cases like:
        // { $eq: [1, 2, 3] }, [ 1, 2, 3 ].
        if (isArray(item) && isNaN(Number(currentKey))) {
            for (var i = 0, length_1 = item.length; i < length_1; i++) {
                // if FALSE is returned, then terminate walker. For operations, this simply
                // means that the search critera was met.
                if (!walkKeyPathValues(item[i], keyPath, next, depth, i, item)) {
                    return false;
                }
            }
        }
        if (depth === keyPath.length || item == null) {
            return next(item, key, owner);
        }
        return walkKeyPathValues(item[currentKey], keyPath, next, depth + 1, currentKey, item);
    };
    var BaseOperation = /** @class */ (function () {
        function BaseOperation(params, owneryQuery, options) {
            this.params = params;
            this.owneryQuery = owneryQuery;
            this.options = options;
            this.init();
        }
        BaseOperation.prototype.init = function () { };
        BaseOperation.prototype.reset = function () {
            this.done = false;
            this.keep = false;
        };
        return BaseOperation;
    }());
    var NamedBaseOperation = /** @class */ (function (_super) {
        __extends(NamedBaseOperation, _super);
        function NamedBaseOperation(params, owneryQuery, options, name) {
            var _this = _super.call(this, params, owneryQuery, options) || this;
            _this.name = name;
            return _this;
        }
        return NamedBaseOperation;
    }(BaseOperation));
    var GroupOperation = /** @class */ (function (_super) {
        __extends(GroupOperation, _super);
        function GroupOperation(params, owneryQuery, options, children) {
            var _this = _super.call(this, params, owneryQuery, options) || this;
            _this.children = children;
            return _this;
        }
        /**
         */
        GroupOperation.prototype.reset = function () {
            this.keep = false;
            this.done = false;
            for (var i = 0, length_2 = this.children.length; i < length_2; i++) {
                this.children[i].reset();
            }
        };
        /**
         */
        GroupOperation.prototype.childrenNext = function (item, key, owner) {
            var done = true;
            var keep = true;
            for (var i = 0, length_3 = this.children.length; i < length_3; i++) {
                var childOperation = this.children[i];
                childOperation.next(item, key, owner);
                if (!childOperation.keep) {
                    keep = false;
                }
                if (childOperation.done) {
                    if (!childOperation.keep) {
                        break;
                    }
                }
                else {
                    done = false;
                }
            }
            this.done = done;
            this.keep = keep;
        };
        return GroupOperation;
    }(BaseOperation));
    var NamedGroupOperation = /** @class */ (function (_super) {
        __extends(NamedGroupOperation, _super);
        function NamedGroupOperation(params, owneryQuery, options, children, name) {
            var _this = _super.call(this, params, owneryQuery, options, children) || this;
            _this.name = name;
            return _this;
        }
        return NamedGroupOperation;
    }(GroupOperation));
    var QueryOperation = /** @class */ (function (_super) {
        __extends(QueryOperation, _super);
        function QueryOperation() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        /**
         */
        QueryOperation.prototype.next = function (item, key, parent) {
            this.childrenNext(item, key, parent);
        };
        return QueryOperation;
    }(GroupOperation));
    var NestedOperation = /** @class */ (function (_super) {
        __extends(NestedOperation, _super);
        function NestedOperation(keyPath, params, owneryQuery, options, children) {
            var _this = _super.call(this, params, owneryQuery, options, children) || this;
            _this.keyPath = keyPath;
            _this.propop = true;
            /**
             */
            _this._nextNestedValue = function (value, key, owner) {
                _this.childrenNext(value, key, owner);
                return !_this.done;
            };
            return _this;
        }
        /**
         */
        NestedOperation.prototype.next = function (item, key, parent) {
            walkKeyPathValues(item, this.keyPath, this._nextNestedValue, 0, key, parent);
        };
        return NestedOperation;
    }(GroupOperation));
    var createTester = function (a, compare) {
        if (a instanceof Function) {
            return a;
        }
        if (a instanceof RegExp) {
            return function (b) {
                var result = typeof b === "string" && a.test(b);
                a.lastIndex = 0;
                return result;
            };
        }
        var comparableA = comparable(a);
        return function (b) { return compare(comparableA, comparable(b)); };
    };
    var EqualsOperation = /** @class */ (function (_super) {
        __extends(EqualsOperation, _super);
        function EqualsOperation() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        EqualsOperation.prototype.init = function () {
            this._test = createTester(this.params, this.options.compare);
        };
        EqualsOperation.prototype.next = function (item, key, parent) {
            if (!Array.isArray(parent) || parent.hasOwnProperty(key)) {
                if (this._test(item, key, parent)) {
                    this.done = true;
                    this.keep = true;
                }
            }
        };
        return EqualsOperation;
    }(BaseOperation));
    var createEqualsOperation = function (params, owneryQuery, options) { return new EqualsOperation(params, owneryQuery, options); };
    var NopeOperation = /** @class */ (function (_super) {
        __extends(NopeOperation, _super);
        function NopeOperation() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        NopeOperation.prototype.next = function () {
            this.done = true;
            this.keep = false;
        };
        return NopeOperation;
    }(BaseOperation));
    var numericalOperationCreator = function (createNumericalOperation) { return function (params, owneryQuery, options, name) {
        if (params == null) {
            return new NopeOperation(params, owneryQuery, options);
        }
        return createNumericalOperation(params, owneryQuery, options, name);
    }; };
    var numericalOperation = function (createTester) {
        return numericalOperationCreator(function (params, owneryQuery, options) {
            var typeofParams = typeof comparable(params);
            var test = createTester(params);
            return new EqualsOperation(function (b) {
                return typeof comparable(b) === typeofParams && test(b);
            }, owneryQuery, options);
        });
    };
    var createNamedOperation = function (name, params, parentQuery, options) {
        var operationCreator = options.operations[name];
        if (!operationCreator) {
            throw new Error("Unsupported operation: " + name);
        }
        return operationCreator(params, parentQuery, options, name);
    };
    var containsOperation = function (query, options) {
        for (var key in query) {
            if (options.operations.hasOwnProperty(key))
                return true;
        }
        return false;
    };
    var createNestedOperation = function (keyPath, nestedQuery, parentKey, owneryQuery, options) {
        if (containsOperation(nestedQuery, options)) {
            var _a = createQueryOperations(nestedQuery, parentKey, options), selfOperations = _a[0], nestedOperations = _a[1];
            if (nestedOperations.length) {
                throw new Error("Property queries must contain only operations, or exact objects.");
            }
            return new NestedOperation(keyPath, nestedQuery, owneryQuery, options, selfOperations);
        }
        return new NestedOperation(keyPath, nestedQuery, owneryQuery, options, [
            new EqualsOperation(nestedQuery, owneryQuery, options)
        ]);
    };
    var createQueryOperation = function (query, owneryQuery, _a) {
        if (owneryQuery === void 0) { owneryQuery = null; }
        var _b = _a === void 0 ? {} : _a, compare = _b.compare, operations = _b.operations;
        var options = {
            compare: compare || equals,
            operations: Object.assign({}, operations || {})
        };
        var _c = createQueryOperations(query, null, options), selfOperations = _c[0], nestedOperations = _c[1];
        var ops = [];
        if (selfOperations.length) {
            ops.push(new NestedOperation([], query, owneryQuery, options, selfOperations));
        }
        ops.push.apply(ops, nestedOperations);
        if (ops.length === 1) {
            return ops[0];
        }
        return new QueryOperation(query, owneryQuery, options, ops);
    };
    var createQueryOperations = function (query, parentKey, options) {
        var selfOperations = [];
        var nestedOperations = [];
        if (!isVanillaObject(query)) {
            selfOperations.push(new EqualsOperation(query, query, options));
            return [selfOperations, nestedOperations];
        }
        for (var key in query) {
            if (options.operations.hasOwnProperty(key)) {
                var op = createNamedOperation(key, query[key], query, options);
                if (op) {
                    if (!op.propop && parentKey && !options.operations[parentKey]) {
                        throw new Error("Malformed query. " + key + " cannot be matched against property.");
                    }
                }
                // probably just a flag for another operation (like $options)
                if (op != null) {
                    selfOperations.push(op);
                }
            }
            else {
                nestedOperations.push(createNestedOperation(key.split("."), query[key], key, query, options));
            }
        }
        return [selfOperations, nestedOperations];
    };
    var createOperationTester = function (operation) { return function (item, key, owner) {
        operation.reset();
        operation.next(item, key, owner);
        return operation.keep;
    }; };
    var createQueryTester = function (query, options) {
        if (options === void 0) { options = {}; }
        return createOperationTester(createQueryOperation(query, null, options));
    };

    var $Ne = /** @class */ (function (_super) {
        __extends($Ne, _super);
        function $Ne() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        $Ne.prototype.init = function () {
            this._test = createTester(this.params, this.options.compare);
        };
        $Ne.prototype.reset = function () {
            _super.prototype.reset.call(this);
            this.keep = true;
        };
        $Ne.prototype.next = function (item) {
            if (this._test(item)) {
                this.done = true;
                this.keep = false;
            }
        };
        return $Ne;
    }(NamedBaseOperation));
    // https://docs.mongodb.com/manual/reference/operator/query/elemMatch/
    var $ElemMatch = /** @class */ (function (_super) {
        __extends($ElemMatch, _super);
        function $ElemMatch() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        $ElemMatch.prototype.init = function () {
            if (!this.params || typeof this.params !== "object") {
                throw new Error("Malformed query. $elemMatch must by an object.");
            }
            this._queryOperation = createQueryOperation(this.params, this.owneryQuery, this.options);
        };
        $ElemMatch.prototype.reset = function () {
            _super.prototype.reset.call(this);
            this._queryOperation.reset();
        };
        $ElemMatch.prototype.next = function (item) {
            if (isArray(item)) {
                for (var i = 0, length_1 = item.length; i < length_1; i++) {
                    // reset query operation since item being tested needs to pass _all_ query
                    // operations for it to be a success
                    this._queryOperation.reset();
                    var child = item[i];
                    this._queryOperation.next(child, i, item);
                    this.keep = this.keep || this._queryOperation.keep;
                }
                this.done = true;
            }
            else {
                this.done = false;
                this.keep = false;
            }
        };
        return $ElemMatch;
    }(NamedBaseOperation));
    var $Not = /** @class */ (function (_super) {
        __extends($Not, _super);
        function $Not() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        $Not.prototype.init = function () {
            this._queryOperation = createQueryOperation(this.params, this.owneryQuery, this.options);
        };
        $Not.prototype.reset = function () {
            this._queryOperation.reset();
        };
        $Not.prototype.next = function (item, key, owner) {
            this._queryOperation.next(item, key, owner);
            this.done = this._queryOperation.done;
            this.keep = !this._queryOperation.keep;
        };
        return $Not;
    }(NamedBaseOperation));
    var $Size = /** @class */ (function (_super) {
        __extends($Size, _super);
        function $Size() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        $Size.prototype.init = function () { };
        $Size.prototype.next = function (item) {
            if (isArray(item) && item.length === this.params) {
                this.done = true;
                this.keep = true;
            }
            // if (parent && parent.length === this.params) {
            //   this.done = true;
            //   this.keep = true;
            // }
        };
        return $Size;
    }(NamedBaseOperation));
    var assertGroupNotEmpty = function (values) {
        if (values.length === 0) {
            throw new Error("$and/$or/$nor must be a nonempty array");
        }
    };
    var $Or = /** @class */ (function (_super) {
        __extends($Or, _super);
        function $Or() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = false;
            return _this;
        }
        $Or.prototype.init = function () {
            var _this = this;
            assertGroupNotEmpty(this.params);
            this._ops = this.params.map(function (op) {
                return createQueryOperation(op, null, _this.options);
            });
        };
        $Or.prototype.reset = function () {
            this.done = false;
            this.keep = false;
            for (var i = 0, length_2 = this._ops.length; i < length_2; i++) {
                this._ops[i].reset();
            }
        };
        $Or.prototype.next = function (item, key, owner) {
            var done = false;
            var success = false;
            for (var i = 0, length_3 = this._ops.length; i < length_3; i++) {
                var op = this._ops[i];
                op.next(item, key, owner);
                if (op.keep) {
                    done = true;
                    success = op.keep;
                    break;
                }
            }
            this.keep = success;
            this.done = done;
        };
        return $Or;
    }(NamedBaseOperation));
    var $Nor = /** @class */ (function (_super) {
        __extends($Nor, _super);
        function $Nor() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = false;
            return _this;
        }
        $Nor.prototype.next = function (item, key, owner) {
            _super.prototype.next.call(this, item, key, owner);
            this.keep = !this.keep;
        };
        return $Nor;
    }($Or));
    var $In = /** @class */ (function (_super) {
        __extends($In, _super);
        function $In() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        $In.prototype.init = function () {
            var _this = this;
            this._testers = this.params.map(function (value) {
                if (containsOperation(value, _this.options)) {
                    throw new Error("cannot nest $ under " + _this.constructor.name.toLowerCase());
                }
                return createTester(value, _this.options.compare);
            });
        };
        $In.prototype.next = function (item, key, owner) {
            var done = false;
            var success = false;
            for (var i = 0, length_4 = this._testers.length; i < length_4; i++) {
                var test = this._testers[i];
                if (test(item)) {
                    done = true;
                    success = true;
                    break;
                }
            }
            this.keep = success;
            this.done = done;
        };
        return $In;
    }(NamedBaseOperation));
    var $Nin = /** @class */ (function (_super) {
        __extends($Nin, _super);
        function $Nin() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        $Nin.prototype.next = function (item, key, owner) {
            _super.prototype.next.call(this, item, key, owner);
            this.keep = !this.keep;
        };
        return $Nin;
    }($In));
    var $Exists = /** @class */ (function (_super) {
        __extends($Exists, _super);
        function $Exists() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.propop = true;
            return _this;
        }
        $Exists.prototype.next = function (item, key, owner) {
            if (owner.hasOwnProperty(key) === this.params) {
                this.done = true;
                this.keep = true;
            }
        };
        return $Exists;
    }(NamedBaseOperation));
    var $And = /** @class */ (function (_super) {
        __extends($And, _super);
        function $And(params, owneryQuery, options, name) {
            var _this = _super.call(this, params, owneryQuery, options, params.map(function (query) { return createQueryOperation(query, owneryQuery, options); }), name) || this;
            _this.propop = false;
            assertGroupNotEmpty(params);
            return _this;
        }
        $And.prototype.next = function (item, key, owner) {
            this.childrenNext(item, key, owner);
        };
        return $And;
    }(NamedGroupOperation));
    var $All = /** @class */ (function (_super) {
        __extends($All, _super);
        function $All(params, owneryQuery, options, name) {
            var _this = _super.call(this, params, owneryQuery, options, params.map(function (query) { return createQueryOperation(query, owneryQuery, options); }), name) || this;
            _this.propop = true;
            return _this;
        }
        $All.prototype.next = function (item, key, owner) {
            this.childrenNext(item, key, owner);
        };
        return $All;
    }(NamedGroupOperation));
    var $eq = function (params, owneryQuery, options) {
        return new EqualsOperation(params, owneryQuery, options);
    };
    var $ne = function (params, owneryQuery, options, name) { return new $Ne(params, owneryQuery, options, name); };
    var $or = function (params, owneryQuery, options, name) { return new $Or(params, owneryQuery, options, name); };
    var $nor = function (params, owneryQuery, options, name) { return new $Nor(params, owneryQuery, options, name); };
    var $elemMatch = function (params, owneryQuery, options, name) { return new $ElemMatch(params, owneryQuery, options, name); };
    var $nin = function (params, owneryQuery, options, name) { return new $Nin(params, owneryQuery, options, name); };
    var $in = function (params, owneryQuery, options, name) { return new $In(params, owneryQuery, options, name); };
    var $lt = numericalOperation(function (params) { return function (b) { return b < params; }; });
    var $lte = numericalOperation(function (params) { return function (b) { return b <= params; }; });
    var $gt = numericalOperation(function (params) { return function (b) { return b > params; }; });
    var $gte = numericalOperation(function (params) { return function (b) { return b >= params; }; });
    var $mod = function (_a, owneryQuery, options) {
        var mod = _a[0], equalsValue = _a[1];
        return new EqualsOperation(function (b) { return comparable(b) % mod === equalsValue; }, owneryQuery, options);
    };
    var $exists = function (params, owneryQuery, options, name) { return new $Exists(params, owneryQuery, options, name); };
    var $regex = function (pattern, owneryQuery, options) {
        return new EqualsOperation(new RegExp(pattern, owneryQuery.$options), owneryQuery, options);
    };
    var $not = function (params, owneryQuery, options, name) { return new $Not(params, owneryQuery, options, name); };
    var typeAliases = {
        number: function (v) { return typeof v === "number"; },
        string: function (v) { return typeof v === "string"; },
        bool: function (v) { return typeof v === "boolean"; },
        array: function (v) { return Array.isArray(v); },
        null: function (v) { return v === null; },
        timestamp: function (v) { return v instanceof Date; }
    };
    var $type = function (clazz, owneryQuery, options) {
        return new EqualsOperation(function (b) {
            if (typeof clazz === "string") {
                if (!typeAliases[clazz]) {
                    throw new Error("Type alias does not exist");
                }
                return typeAliases[clazz](b);
            }
            return b != null ? b instanceof clazz || b.constructor === clazz : false;
        }, owneryQuery, options);
    };
    var $and = function (params, ownerQuery, options, name) { return new $And(params, ownerQuery, options, name); };
    var $all = function (params, ownerQuery, options, name) { return new $All(params, ownerQuery, options, name); };
    var $size = function (params, ownerQuery, options) { return new $Size(params, ownerQuery, options, "$size"); };
    var $options = function () { return null; };
    var $where = function (params, ownerQuery, options) {
        var test;
        if (isFunction(params)) {
            test = params;
        }
        else if (!process.env.CSP_ENABLED) {
            test = new Function("obj", "return " + params);
        }
        else {
            throw new Error("In CSP mode, sift does not support strings in \"$where\" condition");
        }
        return new EqualsOperation(function (b) { return test.bind(b)(b); }, ownerQuery, options);
    };

    var defaultOperations = /*#__PURE__*/Object.freeze({
        __proto__: null,
        $Size: $Size,
        $eq: $eq,
        $ne: $ne,
        $or: $or,
        $nor: $nor,
        $elemMatch: $elemMatch,
        $nin: $nin,
        $in: $in,
        $lt: $lt,
        $lte: $lte,
        $gt: $gt,
        $gte: $gte,
        $mod: $mod,
        $exists: $exists,
        $regex: $regex,
        $not: $not,
        $type: $type,
        $and: $and,
        $all: $all,
        $size: $size,
        $options: $options,
        $where: $where
    });

    var createDefaultQueryOperation = function (query, ownerQuery, _a) {
        var _b = _a === void 0 ? {} : _a, compare = _b.compare, operations = _b.operations;
        return createQueryOperation(query, ownerQuery, {
            compare: compare,
            operations: Object.assign({}, defaultOperations, operations || {})
        });
    };
    var createDefaultQueryTester = function (query, options) {
        if (options === void 0) { options = {}; }
        var op = createDefaultQueryOperation(query, null, options);
        return createOperationTester(op);
    };

    exports.$Size = $Size;
    exports.$all = $all;
    exports.$and = $and;
    exports.$elemMatch = $elemMatch;
    exports.$eq = $eq;
    exports.$exists = $exists;
    exports.$gt = $gt;
    exports.$gte = $gte;
    exports.$in = $in;
    exports.$lt = $lt;
    exports.$lte = $lte;
    exports.$mod = $mod;
    exports.$ne = $ne;
    exports.$nin = $nin;
    exports.$nor = $nor;
    exports.$not = $not;
    exports.$options = $options;
    exports.$or = $or;
    exports.$regex = $regex;
    exports.$size = $size;
    exports.$type = $type;
    exports.$where = $where;
    exports.EqualsOperation = EqualsOperation;
    exports.createDefaultQueryOperation = createDefaultQueryOperation;
    exports.createEqualsOperation = createEqualsOperation;
    exports.createOperationTester = createOperationTester;
    exports.createQueryOperation = createQueryOperation;
    exports.createQueryTester = createQueryTester;
    exports.default = createDefaultQueryTester;

    Object.defineProperty(exports, '__esModule', { value: true });

})));


}).call(this)}).call(this,require('_process'))
},{"_process":2}],10:[function(require,module,exports){
var objectTool = require('async-objects');
var CharacterScanBuffer = require('character-scanner');
var check = function(s, prefix, suffix, cb){
    var str = s;
    if(prefix){
        if(str.slice(0, prefix.length) !== prefix) return false;
        str = str.slice(prefix.length);
    }
    if(suffix){
        if(str.slice(str.length - suffix.length) !== suffix) return false;
        str = str.slice(0, str.length - suffix.length);
    }
    return cb(str);
}
var types = {
    'UPC-A' : function(str, prefix, suffix){
        return check(str, prefix, suffix, function(s){
            var res = s.match(/[0-9]{12,19}/g);
            return res;
        });
    },
    'EAN-13' : function(str, prefix, suffix){
        return check(str, prefix, suffix, function(s){
            var res = s.match(/[0-9]{14,21}/g);
            return res;
        });
    },
    'EAN-8' : function(str, prefix, suffix){
        return check(str, prefix, suffix, function(s){
            var res = s.match(/[0-9]{8}/g);
            return res;
        });
    }
}
var internalScanner;
var BarcodeScan = function(opts){
    var options = opts || {};
    if(typeof opts == 'function') options = {onScan:options};
    if(!options.scanner && !internalScanner) internalScanner = new CharacterScanBuffer();
    var scanner = options.scanner || internalScanner;
    var callback = options.onScan || options.callback;
    var passes = function(str, typeNames){
        var result = false;
        var test;
        return typeNames.reduce(function(agg, name){
            if(!types[name]) throw Error('Unknown Type: '+name);
            return agg || types[name](str, options.prefix, options.suffix);
        }, false);
    }
    scanner.addScanner({
        name:'barcode-scan',
        scan: function(str){
            return passes(str, [
                'UPC-A',
                'EAN-13',
                'EAN-8',
            ]);
        }
    });
    var swipes = {};
    scanner.on('barcode-scan', function(sc){
        var scan = sc[0] || sc;
        //augment meta
        var res = {};
        Object.keys(types).map(function(type){
            var t = types[type](scan);
            res[type] = (t && t[0]) === scan;
        });
        var scanType;
        Object.keys(res).forEach(function(type){
            if(res[type]) scanType = type;
        });
        callback({
            code : scan,
            type : scanType
        });
    });
};
module.exports = {
    listen : function(node, scanner){
        var handler = function(e){ scanner.input(e.key) }
        if(node.addEventListener){
            node.addEventListener('keydown', handler);
        }else{
            if(node.on){
                node.on('keydown', handler);
            }
        }
    },
    Scan: BarcodeScan
}
module.exports.Scanner = CharacterScanBuffer;

},{"async-objects":5,"character-scanner":6}]},{},[3]);

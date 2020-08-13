const EventEmitter = require('events');
const path = require('path');
const dateFormat = require('dateformat');
const { logger } = require('./logger.js');

class VAEmitter extends EventEmitter {
  constructor() {
    super();
    this._skipTime = 0;
  }

  set skipTime(seconds) {
    this._skipTime = seconds * 1000;
  }

  skip(event, handler, ...args) {
    return (...args) => {
      if (Date.now() - this.actionTime < this._skipTime) {
        logger.info('Skip', event);
        return;
      }
      handler(...args);
    };
  }

  emit_(event, ...args) {
    if (typeof args[0]  === 'object') {
      args[0].event_time = dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss.l');
    }
    return this.emit(event, ...args);
  }

  on_(event, handler, ...args) {
    return this.on(event, this.skip(event, handler, ...args));
  }

  on_async(event, handler, ...args) {
    return this.on(event, (...args) => setImmediate(handler, ...args));
  }

  on_async_(event, handler, ...args) {
    return this.on_async(event, this.skip(event, handler, ...args));
  }
}

let instance = new VAEmitter();
instance.setMaxListeners(100);
module.exports = instance;

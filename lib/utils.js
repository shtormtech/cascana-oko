const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const util = require('util');

const dir = path.dirname(require.main.filename);

module.exports = {
  getHttpServer(app, options={}) {
    app.set('x-powered-by', false);
    const { cert_file } = options;
    if (cert_file) {
      const cert = key = fs.readFileSync(path.resolve(dir, '..', 'tls', cert_file));
      return https.createServer({cert, key}, app);
    } else {
      return http.createServer(app);
    }
  },

  // Node 8 required
  promisify(object, methods) {
    methods.forEach(m => object[m] = util.promisify(object[m]));
  },

  convertTimeouts(object, def) {
    const timeouts = {};
    Object.keys(object || def).forEach(p => timeouts[p] = object[p] * 1000);
    return timeouts;
  }
};

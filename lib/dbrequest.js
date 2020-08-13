const request = require('superagent');
const { logger, parseError } = require('./logger.js');
const { convertTimeouts } = require('./utils.js');

function read(req) {
  const { host, port, params, agent_timeouts, throwError } = req;
  logger.debug('DB read request:', req);
  return request
    .get(`http://${host}:${port}/read`)
    .timeout(convertTimeouts(agent_timeouts, {response: 30, deadline: 60}))
    .query(params)
    .catch(err => {
      logger.error('DB READ ERROR:', parseError(err));
      if (throwError) throw(err);
    });
}

function write(req) {
  const { host, port, params, throwError } = req;
  logger.debug('DB write request:', req);
  return request
    .post(`http://${host}:${port}/write`)
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(params))
    .catch(err => {
      logger.error('DB WRITE ERROR:', parseError(err));
      if (throwError) throw(err);
    });
}

function preread(req, ref) {
  return read(req).then(res => {
    if (res && res.body) {
      ref = res.body;
    }
    return Promise.resolve(ref);
  });
}

module.exports = { read, write, preread };

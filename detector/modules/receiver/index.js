const express = require('express');
const path = require('path');
const ipfilter = require('express-ip-filter');
const { logger, loghttp, parseError } = require('@lib/logger.js');
const emitter = require('@lib/emitter.js');
const { getHttpServer } = require('@lib/utils.js');
let { listen_host, listen_port, cert_file,
  ip_wlist, body_limit, decache } = require('@lib/config.js');
decache('@lib/config.js');

const eventPrefix = 'net';
const filterMsg = 'Forbidden';
function onError(res) {
  return (err) => {
    const msg = parseError(err);
    logger.error(msg);
    res
      .status(500)
      .type('txt')
      .send(msg);
  };
}

const app = express();
const json = express.Router();
app
  .use(loghttp(listen_port))
  .use(ipfilter({
    filter: ip_wlist.split(/ +/g),
    forbidden: () => {
      logger.info(filterMsg);
      return filterMsg;
    }
  }))
  .use('/json', json);

json.post('/',
  express.json({
    limit: `${body_limit}mb`
  }),
  (req, res) => {
    try {
      logger.debug(req.body);
      const { type, data } = req.body;
      const result = type && emitter.emit(`${eventPrefix}_${type}`, data) || false;
      res.json({ok: result});
    } catch (e) {
      onError(res)(e);
    }
  }
);

getHttpServer(app, {cert_file})
  .listen(listen_port, listen_host, () => {
    logger.info('Receiver module listening %s on port %i', listen_host, listen_port);
    process.send && process.send('ready');
  });

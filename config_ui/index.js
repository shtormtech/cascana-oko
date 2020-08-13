require('module-alias/register');
const path = require('path');
const express = require('express');
const pug = require('pug');
const { logger, loghttp, parseError } = require('@lib/logger.js');
const emitter = require('@lib/emitter.js');
const digest = require('@lib/digest.js');
const { preread } = require('@lib/dbrequest.js');
const { getHttpServer } = require('@lib/utils.js');
const { listen_host, listen_port, cert_file,
  user, password, log_date_format,
  config_port, db_svc, decache } = require('@lib/config.js');
decache('@lib/config.js');

const hosts = require('./hosts.json');
const basedir = path.resolve(__dirname, '..', 'lib_ui');

// Prepare client template scripts
require('dot').process({
  global: 'window',
  path: path.join(__dirname, 'templates'),
  destination: path.join(__dirname, 'render')
});

// Preread DB
let events = [];
preread(Object.assign({params: {
  table:     'stats.events',
  columns:   'name, description',
  condition: 'id > 4'
}}, db_svc), events)
  .then(result => events = result);

function onError(res) {
  return (err) => {
    const msg = parseError(err);
    logger.error(msg);
    res.status(500).type('txt').send(msg);
  };
}

const app = express();
const lib = express.Router();
app.use(loghttp(listen_port))
  .use(digest(user, password))
  .use(express.static(path.join(__dirname, 'static')))
  .use(express.static(path.join(basedir, 'static')))
  .use('/render/', express.static(path.join(__dirname, 'render')))
  .use('/lib', lib);
lib.use(express.static(path.join(__dirname, 'node_modules')));

app.get('/', (req, res) => {
  res.redirect('/services');
});

app.get('/events', (req, res) => {
  res.json(events);
});

app.get('/:name', (req, res) =>
  res.render(path.join(__dirname, 'views', 'config.pug'), {
    basedir,
    config_port,
    hosts,
    log_date_format
  })
);

getHttpServer(app, {cert_file})
  .listen(listen_port, listen_host, () => {
    logger.info('Config UI service listening %s on port %i', listen_host, listen_port);
    process.send && process.send('ready');
  });

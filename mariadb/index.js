require('module-alias/register');
const path = require('path');
const express = require('express');
const mariadb = require('mariadb');
const ipfilter = require('express-ip-filter');
const { logger, loghttp } = require('@lib/logger.js');
const dbclient = require('@lib/dbclient.js');
const { getHttpServer } = require('@lib/utils.js');
const { listen_host, listen_port, cert_file,
  ip_wlist, db_options, decache } = require('@lib/config.js');
decache('@lib/config.js');

// DB connectivity
let callback = dbclient.oninit('No DB connection');
mariadb.createConnection(db_options)
  .then(conn => {
    onready(conn);
    callback = dbclient.onready(conn.query);
    logger.info('DB ready');
  })
  .catch(err => {
    logger.error(err);
    process.exit(1);
  });

function onready(conn) {
  process.on('SIGINT', () => {
     conn.end()
       .then(() => {
         process.exit(0);
       })
       .catch(err => {
         logger.error(err);
         process.exit(1);
       });
  });
  process.send && process.send('ready');
}

// Web service
const app = express();
const filterMsg = 'Forbidden';
app.use(loghttp(listen_port))
  .use(ipfilter({
    filter: ip_wlist.split(/ +/g),
    forbidden: () => {
      logger.info(filterMsg);
      return filterMsg;
    }
  }));

app.get('/', (req, res) =>
  res.type('txt').send('OK'));

app.get('/read', (req, res) => callback(req, res));
app.post('/write', express.json(), (req, res) => callback(req, res));

app.all('*', (req, res) =>
  res.status(404).type('txt').send('Not found'));

getHttpServer(app, {cert_file})
  .listen(listen_port, listen_host, () =>
    logger.info('MariaDB service listening %s on port %i', listen_host, listen_port));

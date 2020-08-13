require('module-alias/register');
const fs = require('fs');
const path = require('path');
const express = require('express');
const ipfilter = require('express-ip-filter');
const app = express();
const ms = require('ms');
const { logger, loghttp } = require('@lib/logger.js');
const { getHttpServer } = require('@lib/utils.js');
let { listen_host, listen_port, cert_file, ip_wlist, cache_max_age,
  photodir, origdir, archivedir, decache } = require('@lib/config.js');
decache('@lib/config.js');

cache_max_age += 'd';

const origBase = path.resolve(__dirname, origdir);
const photoBase = path.resolve(__dirname, photodir);
const archiveBase = path.resolve(photoBase, archivedir);
const staticOptions = {
  immutable:    true,
  maxAge:       cache_max_age
};
const filterMsg = 'Forbidden';

app.disable('etag');
app.use(loghttp(listen_port))
  .use(ipfilter({
    filter: ip_wlist.split(/ +/g),
    forbidden: () => {
      logger.info(filterMsg);
      return filterMsg;
    }
  }))
  .use(express.static(path.join(__dirname, 'static'), staticOptions))
  .use('/photo/', express.static(photoBase, staticOptions))
  .use('/orig/', express.static(origBase, staticOptions));

app.get('/photo*', (req, res) => {
  const fileName = path.basename(req.path);
  if (!/^\d{17}/.test(fileName)) {
    res.status(404).send('Not found');
    return;
  }
  const archiveName = fileName.slice(0, 8);
  const fullPath = path.join(archiveBase, archiveName, req.path.replace(/^\/[^\/]+/, ''));
  logger.debug('Send file', fullPath);
  if (fs.existsSync(fullPath)) {
    res.set({
      'Cache-Control': `public, max-age=${ms(cache_max_age)/1000}, immutable`
    }).sendFile(fullPath);
  } else {
    res.status(404).send('Not found');
  }
});

getHttpServer(app, {cert_file})
  .listen(listen_port, listen_host, () => {
    logger.info('Photo service listening %s on port %i', listen_host, listen_port);
    process.send && process.send('ready');
  });

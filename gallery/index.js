require('module-alias/register');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const express = require('express');
const io = require('socket.io');
const chokidar = require('chokidar');
const digest = require('@lib/digest.js');
const { logger, loghttp, parseError } = require('@lib/logger.js');
const { getHttpServer } = require('@lib/utils.js');
const { listen_host, listen_port, cert_file, user, password,
  photodir, decache } = require('@lib/config.js');
decache('@lib/config.js');

const photoBase = path.resolve(__dirname, photodir);
const format = 'jpg';
const watcher = chokidar.watch(['**/*.jpg', '**/*.png'], {
  cwd: photoBase,
  awaitWriteFinish: {
    stabilityThreshold: 1000,
    pollInterval: 100
  }
});

const getFileStats = (path) =>
  fs.existsSync(path) && fs.statSync(path);

const app = express();
app.use(loghttp(listen_port))
  .use(digest(user, password))
  .use(express.static(path.join(__dirname, 'static')))
  .use('/jquery/', express.static(path.resolve(__dirname, 'node_modules', 'jquery', 'dist')))
  .use('/gallery/', express.static(photoBase))
  .use((req, res) => {
    const fullPath = path.join(photoBase, req.path);
    const fstat = getFileStats(fullPath);
    logger.debug('Path', fullPath, fstat && (fstat.isFile() && 'is file' || fstat.isDirectory() && 'is directory' || 'exists') || 'not exists');
    if (fstat) {
      fstat.isFile() && res.sendFile(fullPath);
      fstat.isDirectory() && res.sendFile(path.join(__dirname, 'static', 'index.html'));
    } else {
      res.status(404).send('Not found');
    }
  });

const parse = (name) => +path.basename(name).replace(/(_.+)?\.[^\.]+$/, '');
const descending = (name1, name2) => (parse(name2) - parse(name1)) || 0;

let imageList = [];
let sockets = {};
const sendDirContent = (socket, fullPath) => {
  (sockets[fullPath] = sockets[fullPath] || []).push(socket);
  logger.info('Read', fullPath);
  fs.readdir(fullPath, (err, files) => {
    if (err) {
      logger.error('DIR READ ERROR:', parseError(err));
    } else {
      imageList = [...files]
        .filter(name => /\.(jpg|png)$/.test(name))
        .sort(descending);
      socket.emit('init', imageList);
      logger.info('%i image names sent', imageList.length);
    }
  });
};

const removeSocket = (id) =>
  Object.keys(sockets).forEach(key => sockets[key] = sockets[key].filter(s => s.id!=id));

const http = getHttpServer(app, {cert_file});
const ws = io(http);
ws.on('connection', (socket) => {
  logger.info('Referer:', socket.handshake.headers.referer);
  logger.info('Gallery user connected (%i)', ws.engine.clientsCount);
  const referer = new URL(socket.handshake.headers.referer);
  const fullPath = path.join(photoBase, referer.pathname);
  const fstat = getFileStats(fullPath);
  fstat && fstat.isDirectory() && sendDirContent(socket, fullPath);
  socket.on('disconnect', () => {
    removeSocket(socket.id);
    logger.info('Gallery user disconnected (%i)', ws.engine.clientsCount);
  });
});

const getSockets = (name) =>
  sockets[path.join(photoBase, path.dirname(name))] || [];

watcher
  .on('add', (name) => {
    getSockets(name).forEach(s => s.emit('add', path.basename(name)));
    logger.info('File %s has been added', name);
  })
  .on('unlink', (name) => {
    getSockets(name).forEach(s => s.emit('remove', path.basename(name)));
    logger.info('File %s has been removed', name);
  })
  .on('error', (err) => {
    //sendDirContent();
    logger.error('WATCH ERROR:', parseError(err));
  })

http.listen(listen_port, listen_host, () => {
  logger.info('Gallery UI listening %s on port %i', listen_host, listen_port);
  process.send && process.send('ready');
});

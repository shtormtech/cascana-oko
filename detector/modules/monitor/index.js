const express = require('express');
const path = require('path');
const io = require('socket.io');
const { preread } = require('@lib/dbrequest.js');
const { logger } = require('@lib/logger.js');
const emitter = require('@lib/emitter.js');
const { getHttpServer } = require('@lib/utils.js');
const { listen_host, listen_port, cert_file,
  db_svc, photo_svc, video_svc, decache } = require('@lib/config.js');
decache('@lib/config.js');

// Preread DB
let promises = [];
let zones = [];
promises.push(preread(Object.assign({params: {
  table:   'stats.cameras',
  columns: 'camera_id, zone_id'
}}, db_svc), zones).then(result => zones = result
  .filter(entry => entry.camera_id == video_svc.id)
  .map(entry => entry.zone_id)
));
let events = [];
preread(Object.assign({params: {
  table:   'stats.events',
  columns: 'id, name, description'
}}, db_svc), events).then(result => events = result);

let initData = { video_svc, photo_svc };
emitter.on('init', data => {
  Object.assign(initData, data);
  let pushData = Object.assign({}, data);
  const params = {
    table:     'stats.services',
    columns:   'description',
    condition: `name="${data.process_module}"`
  };
  promises.push(preread(Object.assign({params}, db_svc)).then(result =>
    pushData.procModDesc = initData.procModDesc = result[0].description
  ));
  Promise.all(promises).then(() => {
    pushData.zones = initData.zones = zones;
    ws.sockets.emit('init', pushData);
  });
});

function push(status, data) {
  ws.sockets.emit('status_update', status, data);
}

const app = express();
const lib = express.Router();
app.use(express.static(path.join(__dirname, 'static')))
  .use('/lib', lib);
lib.use(express.static(path.resolve(__dirname, '..', '..', 'node_modules')))

const http = getHttpServer(app, {cert_file});
const ws = io(http);
ws.on('connection', (socket) => {
  logger.info('Monitor user connected (%i)', ws.engine.clientsCount);
  socket.emit('init', initData);
  socket.on('disconnect', () => {
    logger.info('Monitor user disconnected (%i)', ws.engine.clientsCount);
  });
});

['face_caught', 'recognition', 'verification_ready', 'verification', 'verification_end', 'not_found']
  .forEach((event) =>
    emitter.on_async(event, () => push(event)));

['face_detected', 'face_processed', 'face_true', 'face_false', 'stat_event']
  .forEach(event =>
    emitter.on_async(event, (data) => {
      let entry = events.find(e => e.name == event || e.id == data.event_id) || {};
      push(event, Object.assign({
        eventName: entry.name,
        eventDesc: entry.description
      }, data))
    }));

http.listen(listen_port, listen_host, () =>
  logger.info('Monitor module listening %s on port %i', listen_host, listen_port));

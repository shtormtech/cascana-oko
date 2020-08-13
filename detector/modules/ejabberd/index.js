const path = require('path');
const { URL } = require('url');
const request = require('superagent');
const { logger, parseError } = require('@lib/logger.js');
const { convertTimeouts } = require('@lib/utils.js');
const emitter = require('@lib/emitter.js');
const { preread } = require('@lib/dbrequest.js');
const { url, agent_timeouts, events,
  db_svc, photo_svc, decache } = require('@lib/config.js');
decache('@lib/config.js');

let dots = require('dot').process({path: path.dirname(module.filename)});

const domain = new URL(url).hostname;
const msgPrefix = 'va.';
const getMsgId = () => msgPrefix + parseInt(Math.random()*1e10).toString(32);
const encodeXml = (text) => {
  [['"', '&apos;'], ['\'', '&quot;'], ['<', '&lt;'], ['>', '&gt;'], ['&', '&amp;']]
    .forEach(entry => text.replace(new RegExp(entry[0], 'g'), entry[1]));
  return text;
};
const encodeRoomName = (name) => name.replace(/ /g, '_');

events.forEach(e => emitter.on_async_(e.name, (...args) => report(e, ...args)));

// Preread DB
let zones = [];
preread(Object.assign({params: {
  table:   'stats.cameras',
  columns: 'camera_id, zone_id'
}}, db_svc), zones)
  .then(result => zones = result);

function sendMessage(xmpp) {
  logger.info('Sending XMPP message...');
  logger.debug('%s', xmpp);
  request
    .post(url)
    .timeout(convertTimeouts(agent_timeouts))
    .send(xmpp)
    .then(res => {
      logger.debug('Ejabberd response:', res.text);
    })
    .catch(err => {
      logger.error('EJABBERD REPORT FAILED:', parseError(err));
    });
}

function report(event, data={}) {
  const { fio, camera_id, file_name, event_time } = data;
  const person = fio || '';
  const zone = zones
    .filter(entry => entry.camera_id == camera_id)
    .map(entry => entry.zone_id);
  const msg = JSON.parse(dots.chat_message({
    time: (event_time || '').substring(11, 19),
    text: event.desc,
    camera_id, zone, person
  }));
  const rooms = JSON.parse(dots.room_name({camera_id, zone: JSON.stringify(zone), person}));
  Object.keys(rooms).forEach(key => {
    rooms[key].forEach(name =>
      name && sendMessage(dots.xmpp_message({
        domain,
        id:      getMsgId(),
        room:    encodeRoomName(name),
        message: encodeXml(msg[key]),
        image:   encodeXml(`//${photo_svc.host}:${photo_svc.port}/${camera_id}/${file_name}`)
      })))
  });
}

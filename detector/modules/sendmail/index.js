const { URL } = require('url');
const path = require('path');
const nodemailer = require('nodemailer');
const { logger, parseError } = require('@lib/logger.js');
const emitter = require('@lib/emitter.js');
const { preread } = require('@lib/dbrequest.js');
const { transport, smtp, events, photodir, db_svc, decache } = require('@lib/config.js');
decache('@lib/config.js');

let dots = require('dot').process({path: path.dirname(module.filename)});

// Verify SMTP server
let transporter;
if (transport.sendmail) {
  transporter = nodemailer.createTransport(transport);
  setHandlers();
} else {
  transporter = nodemailer.createTransport(smtp);
  transporter.verify()
    .then(() => setHandlers())
    .catch(err => logger.error('SMTP ERROR:', parseError(err)));
}

// Preread DB
let zones = [];
preread(Object.assign({params: {
  table:   'stats.cameras',
  columns: 'camera_id, zone_id'
}}, db_svc), zones).then(result => zones = result);
let recipients = [];
preread(Object.assign({params: {
  table:   'staff.mailing',
  columns: 'email, event_ids, zone_ids, persons'
}}, db_svc), recipients).then(result => recipients = result);

function setHandlers() {
  events.forEach(e => emitter.on_async_(e.name, (...args) => report(e, ...args)));
}

function sendMail(msg) {
  logger.info('Sending mail to %s...', msg.to);
  logger.debug('%j', msg);
  transporter.sendMail(msg)
    .then(info => logger.debug(info))
    .catch(err => logger.error('MAIL SEND ERROR:', parseError(err)));
}

function report(event, data={}) {
  const text = event.desc;
  const color = event.color;
  const { fio, camera_id, file_name, event_time } = data;
  const time = (event_time || '').substring(11, 19);
  const person = fio || '';
  const fioArr = person.toLowerCase().split(/\s+/);
  const zone = zones
    .filter(entry => entry.camera_id == camera_id)
    .map(entry => entry.zone_id);
  const check = (item) => {
    let result1 = !!(item.event_ids && item.event_ids.split(/,\s*/).includes(event.name));
    logger.debug('Check %s for %s subscription: %s', item.email, event.name, result1);
    let result2 = !!(item.zone_ids && item.zone_ids.split(/,\s*/).some(z => zone.includes(z)));
    logger.debug('Check %s for %s subscription: %s', item.email, zone, result2);
    let result3 = !!(person && item.persons && item.persons.split(/\s+/).every(s => fioArr.includes(s.toLowerCase())));
    logger.debug('Check %s for "%s" subscription: %s', item.email, person, result3);
    return result1 || result2 || result3;
  };
  recipients.forEach(entry =>
    check(entry) && sendMail(JSON.parse(dots.message({
      to:       entry.email,
      file_name,
      path:     path.join(photodir, camera_id, file_name),
      text:     dots.body_text({time, camera_id, zone, person, file_name, text}),
      html:     dots.body_html({time, camera_id, zone, person, file_name, text, color}).replace(/"/g, '\\"')
    })))
  );
}

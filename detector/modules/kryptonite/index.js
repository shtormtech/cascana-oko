const fs = require('fs');
const path = require('path');
const request = require('superagent');
const { logger, parseError } = require('@lib/logger.js');
const { promisify, convertTimeouts } = require('@lib/utils.js');
const emitter = require('@lib/emitter.js');
const { preread } = require('@lib/dbrequest.js');
const { base_url, user, password, agent_timeouts, db_svc, cache_db,
  facedir, verificate_timeout, threshold, decache } = require('@lib/config.js');
decache('@lib/config.js');

promisify(fs, ['readFile']);

// Preread DB
let persons = [];
cache_db && getPersons().then(result => persons = result);

function getPersons(key) {
  const params = {
    table:     'staff.persons',
    columns:   'concat_ws(" ", surname, name, patronymic) as fio, pass_num, external_id',
    condition: key == undefined ? '' : `pass_num='${key}'`
  };
  return preread(Object.assign({params}, db_svc), persons);
}

function whois(key) {
  if (!key) return Promise.resolve(key);
  const person = persons.find(p =>
    p.pass_num == `${key}`);
  return person ?
    Promise.resolve([person]) :
    getPersons(key);
}

function readOrigPhoto(id) {
  const filePath = path.join(facedir, `${id}.jpg`);
  return fs.readFile(filePath);
}

let verificate;
emitter.on_async_('net_reader_key', mapToFace);
emitter.on_async_('face_caught', (data) => verificate && verificate(data));

function mapToFace(data) {
  const { key } = data;
  whois(key)
    .then(result => {
      logger.debug('Search result: %j', result);
      if (result && result[0]) {
        const { external_id } = result[0];
        readOrigPhoto(external_id)
          .then(buf => emitter.emit_('face_orig', { buf, external_id }))
          .catch(err => {
            logger.debug(parseError(err));
            onNotFound();
          });
      } else {
        onNotFound();
      }
    })
}

function onNotFound() {
  emitter.emit('not_found');
  setTimeout(() => emitter.emit('verification_end'), 2000);
}

function getRequestBody(origImg, camImg) {
  const encode = 'base64';
  const body = {
    inputs: [[
      { b64: origImg.toString(encode) },
      { b64: camImg.toString(encode) }
    ]]
  };
  //fs.writeFile('test.json', JSON.stringify(body), err => console.log(err));
  return body;
}

function prepare(json) {
  try {
    const { outputs } = json;
    return {
      check_ok: +outputs[0] >= +threshold/100
    };
  } catch (e) {
    throw new Error('Wrong response: ' + JSON.stringify(json));
  }
}

emitter.on('face_orig', ({ buf, external_id }) => {
  if (verificate) return;
  emitter.emit('verification_ready');
  verificate = (data) => {
    const TIME0 = Date.now();
    emitter.emit('verification');
    const { image, camera_id, file_name, file_size } = data;
    logger.info('Sending %s to API...', file_name);
    request
      .post(base_url)
      .auth(user, password)
      .timeout(convertTimeouts(agent_timeouts))
      .set({
        'Content-Type': 'application/json'
      })
      .send(getRequestBody(buf, image))
      .then(res => {
        logger.debug(JSON.stringify(res.body, null, 2));
        const duration = Date.now() - TIME0;
        const service_response = JSON.stringify(res.body);
        emitter.emit_('face_processed', Object.assign(prepare(res.body), {
          external_id,
          camera_id,
          file_name,
          file_size,
          duration: Object.assign({'face_processed': duration}, data.duration),
          service_response,
          threshold
        }));
        emitter.emit_('stat_event', {
          event_id: 4,
          camera_id,
          file_name,
          file_size,
          duration,
          service_response
        });
        verificate = undefined;
      })
      .catch(err => {
        logger.debug('%j', err.response && err.response.body);
        logger.error('VERIFICATION FAILED:', parseError(err));
        emitter.emit_('stat_event', {
          event_id: 5,
          camera_id,
          file_name,
          file_size,
          duration: Date.now() - TIME0
        });
      });
  };
  setTimeout(() => {
    emitter.emit('verification_end');
    verificate = undefined;
  }, verificate_timeout*1000);
});

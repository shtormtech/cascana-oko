const path = require('path');
const { logger, parseError } = require('@lib/logger.js');
const emitter = require('@lib/emitter.js');
const { preread } = require('@lib/dbrequest.js');
const { db_svc, cache_db, decache } = require('@lib/config.js');
decache('@lib/config.js');

emitter.on_async_('face_processed', checkPerson);

// Preread DB
let persons = [];
cache_db && getPersons().then(result => persons = result);

function getPersons(id) {
  const params = {
    table:     'staff.persons',
    columns:   'id, surname, concat_ws(" ", surname, name, patronymic) as fio, external_id, face_id',
    condition: id == undefined ? '' : `external_id='${id}' or face_id='${id}'`
  };
  return preread(Object.assign({params}, db_svc), persons);
}

function whois(id) {
  if (!id) return Promise.resolve(id);
  const person = persons.find(p =>
    p.external_id == `${id}`);
  return person ?
    Promise.resolve([person]) :
    getPersons(id);
}

function extractFio(json) {
  if (!json) return;
  let { id, surname, fio } = json[0];
  return !id || surname ? fio : `${fio.trim()} ${id}`;
}

function checkPerson(data) {
  logger.debug('Action input data: %j', data);
  const TIME0 = Date.now();
  const { camera_id, file_name, external_id, check_ok } = data;
  whois(external_id)
    .then(result => {
      logger.debug('Search result: %j', result);
      const fio = extractFio(result);
      const duration = Date.now() - TIME0;
      if (check_ok && fio) {
        logger.info('Authorised person:', fio);
        emitter.emit_('face_true', Object.assign({}, data, {
          fio,
          duration: Object.assign({'face_true': duration}, data.duration)
        }));
        emitter.emit_('stat_event', {
          event_id:  6,
          camera_id,
          file_name,
          external_id,
          fio,
          duration
        });
      } else {
        logger.info('Access denied');
        emitter.emit_('face_false', Object.assign({fio}, data));
        emitter.emit_('stat_event', {
          event_id:  7,
          camera_id,
          file_name,
          external_id,
          fio,
          duration
        });
      }
      setImmediate(() => emitter.actionTime = Date.now());
    })
    .catch(err => {
      logger.error('CHECK ERROR:', parseError(err));
    });
}

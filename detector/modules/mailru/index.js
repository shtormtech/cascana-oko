const request = require('superagent');
const { logger, parseError } = require('@lib/logger.js');
const { convertTimeouts } = require('@lib/utils.js');
const emitter = require('@lib/emitter.js');
const { base_url, space, oauth_token, oauth_provider,
  agent_timeouts, id_prefix, decache } = require('@lib/config.js');
decache('@lib/config.js');

emitter.on_async_('face_caught', recognize);

function recognize(data) {
  const TIME0 = Date.now();
  const { camera_id, file_name, file_size } = data;
  emitter.emit('recognition');
  logger.info('Sending %s to API...', file_name);
  const meta = {
    space,
    create_new: false,
    images: [{name: file_name}]
  };
  request
    .post(`${base_url}/recognize`)
    .query({oauth_token, oauth_provider})
    //.on('progress', event => logger.log(event.loaded, 'loaded'))
    .timeout(convertTimeouts(agent_timeouts))
    .attach(file_name, data.image, {filename: file_name, contentType: 'image/jpeg'})
    .field('meta', JSON.stringify(meta))
    .then(res => {
      logger.debug(JSON.stringify(res.body, null, 2));
      const duration = Date.now() - TIME0;
      const service_response = JSON.stringify(res.body);
      emitter.emit_('face_processed', Object.assign(prepare(res.body), {
        camera_id,
        file_name,
        file_size,
        duration: Object.assign({'face_processed': duration}, data.duration),
        service_response
      }));
      emitter.emit_('stat_event', {
        event_id: 4,
        camera_id,
        file_name,
        file_size,
        duration,
        service_response
      });
    })
    .catch(err => {
      logger.debug('%j', err.response && err.response.body);
      logger.error('RECOGNITION FAILED:', parseError(err));
      emitter.emit_('stat_event', {
        event_id: 5,
        camera_id,
        file_name,
        file_size,
        duration: Date.now() - TIME0
      });
    });
}

function prepare(json) {
  try {
    const tag = json.body.objects[0].persons[0].tag;
    const external_id = +tag.substring(id_prefix.length);
    return {
      external_id,
      check_ok: external_id >= 0
    };
  } catch (e) {
    throw new Error('Wrong response: ' + JSON.stringify(json));
  }
}

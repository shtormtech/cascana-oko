const os = require('os');
const { logger } = require('@lib/logger.js');
const emitter = require('@lib/emitter.js');
const { preread, write } = require('@lib/dbrequest.js');
const { db_svc, process_module, action_module, decache } = require('@lib/config.js');
decache('@lib/config.js');

preread(Object.assign({params: {
  table:     'stats.services',
  columns:   'id',
  condition: `name="${process_module}"`
}}, db_svc), []).then(result => result && setHandler(result[0].id));

function setHandler(service_id) {
  emitter.on_async('stat_event', data => {
    const stats = Object.assign({
      service_id,
      action_module,
      host: os.hostname()
    }, data);    // commData rewrite data props if clashed!
    logger.debug('Write stat data: %j', stats);
    const keys = Object.keys(stats);
    const params = {
      table:   'stats.va',
      columns: keys.join(','),
      values:  JSON.stringify(keys.map(p => stats[p])).slice(1, -1)
    };
    write(Object.assign({params}, db_svc));
  });
}

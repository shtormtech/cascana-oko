const { logger, parseError } = require('./logger.js');

const convert = {
  read: (p) =>
    `SELECT ${p.columns} FROM ${p.table} ${p.condition ? 'WHERE '+p.condition : ''} ${p.order ? 'ORDER BY '+p.order : ''}`,
  write: (p) =>
    `INSERT INTO ${p.table} (${p.columns}) VALUES (${p.values})`
};

module.exports = {
  oninit: (msg) =>
    (request, response) => {
      logger.error(msg);
      response.status(500).type('txt').send(msg);
    },

  onready: (query) =>
    (request, response) => {
      const params = request.method=='POST' ? request.body : request.query;
      const sql = convert[request.path.substring(1)](params);
      logger.debug(sql);
      query(sql)
        .then(result => {
          response.type('json').send(result);
        })
        .catch(err => {
          const msg = parseError(err);
          logger.error(msg);
          response.status(500).type('txt').send(msg);
        });
    }
}

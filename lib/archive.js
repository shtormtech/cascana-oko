const dateFormat = require('dateformat');
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger.js');
const { promisify } = require('./utils.js');

promisify(fs, ['mkdir', 'writeFile']);

module.exports = {
  save,
  genId,
  genFileName
};

function save(data, filePath) {
  return fs.writeFile(filePath, data)
    .then(result => {
      logger.info('"%s" created', filePath);
      return Promise.resolve(result);
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        return fs.mkdir(path.dirname(filePath))
          .then(() => save(data, filePath));
      } else {
        throw err;
      }
    });
}

function genId(size=10) {
  return parseInt(Math.random()*10**size).toString(32);
}

function genFileName(ext='.jpg', suffix, rnd) {
  return dateFormat(new Date(), 'yyyymmddHHMMssl') +
    (suffix ? `_${suffix}` : '') +
    (+rnd ? `_${genId(rnd)}` : rnd || '') + ext;
}

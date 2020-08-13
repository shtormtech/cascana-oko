const path = require('path');
const fs = require('fs');
const { logger } = require('./logger.js');

const env = process.env;
const dir = path.dirname(module.parent.filename);
const folder = dir.split(path.sep).pop();
let fileName = env.npm_config_file || env.npm_package_config_file || 'config.json'
let filePath = path.resolve(dir, fileName);
if (!fs.existsSync(filePath) && fileName.indexOf('-')>0) {
  fileName = fileName.split('-').shift() + path.extname(fileName);
  filePath = path.resolve(dir, fileName);
}
const mainDir = path.dirname(require.main.filename);  // for modules

let config = {};
switch (folder) {
  case 'detector':
    config = require(filePath);
    // Share with modules
    env.npm_config_process_module = config.process_module;
    env.npm_config_action_module = config.action_module;
    break;

  /* detector service modules */
  case 'face_detect':
    config = require(filePath);
    config.min_face_size = env.npm_config_process_module ?
      require(path.resolve(mainDir, 'modules', env.npm_config_process_module, fileName)).min_face_size : 0;
    break;

  case 'stat':
    config = require(filePath);
    config.process_module = env.npm_config_process_module;
    config.action_module = env.npm_config_action_module;
    break;
  /* end of detector service modules */

  default:
    config = require(filePath);
}

logger.debug(folder, JSON.stringify(config, null, 2));

module.exports = Object.assign(config, {
  decache: (modulePath) => {
    delete require.cache[require.resolve(modulePath)];
  }
});

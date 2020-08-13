const fs = require('fs');
const { Console } = require('console');

const env = process.env;
const loglvl = env.npm_config_loglvl || env.npm_package_config_loglvl || 'info';
const logstream = env.npm_config_logstream || env.npm_package_config_logstream;
const errstream = env.npm_config_errstream || env.npm_package_config_errstream;

console.log('Environment is', env.NODE_ENV);
console.log('Output log to %s, errors to %s', logstream || 'stdout', errstream || 'stderr');
console.log('Log level', loglvl);

const createStream = (link, def) =>
  process.stdout.isTTY || !link ? def : fs.createWriteStream(link);

class Logger extends Console {
  constructor(out, err) {
    super(out, err);
  }

  get level() {
    return ['none', 'error', 'warn', 'info', 'debug'].indexOf(loglvl);
  }

  error(...args) {
    return (this.level > 0) && setImmediate(super.error.bind(this), ...args);
  }

  warn(...args) {
    return (this.level > 1) && setImmediate(super.warn.bind(this), ...args);
  }

  info(...args) {
    return (this.level > 2) && setImmediate(super.info.bind(this), ...args);
  }

  debug(...args) {
    return (this.level > 3) && setImmediate(super.log.bind(this), ...args);
  }
}

let logger = new Logger(createStream(logstream, process.stdout), createStream(errstream, process.stderr));
module.exports = {
  logger,

  loghttp: port =>
    (req, res, next) => {
      logger.info('%s %s %s://%s:%d%s', req.connection.remoteAddress, req.method,
        req.protocol, req.hostname, port, req.originalUrl);
      next();
    },

  parseError: err =>
    typeof(err)=='object' ? JSON.stringify(err) : err
}

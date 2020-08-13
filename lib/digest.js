const { logger } = require('@lib/logger.js');
const passport = require('passport');
const Strategy = require('passport-http').DigestStrategy;

module.exports = (user, password) => {
  passport.use(new Strategy({qop: 'auth'},
    (username, cb) => {
      if (username===user) return cb(null, user, password);
      logger.warn('Incorrect user name:', username);
      return cb(null, false);
    }
  ));
  return passport.authenticate('digest', {session: false});
};

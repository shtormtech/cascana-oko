require('module-alias/register');
const express = require('express');
const multer = require('multer');
const agent = require('superagent');
const path = require('path');
const { logger, loghttp, parseError } = require('@lib/logger.js');
const digest = require('@lib/digest.js');
const { save } = require('@lib/archive.js');
const { getHttpServer, convertTimeouts } = require('@lib/utils.js');
const { listen_host, listen_port, cert_file, user, password, agent_timeouts,
  base_url, oauth_token, oauth_provider,
  body_limit, origdir, decache } = require('@lib/config.js');
decache('@lib/config.js');

const bodyLimit = body_limit * 1e6;

function getMeta(name, params) {
  const { space, id, create_new } = params;
  return {
    space,
    images: name ? [{name, person_id: +id}] : undefined,
    create_new: !!create_new
  }
}

const app = express();
const staticRoot = path.join(__dirname, 'static');
const upload = multer({
  limits: {fileSize: bodyLimit},
  storage: multer.memoryStorage()
}).single('face');
app.use(loghttp(listen_port))
  .use(digest(user, password))
  .use(express.static(staticRoot))
  .use(express.json({
    limit: bodyLimit
  }));

app.post('/*', (req, res, next) => {
  upload(req, res, err => {
    if (err) {
      res.status(500).type('txt').send(parseError(err));
      logger.error(err);
    } else {
      next();
    }
  });
},
(req, res) => {
  const { originalname, buffer } = req.file || {};
  const { op, id } = req.body;
  const meta = getMeta(originalname, req.body);
  logger.info(JSON.stringify(meta));
  let request = agent
    .post(`${base_url}/${op}`)
    .query({oauth_token, oauth_provider});
  originalname && request.attach(originalname, buffer, {filename: originalname, contentType: 'image/jpeg'});
  request
    .timeout(convertTimeouts(agent_timeouts))
    .field('meta', JSON.stringify(meta))
    .then(apiRes => {
      logger.info('API response status %i', apiRes.body.status);
      originalname && save(buffer, path.resolve(origdir, id ?
        id + path.extname(originalname) :
        originalname));
      res.type('json').send(apiRes.body);
    })
    .catch(err => {
      res.status(500).type('txt').send(parseError(err));
      logger.error(err);
    });
});

getHttpServer(app, {cert_file})
  .listen(listen_port, listen_host, () => {
    logger.info('Mail.ru Vision UI service listening %s on port %i', listen_host, listen_port);
    process.send && process.send('ready');
  });

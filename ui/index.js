require('module-alias/register');
const path = require('path');
const express = require('express');
const pug = require('pug');
const ms = require('ms');
const request = require('superagent');
const { preread } = require('@lib/dbrequest.js');
const { logger, loghttp, parseError } = require('@lib/logger.js');
const emitter = require('@lib/emitter.js');
const digest = require('@lib/digest.js');
const { getHttpServer, convertTimeouts } = require('@lib/utils.js');
const { listen_host, listen_port, cert_file,
  user, password, agent_timeouts,
  cameras, cam_in, cam_out,
  db_svc, photo_svc, db_limit, cache_max_age,
  decache } = require('@lib/config.js');
decache('@lib/config.js');

const cacheMaxAge = ms(`${cache_max_age}d`)/1000;
const basedir = path.resolve(__dirname, '..', 'lib_ui');

// Prepare client template scripts
require('dot').process({
  global: 'window',
  path: path.join(__dirname, 'templates'),
  destination: path.join(__dirname, 'render')
});

let persons = [];
function getPersons(inputParams) {
  let params = Object.assign({
    table:   'staff.persons',
    columns: 'id, surname, concat_ws(" ", surname, name, patronymic) as fio, external_id, face_id, file_name, phone, email, estimation',
    order:   'surname, name, patronymic, id'
  }, inputParams);
  return preread(Object.assign({params}, db_svc), persons).then(result => {
    persons = result.filter(entry =>
      entry.fio = entry.surname ? entry.fio : `${entry.fio.trim()} ${entry.id}`
    );
    return Promise.resolve(persons);
  });
}

function lowercase(response) {
  return response.map(entry => {
    Object.keys(entry).forEach(key => entry[key.toLowerCase()] = entry[key]);
    return entry;
  })
}

function onError(res) {
  return (err) => {
    logger.error(err);
    res.status(500).type('txt').send(parseError(err));
  };
}

const app = express();
const lib = express.Router();
app.use(loghttp(listen_port))
  .use(digest(user, password))
  .use(express.static(path.join(__dirname, 'static')))
  .use(express.static(path.join(basedir, 'static')))
  .use('/render/', express.static(path.join(__dirname, 'render')))
  .use('/lib', lib);
lib.use(express.static(path.join(__dirname, 'node_modules')));

app.get('/', (req, res) => {
  res.redirect('/video');
});

app.get('/video', (req, res) =>
  res.render(path.join(__dirname, 'views', 'video.pug'), {
    basedir,
    cameras,
    db_limit
  })
);

app.get('/journal/:hours/:limit-:offset/:cams', (req, res) => {
  const camList = JSON.stringify(req.params.cams.split(',')).replace(/^.|.$/g, '');
  const params = {
    table:     'stats.va',
    columns:   'id as itemId, camera_id, event_id, event_time, file_name, fio, external_id',
    condition: `camera_id in (${camList}) and event_id in (6, 7) and TIMESTAMPDIFF(HOUR, event_time, NOW())<${req.params.hours}`,
    order:     `event_time DESC LIMIT ${+req.params.limit || db_limit} OFFSET ${req.params.offset}`
  };
  preread(Object.assign({params}, db_svc), [])
    .then(result => res.json(result))
    .catch(onError(res))
});

app.get('/attributes/:file', (req, res) => {
  const params = {
    table:     'stats.va t1 JOIN stats.services t2 ON t1.service_id=t2.id',
    columns:   't1.service_response, t1.action_module, t2.name as process_module, t2.description as procModDesc',
    condition: `t1.file_name="${req.params.file}" and t1.event_id=4`
  };
  preread(Object.assign({params}, db_svc), [])
    .then(result =>
      res.set({
        'Cache-Control': `public, max-age=${cacheMaxAge}, immutable`
      }).json(result))
    .catch(onError(res))
});

app.get('/monitor', (req, res) =>
  res.render(path.join(__dirname, 'views', 'monitor.pug'), {
    basedir,
    cam_in,
    cam_out,
    photo_svc
  })
);

app.get('/camera/:id/*', (req, res) => {
  const cam = cameras.find(entry => entry.id == req.params.id);
  if (!cam) {
    res.status(404).end();
    return;
  }
  const camUrl = /^https?:/.test(cam.url) ? cam.url : `${req.protocol}://${cam.url}`;
  const url = new URL(camUrl).origin + req.path.replace(/^(\/[^\/]+){2}/, '');
  res.redirect(url);
});

app.get('/monitor/today/:mins', (req, res) => {
  const mins = +req.params.mins;
  const params = {
    table:     'stats.va',
    columns:   'camera_id, event_time, external_id, file_name',
    condition: `event_id=6 and camera_id IN ("${cam_in}", "${cam_out}") ` +
               `and DATE(event_time)=CURDATE() ` +
               (mins ? `and event_time > TIMESTAMPADD(MINUTE, -${mins}, NOW())` : ''),  // all today if mins=0
    order:     'event_time'
  };
  preread(Object.assign({params}, db_svc), [])
    .then(result => res.json(result))
    .catch(onError(res));
});

app.get('/persons', (req, res) => {
  getPersons()
    .then(result => res.json(result))
    .catch(onError(res));
});

app.get('/persons/:id', (req, res) => {
  const id = req.params.id;
  const result = id == 'all' ?
    persons :
    persons.find(entry =>
      req.params.id == entry.external_id || req.params.id == 'p' + entry.pass_num);
  const send = (data) =>
    res.set({
      'Cache-Control': `public, max-age=${cacheMaxAge}, immutable`
    }).json(data);
  if (!result) {
    getPersons(id=='all' && {} || {'condition': `external_id="${id}"`})
      .then(result => send(result))
      .catch(onError(res));
  } else {
    send(result);
  }
});

app.get('/photo/:id', (req, res) => {
  const id = req.params.id;
  const baseUrl = `${req.protocol}://${photo_svc.host}:${photo_svc.port}`;
  getPersons({'condition': `external_id="${id}"`})
    .then(result => {
      const { file_name } = result[0];
      const camId = file_name.split('_')[1];
      res.redirect(`${baseUrl}/photo/${camId}/${file_name}`);
    })
    .catch(onError(res));
});

getHttpServer(app, {cert_file})
  .listen(listen_port, listen_host, () => {
    logger.info('UI service listening %s on port %i', listen_host, listen_port);
    process.send && process.send('ready');
  });

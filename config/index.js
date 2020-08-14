require('module-alias/register');
const path = require('path');
const fs = require('fs');
const merge = require('deepmerge');
const express = require('express');
const multer = require('multer');
const compression = require('compression');
const ipfilter = require('express-ip-filter');
const pm2 = require('pm2');
const child_process = require('child_process');
const { logger, loghttp, parseError } = require('@lib/logger.js');
const { getHttpServer, promisify } = require('@lib/utils.js');
const { listen_host, listen_port, cert_file, ip_wlist, ac_allow_origin,
  decache } = require('@lib/config.js');
decache('@lib/config.js');

const charset = 'utf8';
const homeDir = process.env.HOME;
const tlsDir = path.resolve(__dirname, '..', 'tls');

// Convert PM2 callbacks to promises
// DEPRECATION: native node support from version 8
/*let promisify_pm2 = promisify.object({
  list: promisify.cb_func(),
  connect: promisify.cb_func(),
  disconnect: promisify.cb_func(),
  restart: promisify.cb_func(),
  reload: promisify.cb_func(),
  dump: promisify.cb_func(),
  stop: promisify.cb_func(),
  getProcessIdByName: promisify.cb_func(),
  Client: promisify.object({
    executeRemote: promisify.cb_func()
  })
});*/

promisify(pm2, ['list', 'connect', 'disconnect', 'restart', 'reload', 'dump', 'stop',
  'describe', 'getProcessIdByName']);
promisify(pm2.Client, ['executeRemote', 'getProcessByNameOrId', 'getAllProcess']);
promisify(fs, ['readFile', 'readdir', 'writeFile', 'chmod']);
promisify(child_process, ['exec']);

const filterMsg = 'Forbidden';
function onError(res) {
  return (err) => {
    const msg = parseError(err);
    logger.error(msg);
    res
      .status(500)
      .type('txt')
      .send(msg);
    pm2.disconnect();
  };
}

function getProcessData(id) {
  return pm2.Client.executeRemote('getMonitorData', {})
    .then(md => {
      pm2.disconnect();
      let result = id ? md.filter(p => p.pm_id==id || p.name==id) : md;
      return Promise.resolve(
        result.sort((a, b) => {
          if (a.name > b.name) return 1;
          if (a.name < b.name) return -1;
          return 0;
        })
      );
    });
}

function getProcDir(name) {
  return pm2.describe(name)
    .then(pd => Promise.resolve(path.dirname(pd[0].pm2_env.pm_exec_path)));
}

function setEnv(newEnv) {
  return pm2.Client.getAllProcess()
    .then(procs => {
      let updated = [];
      newEnv.forEach(env => {
        let p = procs.find(p => p.pm_id == env.pm_id);
        p && Object.assign(p.pm2_env, env) && updated.push(p);
      });
      return Promise.resolve(updated);
    });
}

function preparePath(name) {
  // Accept only home dir paths
  return path.join(homeDir, name.substring(homeDir.length).replace(/\.\./g, ''));
}

function composeFilePath(dir, fileName, moduleName) {
  const modulePath = moduleName ? path.join('modules', moduleName) : '';
  let filePath = preparePath(path.join(dir, modulePath, fileName));
  return check => {
    if (!check) return filePath;
    if (!fs.existsSync(filePath) && fileName.indexOf('_')>0) {
      filePath = preparePath(path.join(dir, modulePath, fileName.split('_').shift() + path.extname(fileName)));
    }
    return fs.existsSync(filePath) ?
      filePath :
      preparePath(path.join(dir, modulePath, 'config.json'));
  };
}

function composeConfig(oldText, newObj) {
  const config = merge(JSON.parse(oldText), newObj, {
    arrayMerge(arr1, arr2) {
      arr2 = arr2.filter(item => item != undefined);
      if (arr1.length == 0 || typeof(arr1[0]) == 'object') return arr2;
      return [...arr1, ...arr2].reduce((result, item) => {
        const idx = result.indexOf(item);
        idx > -1 ? result.splice(idx, 1) : result.push(item);
        return result;
      }, []);
    },
    customMerge(key) {
      if (key == 'events') return (arr1, arr2) => {
        arr2 = arr2.filter(item => item != undefined);
        return [...arr1, ...arr2].reduce((result, item) => {
          const idx = result.findIndex(resultItem => resultItem.name == item.name);
          idx > -1 ? result.splice(idx, 1) : result.push(item);
          return result;
        }, []);
      };
    }
  });
  //console.log(config);
  return JSON.stringify(config);
}

function extendObject(props, value) {
  return (obj={}) => {
    let o = obj;
    props.slice(0, -1).forEach(p => {
      const c = p.split(/\[|\]/);
      const n = c[0];
      const i = +c[1];
      n == p ?
        o = o[n] || (o[n] = {}) :
        o[n] && (o = (o[n][i] || (o[n][i] = {}))) || ((o[n] = [])[i] = (o = {}));
    });
    const p = props.slice().pop();
    const n = p.split('[')[0];
    o[n] = n == p ?
      value :
      [...(o[n] || []), value];
    return obj;
  };
}

const app = express();
const svc = express.Router();
const log = express.Router();
const cfg = express.Router();
app
  .use(loghttp(listen_port))
  .use(ipfilter({
    filter: ip_wlist.split(/ +/g),
    forbidden: () => {
      logger.info(filterMsg);
      return filterMsg;
    }
  }))
  .use((req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': ac_allow_origin,
      'Vary': 'Origin'
    })
    next();
  })
  .use('/services', svc)
  .use('/log', log)
  .use('/config', cfg);

svc.get(['/', '/:id'], (req, res) => {
  const { id } = req.params;
  getProcessData(id)
    .then(data => {
      //logger.debug(data);
      res.json(data.map(entry => {
        let {pm2_env, ...main} = entry;
        let {status, exec_mode, username, version, instances,
          npm_config_file, npm_config_loglvl,
          pm_uptime, restart_time, max_memory_restart,
          pm_exec_path, pm_out_log_path, pm_err_log_path,
          NODE_APP_INSTANCE, HOSTNAME, NODE_ENV} = pm2_env;
        const cfgFileName = npm_config_file && path.basename(npm_config_file);
        const baseDir = path.dirname(pm_exec_path);
        return Object.assign(main, {status, exec_mode, username, pm_uptime, restart_time,
          max_memory_restart, version, npm_config_file, npm_config_loglvl,
          pm_out_log_path, pm_err_log_path, pm_exec_path, instances,
          NODE_APP_INSTANCE, HOSTNAME, NODE_ENV, cfgFileName, baseDir});
      }));
    })
    .catch(onError(res));
});

svc.post('/:action/:id', express.json(), (req, res) => {
  const { action, id } = req.params;
  const ids = id.split(',');
  const newEnv = req.body;
  Object.assign(process.env, newEnv);
  logger.info('Environment updated:', newEnv);
  Promise.all(ids.map(id => pm2[action](id, {updateEnv: true})))
    .then(() => res.json({ok: true}))
    .catch(onError(res));
});

svc.get('/:action/:id', (req, res) => {
  const { action, id } = req.params;
  const ids = id.split(',');
  logger.info('Process', action, id);
  Promise.all(ids.map(id => pm2[action](id)))
    .then(() => res.json({ok: true}))
    .catch(onError(res));
});

log.get('/:name', compression(), (req, res) => {
  fs.readFile(preparePath(req.params.name), charset)
    .then(text => res.json({text}))
    .catch(onError(res));
});

const preflight = (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': ac_allow_origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  })
  res.end();
};
cfg.options('*', preflight);
svc.options('*', preflight);

cfg.get('/dir/:svc_name', (req, res) => {
  getProcDir(req.params.svc_name)
    .then(dir =>
      fs.readdir(dir, charset)
        .then(list => res.json(list.filter(name => /^config.*\.json$/.test(name))))
    )
    .catch(onError(res));
});

cfg.get(['/file/:svc_name/:file_name', '/file/:svc_name/:module_name/:file_name'], (req, res) => {
  const { svc_name, module_name, file_name } = req.params;
  getProcDir(svc_name)
    .then(dir => {
      const filePath = composeFilePath(dir, file_name, module_name)(1);
      fs.readFile(filePath, charset)
        .then(text => {
          logger.debug('Send file', filePath);
          res.json(JSON.parse(text));
        })
    })
    .catch(onError(res));
});

cfg.get('/cert/list', (req, res) => {
  fs.readdir(path.resolve(__dirname, '..', 'tls'), charset)
    .then(list => res.json(list))
    .catch(onError(res));
});

cfg.get('/cert/view/:file', (req, res) => {
  const filePath = path.join(tlsDir, req.params.file);
  const cmd = `openssl x509 -in "${filePath}" -noout -text`;
  child_process.exec(cmd)
    .then(result => res.json(result))
    .catch(onError(res));
});

cfg.post('/cert/upload', (req, res, next) => {
  const upload = multer({
    preservePath: true,
    storage: multer.diskStorage({
      destination(req, file, cb) {
        cb(null, tlsDir);
      },
      filename(req, file, cb) {
        cb(null, file.originalname);
      }
    })
  }).any();
  upload(req, res, function (err) {
    if (err) {
      onError(res)(err);
    } else {
      next();
    }
  });
}, (req, res) => {
  Promise.all(req.files.map(f => fs.chmod(f.path, 0o600)))
    .then(() => res.json({ok: true}))
    .catch(onError(res));
});

cfg.post('/file/:svc_name/:file_name/:new_name', express.json(), (req, res) => {
  const { svc_name, file_name, new_name } = req.params;
  let config = {};
  let moduleConfig = {};
  const body = req.body;
  Object.keys(body).forEach(key => {
    const chunks = key.split('__');
    const moduleName = chunks[0].trim();
    const props = chunks[1].split('.');
    const extend = extendObject(props, body[key]);
    let obj = moduleName ? moduleConfig[moduleName] || (moduleConfig[moduleName]={}) : config;
    Object.assign(obj, extend(obj));
  });
  //console.log(config, moduleConfig);
  getProcDir(svc_name)
    .then(dir => {
      const pread = [];
      const modules = Object.keys(moduleConfig);
      pread.push(fs.readFile(composeFilePath(dir, file_name)(1), charset));
      modules.forEach(m => pread.push(fs.readFile(composeFilePath(dir, file_name, m)(1), charset)));
      Promise.all(pread).then(arr => {
        const pwrite = [];
        pwrite.push(fs.writeFile(composeFilePath(dir, new_name)(), composeConfig(arr[0], config), charset));
        arr.slice(1).forEach((text, idx) => {
          const moduleName =  modules[idx];
          pwrite.push(fs.writeFile(composeFilePath(dir, new_name, moduleName)(),
            composeConfig(text, moduleConfig[moduleName]), charset));
        });
        Promise.all(pwrite).then(() => res.json({ok: true}));
      });
    })
    .catch(onError(res));
});

getHttpServer(app, {cert_file})
  .listen(listen_port, listen_host, () => {
    logger.info('Config service listening %s on port %i', listen_host, listen_port);
    process.send && process.send('ready');
  });

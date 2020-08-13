const path = require('path');
const emitter = require('@lib/emitter.js');
const { save } = require('@lib/archive.js');
const { photodir, archivedir, decache } = require('@lib/config.js');
decache('@lib/config.js');

const dir = path.dirname(module.parent.filename);
const baseDir = path.resolve(dir, photodir);

emitter.on_async_('face_caught', data =>
  save(data.image, path.join(baseDir, data.camera_id, data.file_name))
);

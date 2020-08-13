const { logger, parseError } = require('@lib/logger.js');
const emitter = require('@lib/emitter.js');
const { genFileName } = require('@lib/archive.js');
const { CV, detectFace } = require('./opencv.js');
const { ocv_scale_factor, ocv_min_neighbors, ocv_min_size,
  min_face_size, use_gpu, decache } = require('@lib/config.js');
decache('@lib/config.js');

const ext = '.jpg';

emitter.on_async_('image_recieved', process);

logger.info('MIN face size', min_face_size);

function process(data) {
  const TIME0 = Date.now();
  const img = CV.imdecode(data.image);
  detectFace(img)
    .then(result => {
      const { objects } = result;
      const numFaces = objects.length;
      if (!numFaces) return;
      logger.info('%i faces detected', numFaces);
      cutFace(img, data, objects, TIME0);
    })
    .catch(err =>
      logger.error('FACE DETECTION ERROR:', parseError(err)));
}

function cutFace(img, data, regions, TIME0) {
  const { camera_id } = data;
  regions
    .sort((region1, region2) => region2.width - region1.width)
    .forEach(region => {
      const recognizable = region.width >= min_face_size;
      const file_name = recognizable ?
        genFileName(ext, camera_id, 10) :
        null;
      emitter.emit_('face_detected', {
        camera_id,
        file_name,
        region,
        size: {width: img.cols, height: img.rows},
        recognizable,
        duration: Date.now() - TIME0
      });
      if (!recognizable) return;
      const face = img.getRegion(region);
      if (!(face instanceof CV.Mat)) return;
      CV.imencodeAsync(ext, face)
        .then(image => {
          const duration = Date.now() - TIME0;
          emitter.emit_('face_caught', {
            image,
            camera_id,
            file_name,
            duration: {'face_caught': duration},
            size: {width: face.cols, height: face.rows}
          });
          emitter.emit_('stat_event', {
            event_id:   3,
            photo_size: img.cols,
            file_size:  image.length,
            camera_id,
            file_name,
            duration
          });
        });
    });
}

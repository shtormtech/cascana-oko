require('module-alias/register');
const path = require('path');
const fs = require('fs');
const { logger, parseError } = require('@lib/logger.js');
const { promisify } = require('@lib/utils.js');
const { save } = require('@lib/archive.js');
const { CV, detectFace, resizeFace } = require('./modules/face_detect/opencv.js');
const { origdir, facedir, decache } = require('@lib/config.js');
decache('@lib/config.js');

const charset = 'utf8';
const ext = '.jpg';

promisify(fs, ['readFile', 'readdir', 'writeFile']);

let filesToProcess = [];
fs.readdir(origdir, { charset, withFileTypes: true })
  .then(arr => {
    filesToProcess = arr
      .filter(dirent => dirent.isFile())
      .map(dirent => dirent.name);
    logger.info('%d files in %s', filesToProcess.length, origdir);
    next();
  });

function next() {
  const fileName = filesToProcess.shift();
  if (!fileName) return;
  const filePath = path.join(origdir, fileName);
  fs.readFile(filePath)
    .then(buf => cutFace(fileName, buf))
    .catch(err =>
      logger.error('IMAGE PROCESS ERROR:', filePath, parseError(err))
    )
}

function cutFace(fileName, buf) {
  const img = CV.imdecode(buf);
  detectFace(img)
    .then(result => {
      const { objects } = result;
      const numFaces = objects.length;
      if (!numFaces) {
        logger.info('No faces found on', fileName);
        return next();
      }
      const region = objects.reduce((region1, region2) =>
        region2.width > region1.width ? region2 : region1);
      const face = img.getRegion(region);
      if (!(face instanceof CV.Mat)) {
        logger.info('No face cut on', fileName);
        return next();
      }
      const facePath = path.join(facedir, fileName);
      save(CV.imencode(ext, resizeFace(face, region)), facePath)
        .then(() => next())
        .catch(err => {
          logger.error('FACE SAVE ERROR:', facePath, parseError(err));
          next();
        });
    })
    .catch(err => {
      logger.error('FACE CUT ERROR:', parseError(err));
      next();
    });
}

const CV = require('opencv4nodejs');
const { logger, parseError } = require('@lib/logger.js');
const { ocv_scale_factor, ocv_min_neighbors, ocv_min_size,
  side_limit, use_gpu, decache } = require('@lib/config.js');
decache('@lib/config.js');

const classifier = new CV.CascadeClassifier(CV.HAAR_FRONTALFACE_ALT2);

logger.info('Use', use_gpu ? 'GPU' : 'CPU');

module.exports = {
  CV,

  detectFace(img) {
    if (!img.cols || !img.rows) return Promise.reject('Wrong image');
    return img.bgrToGrayAsync()
      .then(grayImg => {
        const args = [grayImg, ocv_scale_factor, ocv_min_neighbors, ocv_min_size];
        return use_gpu ?
          Promise.resolve(classifier.detectMultiScaleGpu(...args)) :
          classifier.detectMultiScaleAsync(...args);
      })
  },

  resizeFace(face, region) {
    return region.width > side_limit ? face.resizeToMax(side_limit) : face;
  }
};

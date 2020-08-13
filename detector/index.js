require('module-alias/register');
const { spawn } = require('child_process');
const { logger, parseError } = require('@lib/logger.js');
const emitter = require('@lib/emitter.js');
const { detect_module, process_module, action_module, opt_modules,
  vstream, video_svc, ffmpeg_options, decache } = require('@lib/config.js');
decache('@lib/config.js');

require(`./modules/${detect_module}`);
require(`./modules/${process_module}`);
require(`./modules/${action_module}`);
opt_modules.forEach(mod => require(`./modules/${mod}`));

logger.info('Key modules:', process_module, action_module);
logger.info('Optional modules:', opt_modules.join(','));

emitter.emit('init', {process_module, action_module, opt_modules});

function getCmd(params) {
  return `ffmpeg ${ffmpeg_options} -i ${params.url} -r ${params.freq} -f image2 -update 1 -` +
         ` http://${video_svc.host}:${video_svc.port}/${params.id}.ffm`;
}

// Spawn ffmpeg
const args = getCmd(vstream).split(' ');
const child = spawn(args.shift(), args);
child.on('close', code => {
  logger.error('STREAM CLOSED: %s', vstream.url);
  process.exit(code);
});
child.on('error', err => {
  logger.error('SPAWN ERROR:', parseError(err));
});
child.stdout.on('data', chunk => {
  emitter.emit_('image_recieved', {camera_id: vstream.id, image: Buffer.from(chunk)});
  //emitter.emit_('stat_event', {camera_id: vstream.id, event_id: 1, file_size: chunk.length});   // huge amount
});
child.stderr.on('data', chunk => {
  logger.error('FFMPEG ERROR: %s', chunk);
});
process.send && process.send('ready');

const emitter = require('@lib/emitter.js');

emitter.on_async_('face_caught', transfer);

function transfer(data) {
  const { camera_id, file_name, duration } = data;
  emitter.emit_('face_processed', {
    camera_id,
    file_name,
    duration
  });
  emitter.emit_('stat_event', {
    event_id: 4,
    camera_id,
    file_name,
    duration: 0
  });
}

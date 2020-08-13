(() => {
  const socket = io();

  function notify(data) {
    try {
      const msg = JSON.stringify(data);
      parent.postMessage(msg, '*');
    } catch (e) {
      console.log(e);
    }
  }

  socket.on('connect', () => {
    //console.log('connect');
  });
  socket.on('init', (data) => {
    //console.log('init', data);
    window.parent && notify(data);
  });
  socket.on('status_update', (status, data) => {
    ['face_true', 'face_false'].includes(status) && window.parent && notify(data);
    //console.log(status, data);
  });
  socket.on('disconnect', () => {
    //console.log('disconnect');
  });
})();

(() => {
  const socket = io();
  const markerLeaveTime = 1000;
  const dbIconHtml = '<i class="fa fa-database"></i>';
  const camIconHtml = '<i class="fa fa-video-camera"></i>';
  let camId;

  let markers = [];
  let cleanInt = setInterval(() => {
    markers = markers.filter(elem => {
      try {
        if ((Date.now() - elem[0]) > markerLeaveTime) {
          //console.log(elem[1], elem[1].parentNode);
          return elem[1].parentNode.removeChild(elem[1]) && false;
        } else {
          elem[1].style.opacity || (elem[1].style.opacity = 0);
          return true;
        }
      } catch (e) {
        return false;
      }
    });
    //console.log(markers.length);
  }, 200);

  function pageUpdate(status, data) {
    data = data || {};
    const idRe = /\./g;
    const markerId = data.file_name && data.file_name.replace(idRe, '_');
    let marker;
    switch (status) {
      case 'face_detected':
        const placeholder = document.querySelector('.video');
        const videoElem = placeholder.firstChild;
        const kx = videoElem.clientWidth/data.size.width;
        const ky = videoElem.clientHeight/data.size.height;
        marker = placeholder.appendChild(document.querySelector('body > .marker').cloneNode(true));
        marker.classList.add(data.recognizable ? 'recognizable' : 'not-recognizable');
        markerId && marker.setAttribute('id', markerId);
        marker.setAttribute('style',
          `width: ${Math.round(+data.region.width*kx)}px;` +
          `height: ${Math.round(+data.region.height*ky)}px;` +
          `top: ${Math.round(+data.region.y*ky)}px;` +
          `left: ${Math.round(+data.region.x*kx)}px;`);
        markers.push([Date.now(), marker]);
        break;
      case 'face_true':
      case 'face_false':
        //console.log(data.fio, data.file_name);
        marker = markerId && document.getElementById(markerId);
        if (marker) {
          marker.style.borderWidth = 0;
          marker.style.opacity = 1;
          marker.appendChild(document.createElement('span')).textContent = data.check_ok && data.fio ? data.fio : 'неизвестный';
        }
        //console.log(marker, data.fio);
        break;
      case 'stat_event':
        data.eventDesc && (document.querySelector('.log').innerHTML =
          `${dbIconHtml} ${/\d{2}:\d{2}:\d{2}/.exec(data.event_time) || ''} ${data.eventDesc}`);
        break;
    }
  }

  function notify(data) {
    try {
      const msg = JSON.stringify(data);
      parent.postMessage(msg, '*');
    } catch (e) {
      console.log(e);
    }
  }

  function verification(data) {
    const labels = {
      verification_ready: 'Посмотрите прямо в камеру',
      verification:       'Верификация...',
      verification_end:   'Приложите пропуск к считывателю',
      face_false:         'Верификация не прошла',
      not_found:          'Пропуск не найден'
    };
    $('.text').text(labels['verification_end']).show();
    socket.on('status_update', (status, data) => {
      labels[status] && $('.text').text(labels[status]).removeClass('success warning');
      switch(status) {
        case 'face_true':
          $('.text').text(data.fio).addClass('success');
          break;
        case 'face_false':
        case 'not_found':
          $('.text').addClass('warning');
          break;
      }
    });
  }

  socket.on('connect', () => {
    //console.log('connect');
    $('.alert').hide();
  });
  socket.on('init', (data) => {
    //console.log('init', data);
    window.parent && notify(data);
    if (data.process_module) {
      $('.info').text(`${data.process_module} ${data.action_module} ${data.opt_modules.join(' ')}`);
    }
    if (data.process_module == 'kryptonite') verification(data);
    if (data.video_svc) {
      camId = data.video_svc.id;
      const url = `//${data.video_svc.host}:${data.video_svc.port}/${camId}.mjpg`;
      $('.video').html(`<img src="${url}" alt="Видео ${camId}">`);
      $('.camera').html(camIconHtml + ' ' + camId);
      data.zones && $('.zone').text(data.zones.join(' '));
    }
  });
  socket.on('status_update', (status, data) => {
    //console.log(status, data);
    ['face_true', 'face_false'].includes(status) && window.parent && notify(data);
    if (!data || data.camera_id === undefined || data.camera_id == camId) {
      pageUpdate(status, data);
      //console.log(status, data);
    }
  });
  socket.on('disconnect', () => {
    $('.alert').show();
    //console.log('disconnect');
  });
})();

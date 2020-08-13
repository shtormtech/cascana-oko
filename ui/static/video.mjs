import { Timer, Filter, readCheckboxes, genItemId } from './util.mjs';

const dbLimit = +$('#form_journal_hours').attr('data-limit');
const maxEvents = dbLimit;
const modalTiming = 30;   // seconds
let cameras = [];
let eventStack = [];
let initStack = [];
let lastStack = [];
let styleElement, filterTimeout;
let timer = new Timer(modalTiming*1000, $('#modal_journal .request-timing'));
let filter = new Filter($('#form_journal_filter'), $('.container-journal'), {
  target: '.item-journal',
  skip:   '.row-journal'
});
Object.assign(filter, {
  preStart: function () {
    this.container.find('.collapse.show').removeClass('show');
  },
  postStart: function () {
    misc.updateCounter();
  },
  onReset: function () {
    misc.updateCounter();
  }
});

const iframes = iFrameResize({checkOrigin: false}, 'iframe');
const misc = {
  frameResize() {
    iframes.forEach(i => i.iFrameResizer.resize());
  },

  filterColumnClass(idx, cssClass) {
    return cssClass.match(/col-[^ ]+/g).join(' ');
  },

  getInitData(id) {
    return initStack.find(entry => entry.video_svc.id == id) || {};
  },

  updateCounter() {
    const num = $('#journal_content .item-journal').filter(':visible').length;
    $('.journal-count').text(num);
  }
};

$(window).on('message', receiveMessage);
$('.checkbox-camera').on('change', updatePage);
$('.range-video').on('input', updateVideo);
$('.range-panel').on('input', updatePanel);
$('.link-journal, #modal_journal .refresh').on('click', updateJournal);
$('#form_journal_hours').on('submit', updateJournal);
$('#modal_event').on('hidden.bs.modal', () => {
  $('.events .list-group-item.active').removeClass('active');
  $('#modal_event .modal-body .media').remove();
});
$('#modal_journal')
  .on('shown.bs.modal', function () {
    misc.updateCounter();
    $(this).one('scroll', function () {
      $(this).find('.scroll-up').show();
    });
  })
  .on('hidden.bs.modal', function () {
    $('#journal_hours').val(1);
    $('#journal_filter').val('');
    $('#journal_content').empty();
    $(this).find('.scroll-up').hide();
  });
$('.modal.fade .scroll-up').on('click', function () {
  $(this).closest('.modal.fade').scrollTop(0);
});

$('#range_video').prop('value', localStorage.VideoSize || 6).trigger('input');
$('#range_panel').prop('value', localStorage.PanelSize || 2).trigger('input');

updateCameras(localStorage.Cameras);
update();

function update() {
  getStatData()
    .then(() => {
      //console.log(lastStack);
      $('.events .list-group').empty();
      lastStack.forEach(entry => displayEvent(entry, 'appendTo'));
    })
    .catch(err => console.log(err));
}

function updateCameras(camList) {
  cameras = camList ? camList.split(',') : [];
  $('#form_cameras .camera-control input[type=checkbox]').each((idx, elem) => {
    const camId = $(elem).attr('data-cam');
    if (camList) {
      const oldValue = $(elem).prop('checked');
      const newValue = cameras.includes(camId);
      (newValue !== oldValue) && $(elem).prop('checked', newValue).trigger('change');
    } else {
      $(elem).prop('checked') && cameras.push(camId);
    }
  });
}

function updatePage(event) {
  const checkbox = $(event.target);
  const camId = checkbox.attr('data-cam');
  checkbox.prop('checked') && cameras.includes(camId) || cameras.push(camId);
  $(`.camera-${camId}`).fadeToggle(400, () => hideElements());
  localStorage.setItem('Cameras', cameras.join(','));
}

function updateVideo(event) {
  const size = $(event.target).val();
  $('.container-video')
    .removeClass(misc.filterColumnClass)
    .addClass('col-xl-' + size);
  misc.frameResize();
  localStorage.setItem('VideoSize', size);
}

function updatePanel(event) {
  const size = +$(event.target).val();
  $('.events')
    .removeClass(misc.filterColumnClass)
    .addClass('col-xl-' + size);
  $('.video')
    .removeClass(misc.filterColumnClass)
    .addClass('col-xl-' + (12 - size));
  misc.frameResize();
  localStorage.setItem('PanelSize', size);
}

function hideElements() {
  styleElement && document.head.removeChild(styleElement);
  styleElement = document.head.appendChild(document.createElement('style'));
  readCheckboxes('#form_cameras input[type=checkbox]').forEach(className =>
    styleElement.sheet.insertRule(`.${className} {display: none;}`));
  // Chage style for single-video page
  $('#form_cameras input[type=checkbox]:checked').length==1 ?
    $('.container-video').removeClass('col-xl-6 col-xl-12').addClass('col-xl-12') :
    $('.container-video').removeClass('col-xl-6 col-xl-12').addClass('col-xl-6');
  misc.frameResize();
}

function receiveMessage(event) {
  const data = event.originalEvent.data;
  if (!data || data.indexOf('[iFrameSizer]')>-1) return;
  const json = JSON.parse(data);
  json.itemId = genItemId();
  if (json.eventName) {
    const { process_module, action_module, procModDesc } = misc.getInitData(json.camera_id);
    const msg = Object.assign({process_module, action_module, procModDesc}, json);
    if (eventStack.unshift(msg) > maxEvents) eventStack.length = maxEvents;
    displayEvent(msg);
  } else {
    initStack.unshift(json);
  }
  console.log(json);
}

function displayEvent(data, method='prependTo') {
  const container = $('.events .list-group');
  const items = container.children('.list-group-item');
  if (items.length > maxEvents) {
    items.last().remove();
  }
  const {itemId, camera_id, event_time, file_name, eventName, fio, event_id} = data;
  $(template_panel_item({
    event_id,
    itemId,
    camera_id,
    file_name,
    eventName,
    eventTime: new Date(event_time).toLocaleTimeString('ru'),
    fio
  }))
    [method](container)
    .on('click', displayEventDetails);
}

function displayEventDetails(event) {
  const elem = $(event.target).closest('.link-event');
  elem.addClass('active');
  let container, stack;
  if (elem.hasClass('item-journal')) {
    stack = lastStack;
    container = elem.next();
    if (container.children('.media').length) return;
    container.children('.spinner').show();
  } else {
    container = $('#modal_event .modal-body');
    if (elem.hasClass('db-item')) {
      stack = lastStack;
      container.children('.spinner').show();
    } else {
      stack = eventStack;
      container.children('.spinner').hide();
    }
  }
  const dataId = elem.attr('data-id');
  const details = stack.find(entry => entry.file_name == dataId) || {};
  let {camera_id, eventName, event_id, event_time, file_name, file_size,
    external_id, region, recognizable, fio, service_response, threshold, duration,
    process_module, action_module, procModDesc} = details;
  const initData = misc.getInitData(camera_id);
  let {zones, photo_svc} = initData;
  const photoBaseUrl = photo_svc && `//${photo_svc.host}:${photo_svc.port}`;
  const eventTime = new Date(event_time);
  const systemDelay = duration && (Object.keys(duration).reduce((sum, key) =>
    sum += duration[key], 0)/1000).toFixed(3);
  const commonData = {
    title:      eventName=='face_true' || event_id==6 ? fio : undefined,
    fio,
    photoUrl:   photo_svc && `${photoBaseUrl}/photo/${camera_id}/${file_name}`,
    camera_id,
    eventTime:  eventTime.toLocaleTimeString('ru'),
    eventDay:   eventTime.toLocaleDateString('ru', {weekday: 'long'}),
    eventDate:  eventTime.toLocaleDateString('ru', {dateStyle: 'long'}),
    zoneList:   zones && zones.length && zones.join(',') || undefined,
    personId:   external_id || undefined,
    file_name,
    threshold,
    //fileSize:          file_size && ((file_size/1024).toFixed(1) + 'k'),
    //photoSize:         region && (region.width + ' точек'),
    //photoRecognizable: ['Нет', 'Да'][+recognizable],
    systemDelay
  };

  const complete = (json) => {
    let { process_module, action_module, procModDesc, service_response } = json;
    container.append(template_event_details(Object.assign(
      {
        origUrl: getOrigUrl({external_id, process_module, photoBaseUrl}),
        system:  `${procModDesc} (${process_module})`,
        action_module
      },
      commonData,
      service_response && getResponseParser(process_module)(JSON.parse(service_response)) || {}
    )));
  };

  if (elem.hasClass('item-journal') || elem.hasClass('db-item')) {
    getFaceAttributes(file_name).then(json => {
      container.children('.spinner').hide();
      complete(json[0]);
    });
  } else {
    complete({process_module, action_module, procModDesc, service_response});
  }
}

function getResponseParser(procMod) {
  let parser;
  switch (procMod) {
    case 'mailru':
      parser = (json) => {
        let person = {};
        try {
          person = json.body.objects[0].persons[0];
        } catch (e) {}
        const { similarity, age, sex, emotion } = person;
        return {
          similarity,
          gender:    ({male: 1, female: 0})[sex],
          personAge: age,
          emotion:   emotion && emotion.toLowerCase()     // Neutral, Happiness, Sadness, Surprise, Fear, Disgust, Anger, Contempt
        };
      };
      break;
    case 'kryptonite':
      parser = (json) => {
        return {
          similarity: json.outputs[0].toFixed(3)
        }
      }
      break;
    default:
      parser = (json) => json;
  }
  return parser;
}

function getStatData(hours=1, limit=0, offset=0) {
  const url = `/journal/${hours}/${limit}-${offset}/${cameras.join(',')}`;
  return $.get(url).then(json => {
    lastStack = offset ? [...lastStack, ...json] : json;
    //console.log(lastStack);
    return json;
  });
}

function getFaceAttributes(fileName) {
  return $.get(`/attributes/${fileName}`);
}

function getOrigUrl(data) {
  const { external_id, process_module, photoBaseUrl } = data;
  if (!external_id) return;
  return `${photoBaseUrl}/orig/${external_id}.jpg`;
}

function updateJournal(event={}) {
  let button;
  if (event.type=='submit') {
    event.preventDefault();
  } else {
    button = $(event.target).closest('.btn');
  }
  const container = $('.container-journal');
  const submitButtons = $('#modal_journal .refresh');
  let limit = dbLimit;
  let offset = 0;
  if (button && button.hasClass('page-next')) {
    offset = lastStack.length;
  } else {
    container.empty();
  }
  submitButtons.prop('disabled', true);
  getStatData($('#journal_hours').val(), limit, offset)
    .then(json => {
      timer.start(Date.now());
      displayJournal(json);
      filter.start();
      if (json.length >= dbLimit) {
        $('#modal_journal .page-next').show();
      } else {
        $('#modal_journal .page-next').hide();
      }
      submitButtons.prop('disabled', false);
    })
    .catch(err => {
      console.log(err);
      $('#modal_journal .header-journal').hide();
      container.html(`<h6 class=p-3 text-danger>${err.status} ${err.statusText}</h6>`);
      submitButtons.prop('disabled', false);
    });
}

function displayJournal(data=eventStack) {
  $('#modal_journal .header-journal').show();
  const container = $('.container-journal');
  if (lastStack.length == 0) {
    $('#modal_journal .header-journal').hide();
    container.html('<h6 class=p-3>События не найдены</h6>');
    return;
  }
  $(template_journal(data.map(entry => {
    const { itemId, camera_id, file_name, fio, event_time, event_id } = entry;
    const { photo_svc } = misc.getInitData(camera_id);
    const eventTime = new Date(event_time);
    return {
      event_id,
      itemId,
      camera_id,
      file_name,
      fio,
      eventTime: eventTime.toLocaleTimeString('ru'),
      eventDate: eventTime.toLocaleDateString('ru', {dateStyle: 'short'}),
      photoUrl:  photo_svc ? `//${photo_svc.host}:${photo_svc.port}/photo/${camera_id}/${file_name}` : undefined
    };
  })))
  .appendTo(container)
  .on('click', event => {
    $('#journal_content .list-group-item.active').removeClass('active');
    displayEventDetails(event);
  });
}

import { Timer, Filter, formatPhoneNumbers, readCheckboxes,
  convertTime, countTimeDiff } from './util.mjs';

const updatePeriod = 1;   // minutes
const modalTiming = 30;   // seconds
const camIn = $('#checkbox_status_present').attr('data-cam');
const camOut = $('#checkbox_status_absent').attr('data-cam');
const photoSvcHost = $('#monitor_container').attr('data-photo-host');
const photoSvcPort = $('#monitor_container').attr('data-photo-port');

let persons = [];
let initStack = [];
let lastEvents, styleElement;
let timer = new Timer(modalTiming*1000, $('#modal_monitor .request-timing'));
let filter = new Filter($('#content_filter'), $('.container-monitor'), {
  target: '.container-person',
  skip:   ':hidden, .link-person'
});

$(window).on('message', receiveMessage);
$('.checkbox-status').on('click', hideElements);
$('#modal_monitor .refresh').on('click', updateModal);
update();
setInterval(update, 60000*updatePeriod, updatePeriod+1);

function update(mins) {
  getPersons().then(() => {
    updatePage();
    getTodayEvents(mins).then(() => updateCards());
    formatPhoneNumbers();
  });
}

function hideElements() {
  styleElement && document.head.removeChild(styleElement);
  styleElement = document.head.appendChild(document.createElement('style'));
  readCheckboxes('.checkbox-status').forEach(className =>
    styleElement.sheet.insertRule(`.${className} {display: none;}`));
}

function getPersons() {
  return $.get('/persons').then(p => persons = p);
}

function updatePage() {
  const container = $('.container-monitor > .row');
  let lastElem;
  persons.forEach(entry => {
    const {external_id, pass_num} = entry;
    const personId = external_id || 'p' + pass_num;
    let elem = $('#person_' + personId).parent();
    if (elem.length) {
      lastElem = elem;
    } else {
      const html = template_monitor_person(Object.assign({
        camOut,
        personId,
        photoUrl: `//${photoSvcHost}:${photoSvcPort}/orig/${personId}.jpg`
      }, entry));
      const newElem = $(html);
      lastElem = lastElem ?
        newElem.insertAfter(lastElem) :
        container.children('.container-person').length ?
          newElem.prependTo(container) :
          newElem.appendTo(container.empty());
      newElem.find('.link-person').on('click', displayPersonData);
    }
  });
}

function getTodayEvents(mins=0) {
  lastEvents = [];
  let promises = [];
  const callback = (json) => {
    lastEvents = lastEvents.concat(json);
    //console.log(lastEvents);
  };
  promises.push($.get(`/monitor/today/${+mins}`).then(callback));
  return Promise.all(promises)
    .then(() =>
      lastEvents.sort((a, b) =>
        new Date(a.event_time).valueOf() - new Date(b.event_time).valueOf()))
    .catch(err => console.log(err));
}

function receiveMessage(event) {
  const data = event.originalEvent.data;
  if (!data) return;
  const json = JSON.parse(data);
  console.log(json);
  if (json.eventName) {
    if (json.eventName == 'face_true') {
      updateStatus(json);
      updateCounters();
    }
  } else {
    initStack.unshift(json);
  }
}

function displayPersonData(event) {
  const container = $('#modal_monitor .modal-body');
  const personId = $(event.target).closest('.card-person').attr('data-id');
  const json = persons.find(entry =>
    personId == entry.external_id || personId == 'p' + entry.pass_num);
  if (json) {
    container.html(template_monitor_details(Object.assign({personId}, json)));
    const photoUrl = $(`#person_${personId} .photo-orig`).attr('src');
    container.find('.photo-max').prop('src', photoUrl);
    updateModal();
    formatPhoneNumbers();
  } else {
    container.html(`<h6 class="p-3 text-danger">Ошибка</h6>`);
  }
}

function updateStatus(data) {
  const container = $(`#person_${data.external_id}`).parent();
  if (container.hasClass(`camera-${data.camera_id}`)) return;
  container
    .removeClass(`camera-${camIn} camera-${camOut}`)
    .addClass(`camera-${data.camera_id}`);
  const classes = {[camIn]: 'text-success', [camOut]: 'text-muted'};
  container.find('.status-mark').hide();
  container.find(`.${classes[data.camera_id]}`).fadeIn(500);
}

function updateCards() {
  const data = countWorkTime();
  //console.log(data);
  $('.card-person').each((idx, elem) => {
    const external_id = $(elem).attr('data-id');
    data[external_id] && updateStatus({
      external_id,
      camera_id: data[external_id].status ? camIn : camOut
    });
  });
  updateCounters();
  filter.start();
  return data;
}

function countWorkTime(person_id) {
  let events = lastEvents;
  if (!events.length) return {};
  const converted = events.reduce((result, entry) => {
    const {external_id} = entry;
    (result[external_id] || (result[external_id]=[])).push(entry);
    return result;
  }, {});
  const getTimes = (id) => {
    const data = converted[id];
    if (!data || !data.length) return {};
    const firstItem = data.find(entry => entry.camera_id==camIn) || {};
    const lastItem = data[data.length - 1];
    const timeEnter = firstItem.event_time;
    const timeLeave = lastItem.camera_id==camOut && lastItem.event_time || undefined;
    return {
      status: !!timeEnter && !timeLeave,
      timeEnter: convertTime(timeEnter, 'short'),
      enterByKey: !!firstItem.pass_num,
      timeLeave: convertTime(timeLeave, 'short'),
      leaveByKey: !!lastItem.pass_num,
      timeOffice: countTimeDiff(timeEnter, timeLeave, 'short'),
      items: [firstItem, timeLeave && lastItem || {}]
    };
  };
  if (person_id) return getTimes(person_id);
  let times = {};
  Object.keys(converted).forEach(id => times[id] = getTimes(id));
  return times;
}

function updateModal() {
  const buttons = $('#modal_monitor .refresh');
  const personId = $('#modal_monitor .media').attr('data-id');
  buttons.prop('disabled', true);
  getTodayEvents().then(() => {
    timer.start(Date.now());
    updateTimes(updateCards()[personId]);
    buttons.prop('disabled', false);
  });
}

function updateTimes(data={}) {
  const items = data.items || [];
  setTimeout(addMood, 0, items);
  const container = $('#modal_monitor');
  container.find('.person-status').addClass(data.status ? 'status-present' : 'status-absent');
  container.find('.person-time-enter span')
    .first()
    .text(data.timeEnter)
    .next('i').addClass(data.enterByKey ? 'fa-key' : 'fa-video-camera')
    .parent().toggle(!!data.timeEnter);
  container.find('.person-time-leave span')
    .first()
    .text(data.timeLeave)
    .next('i').addClass(data.leaveByKey ? 'fa-key' : 'fa-video-camera')
    .parent().toggle(!!data.timeLeave);
  container.find('.person-time-office').text(data.timeOffice || 0);
}

function updateCounters() {
  const cards = $('.card-person');
  const presentNum = cards.parent(`.camera-${camIn}`).length;
  const absentNum = cards.length - presentNum;
  $('.counter-present').text(presentNum);
  $('.counter-absent').text(absentNum);
}

function addMood(data=[]) {
  if (!data[0] && !data[1]) return;
  Promise.all(data.map(entry =>
    entry.file_name && $.get(`/attributes/${entry.file_name}`) || Promise.resolve(null))
  )
    .then(result =>
      ['.mood-enter', '.mood-leave'].forEach((cssClass, idx) =>
        result[idx] && $(`#modal_monitor ${cssClass}`)
          .addClass('person-mood-' + JSON.parse(result[idx][0].service_response)
            .face.attributes.emotions.predominant_emotion))
    )
    .catch(e => console.log(e))
}

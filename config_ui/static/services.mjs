import { Filter, formatBytes, escape, suggestFileName } from './util.mjs';
import { setListOnClick, setOnChange, setPasswordHandler, setAddonButtonHandler,
    setCollapseButtonHandler, addColorPicker, getRequest } from './ui.mjs'
import ms from './ms.mjs';

// Filters
const filterSvc = new Filter($('#content_filter'), $('#top_container'), {
  target: '.item-service',
  skip:   ':hidden'
});
Object.assign(filterSvc, {
  preStart() {
    this.container.find('.collapse.show').removeClass('show');
  },
  postStart() {
    updateSvcCounter()
  },
  onReset() {
    updateSvcCounter()
  }
});
const filterLog = new Filter($('#form_log_filter'), $('#modal_log .modal-container'), {
  target: '.line-log',
  skip:   ':hidden'
});
Object.assign(filterLog, {
  postStart() {
    updateLogCounter();
  },
  onReset() {
    if (modalLog.find('.modal-container .time-filtered').length) {
      filterLogByHours();
    }
    updateLogCounter();
  }
});

// Observables
const windowScroll = rxjs
  .fromEvent(window, 'scroll')
  .pipe(rxjs.operators.debounceTime(100));
const hostChange = rxjs
  .fromEvent(document.forms.form_hosts, 'change')
  .pipe(
    rxjs.operators.map(event => event.target.value),
    rxjs.operators.publish(),
    rxjs.operators.refCount()
  );
const refreshServices = rxjs
  .fromEvent(document.body.querySelectorAll('.btn-service-refresh'), 'click')
  .pipe(
    rxjs.operators.publish(),
    rxjs.operators.refCount()
  );
const updateStream = rxjs.merge(refreshServices, hostChange);
const modalRefreshBtnClicks = rxjs
  .fromEvent(document.body.querySelectorAll('.modal-content .refresh'), 'click')
  .pipe(
    rxjs.operators.filter(event =>
      !(event.target.form && (event.target.form.id == 'form_log_hours'))
    )
  )
  .pipe(
    rxjs.operators.publish(),
    rxjs.operators.refCount()
  );

// Common routines
let svcSubs = [];
function clearSubs() {
  svcSubs.forEach(s => s.unsubscribe());
  svcSubs = [];
}

function getConfigUrl(path='') {
  const configPort = $('#form_hosts').attr('data-port');
  return `//${document.forms.form_hosts.host_name.value}:${configPort}${path}`;
}

// services routines
function formatServices(json) {
  return json.map(entry => {
    entry.pm_uptime = ms(Date.now() - entry.pm_uptime);
    entry.monit.memory = formatBytes(entry.monit.memory);
    entry.max_memory_restart = entry.max_memory_restart &&
      formatBytes(entry.max_memory_restart);
    return entry;
  });
}
function setButtonOnClick(container) {
  container.find('.btn')
    .not('.btn-edit')
    .on('click', function() {
      $(this).find('.spinner').show();
      $('#services_content, .footer-services').disableButtons();
    });
}
let activeSvcId;
let scrollPos = 0;
function setSvcListHandlers(container) {
  container.find('.collapse')
    .on('show.bs.collapse', function () {
      activeSvcId = $(this).prev().attr('data-target');
      scrollPos = window.scrollY;
      const select = $(this).find('.config-file');
      const svcName = $(this).find('.svc-name').text();
      const path = `/config/dir/${encodeURIComponent(svcName)}`;
      getRequest(getConfigUrl(path))
        .subscribe({
          next(arr) {
            select.html(arr.map(entry =>
              `<option ${entry==select.attr('data-init-val') ? 'selected' : ''}>${entry}</option>`
            ).join(''));
            select.prop('disabled', false);
          },
          error(err) {
            alert(err.message || err);
          }
        });
    });
}
function setActiveSvcItem() {
  window.scrollTo(0, scrollPos);
  if (!activeSvcId) return;
  const activeItem = $('#services_content')
    .find(`.item-service[data-target="${activeSvcId}"]`);
  activeItem.addClass('active');
}
function setSvcButtonHandlers(container) {
  const handler = action => function () {
    const btn = $(this);
    const id = btn.attr('data-id') || getSvcIds();
    const path = `/services/${action}/${id}`;
    const request = getRequest(getConfigUrl(path), getEnv(btn));
    request
      .subscribe({
        error(err) {
          alert(err.message || err);
          $('#services_content, .footer-services').enableButtons();
        },
        complete() {
          $('#services_content, .footer-services').enableButtons();
          clearSubs();
          updateSvcPage();
        }
      });
  };
  const startAction = container.hasClass('footer-services') ? 'restart' : 'reload';
  container.find('.btn-service-start').on('click', handler(startAction));
  container.find('.btn-service-stop').on('click', handler('stop'));
}
function getSvcIds() {
  let ids = [];
  const total = $('#services_content .item-service').length;
  const selected = $('#services_content .service-id:visible');
  if (selected.length == total) return 'all';
  selected.each((idx, elem) => {
    ids.push($(elem).text());
  });
  return ids.join(',');
}
function getEnv(btn) {
  if (!btn.hasClass('btn-service-start') || btn.hasClass('btn-footer')) return;
  const container = btn.parent();
  const changed = container.find('.input-env.changed');
  let env = {};
  changed.each((idx, elem) => env[elem.name] = elem.value);
  return changed.length ? env : undefined;
}
function updateSvcPage() {
  const request = getRequest(getConfigUrl('/services'));
  const container = $('#services_content');
  svcSubs.push(request
    .subscribe({
      error(err) {
        alert(err.message || err);
        $('#top_container > .spinner').hide();
        $('#services_content, .footer-services').enableButtons();
        updateSvcCounter()
      },
      complete() {
        $('#top_container > .spinner').hide();
        $('#services_content, .footer-services').enableButtons();
        setListOnClick(container);
        setSvcListHandlers(container);
        setButtonOnClick(container);
        setSvcButtonHandlers(container);
        setEditButtonHandlers(container);
        setLogLinkHandlers();
        setOnChange(container.find('.collapse'));
        setActiveSvcItem();
        filterSvc.start();
      }
    })
  );
  svcSubs.push(request.subscribe(json =>
    container.html($(template_services(formatServices(json))))
  ));
}
function updateSvcCounter() {
  $('.counter-services').updateCounter('.item-service:visible');
}

updateStream.subscribe(() => {
  clearSubs();
  updateSvcPage();
});
hostChange.subscribe(name => {
  $('.host-name').text(name);
  $('#services_content, .footer-services').disableButtons();
  $('#services_content').empty();
  updateSvcCounter()
  $('#top_container > .spinner').show();
});
updateSvcPage();
setButtonOnClick($('.footer-services'));
setSvcButtonHandlers($('.footer-services'));


// modal_log routines
const modalLog = $('#modal_log');
const logHandlers = {
  next(json) {
    modalLog.find('.modal-container').html(formatLog(json.text));
  },
  error(err) {
    modalLog.find('.modal-container').text(err.message);
    modalLog.enableButtons();
    updateLogCounter();
  },
  complete() {
    modalLog.enableButtons();
    filterLog.start();
  }
};
function setLogLinkHandlers() {
  rxjs
    .fromEvent(document.body.querySelectorAll('#services_content .link-log'), 'click')
    .pipe(rxjs.operators.map(event => event.target.textContent))
    .subscribe(fileName => {
      const path = `/log/${encodeURIComponent(fileName)}`;
      modalLog.find('.modal-header > h5 > span:first-child').text(fileName);
      modalLog.find('.refresh').data('fileName', fileName);
      getRequest(getConfigUrl(path)).subscribe(logHandlers);
    });
}
const timeStampFormat = modalLog.find('.modal-container').attr('data-date-format');
const timeStampRe = new RegExp('^(' + escape(timeStampFormat).replace(/[A-Za-z]/g, '\\d') + ':)(.*)$');
function formatLog(text) {
  //text = text.trim();
  let timestamp = '';
  return text.length ? text.split('\n')
    //.reverse()
    .map(line => {
      let newLine = line.replace(timeStampRe, '<i>$1</i><span>$2</span>');
      if (newLine != line) {
        timestamp = new Date(line.substring(0, timeStampFormat.length-1)).valueOf();
      } else {
        newLine = `<span>${line}</span>`;
      }
      return `<div class="line-log" data-timestamp="${timestamp}">${newLine}</div>`;
    })
    .join('') : '';
}
function filterLogByHours() {
  const hours = document.forms.form_log_hours.log_hours.value;
  const now = Date.now();
  modalLog.find('.line-log').each((idx, elem) => {
    const timestamp = +$(elem).attr('data-timestamp');
    const show = !timestamp || now - timestamp <= 3600000*hours;
    $(elem)
      .addClass('time-filtered')
      .toggle(show)
      .children()
      .toggle(show)
  });
}
function updateLogCounter() {
  $('.counter-log').updateCounter('#modal_log .line-log:visible');
}

$('#form_log_hours .btn:submit').on('click', function (event) {
  event.preventDefault();
  filterLogByHours();
  updateLogCounter();
  filterLog.input.val() && filterLog.start();
  setTimeout(() => modalLog.enableButtons());
});
modalLog.find('.modal-footer .refresh').on('click', function () {
  const fileName = $(this).data('fileName');
  const path = `/log/${encodeURIComponent(fileName)}`;
  getRequest(getConfigUrl(path)).subscribe(logHandlers);
});
modalLog.on('shown.bs.modal', () => updateLogCounter());
modalLog.on('hidden.bs.modal', () => {
  $('#log_hours').val(1);
  $('#log_filter').val('');
  modalLog.find('.modal-container').empty();
});


// modal_edit routines
const modalEdit = $('#modal_edit');
const modalView = $('#modal_view');
function setEditButtonHandlers(container) {
  container.find('.btn-edit').on('click', function () {
    const container = $(this).parent();
    const fileInput = container.find('.config-file');
    const svcName = container.find('.svc-name').text();
    const fileName = fileInput.val();
    const path = `/config/file/${encodeURIComponent(svcName)}/${encodeURIComponent(fileName)}`;
    modalEdit.find('.modal-header > h5 > span').text(svcName);
    modalEdit.find('.modal-footer > div > div').text(fileName);
    modalEdit.find('.btn-save, .btn-save-as, .btn-view')
      .data('fileName', fileName)
      .data('svcName', svcName);
    getRequest(getConfigUrl(path))
      .subscribe({
        next(json) {
          modalEdit.find('.modal-container > form')
            .html(template_config(Object.assign({moduleName: ''}, json)));
          completeFormData(json, svcName);
          setModuleButtonHandlers(svcName, fileName);
        },
        error(err) {
          modalEdit.find('.modal-container')
            .html(`<div class="m-3">${err.message}</div>`);
        },
        complete() {
          setPasswordHandler(modalEdit);
          setAddonButtonHandler(modalEdit);
          setCollapseButtonHandler(modalEdit);
          setOnChange(modalEdit);
        }
      });
  });
}
function setModuleButtonHandlers(svcName, fileName) {
  const handler = function () {
    const collapse = $(this);
    const moduleName = collapse.prev()
      .find('.custom-control-input, .custom-select')
      .first().val();
    const path = `/config/file/${encodeURIComponent(svcName)}/${encodeURIComponent(moduleName)}/${encodeURIComponent(fileName)}`
    collapse.children('.spinner').show().next().empty();
    getRequest(getConfigUrl(path))
      .subscribe({
        next(json) {
          collapse.children('.spinner').hide().next()
            .html(template_config(Object.assign({moduleName}, json)));
          completeFormData(json, svcName, moduleName);
        },
        error(err) {
          collapse.children('.spinner').hide().next()
            .html(`<div class="mx-4 my-3">${err.message}</div>`);
        },
        complete() {
          setPasswordHandler(collapse);
          setAddonButtonHandler(collapse);
          setOnChange(collapse);
          collapse.find('.transport-sendmail').on('change', function () {
            collapse.find('.smtp-input').prop('disabled', $(this).prop('checked'));
          });
        }
      });
  };
  modalEdit.find('.module-select').on('change', function () {
    const collapse = $(this).parent().next('.collapse');
    collapse.hasClass('show') && handler.bind(collapse)();
  });
  modalEdit.find('.collapse').on('show.bs.collapse', handler);
}
function completeFormData(json, svcName, moduleName='') {
  // VA event checkboxes
  const contEvents = $(`#events_${moduleName}`);
  json.events && getRequest('/events').subscribe({
    next(events) {
      contEvents.children('.spinner').hide().next()
        .html(template_events({
          moduleName,
          events: events.map(entry => {
            const event = json.events.find(e => e.name == entry.name);
            return Object.assign({checked: !!event}, entry, event || {});
          })
        }));
    },
    error(err) {
      contEvents.children('.spinner').hide().next()
        .html(`<div class="mx-4 my-3">${err.message}</div>`);
    },
    complete() {
      setOnChange(contEvents);
      contEvents.find('input[type=checkbox]').on('change', function () {
        $(this).siblings().find('input').prop('disabled', !$(this).prop('checked'));
      });
      addColorPicker(contEvents);
    }
  });
  // Certificate management
  const selectCert = $(`#${moduleName}_cert_file`);
  if (selectCert.length) {
    const btnView = selectCert.next('.input-group-append').find('.btn-cert-view');
    const spinner = modalView.find('.spinner');
    const container = modalView.find('.modal-container > pre');
    selectCert.on('change', function () {
      btnView.prop('disabled', !$(this).val());
    });
    btnView.on('click', function () {
      container.text('');
      spinner.show();
      const certFile = selectCert.val();
      modalView.find('.modal-title').text(certFile);
      const path = `/config/cert/view/${certFile}`;
      getRequest(getConfigUrl(path)).subscribe({
        next(json) {
          container.text(json.stdout);
        },
        error(err) {
          spinner.hide();
          container.text(err.message);
        },
        complete() {
          spinner.hide();
        }
      });
    });
    updateCertList(selectCert);
    $('#form_upload').data('select_cert', selectCert);
  }
}
function updateCertList(select) {
  select.children().not(':first-child').remove();
  getRequest(getConfigUrl('/config/cert/list')).subscribe({
    next(list) {
      list.forEach(entry =>
        select.append(`<option ${entry==select.attr('data-init-val') ? 'selected' : ''}>${entry}</option>`));
    },
    error(err) {
      alert(err.message || err);
    },
    complete() {
      select.prop('disabled', false).trigger('change');
    }
  });
}
function getConfigFormData() {
  let config = {};
  const extract = (idx, elem) => {
    const value = elem.type=='checkbox' && !elem.hasAttribute('value') ?
      elem.checked && 1 || 0 :
      elem.value;
    elem.checkValidity() && elem.name && (config[elem.name] = isNaN(value) ? value : +value);
  }
  modalEdit.find('input.changed, select.changed, .changed input').each(extract);
  modalEdit.find('.multi .changed').closest('.multi').find('input, select').each(extract);
  console.log(config);
  return config;
}
$('#form_config').on('change', function () {
  modalEdit.find('.changed').length ?
    modalEdit.enableButtons('.btn-save, .btn-save-as') :
    modalEdit.disableButtons('.btn-save, .btn-save-as')
});
modalEdit.find('.btn-save, .btn-save-as').on('click', function () {
  modalEdit.disableButtons('.btn-save, .btn-save-as');
  const btn = $(this).closest('.btn');
  btn.find('.spinner').show();
  const svcName = btn.data('svcName');
  const fileName = btn.data('fileName');
  const newName = btn.hasClass('btn-save-as') ?
    prompt('Имя файла', suggestFileName(fileName)) : fileName;
  if (!newName) return false;
  const path = `/config/file/${encodeURIComponent(svcName)}/${encodeURIComponent(fileName)}/${encodeURIComponent(newName)}`;
  getRequest(getConfigUrl(path), getConfigFormData()).subscribe({
    error(err) {
      alert(err.message || err);
    },
    complete() {
      if (newName != fileName) {
        modalEdit.find('.modal-footer > div > small').text(newName);
      }
      modalEdit.enableButtons('.btn-save, .btn-save-as');
    }
  });
});
modalEdit.find('.btn-view').on('click', function () {
  const spinner = modalView.find('.spinner');
  const container = modalView.find('.modal-container > pre');
  const btn = $(this).closest('.btn');
  const svcName = btn.data('svcName');
  const fileName = btn.data('fileName');
  const path = `/config/file/${encodeURIComponent(svcName)}/${encodeURIComponent(fileName)}`;
  modalView.find('.modal-title').text(`${svcName} | ${fileName}`);
  container.text('');
  spinner.show();
  getRequest(getConfigUrl(path)).subscribe({
    next(json) {
      container.text(JSON.stringify(json,null, 2));
    },
    error(err) {
      spinner.hide();
      container.text(err.message);
    },
    complete() {
      spinner.hide();
    }
  });
});
modalEdit.on('hide.bs.modal', function () {
  $(this).disableButtons('.btn-save, .btn-save-as');
  $(this).find('.modal-footer > div > small').empty();
  updateSvcPage();
});

// Modal certificate upload
const modalUpload = $('#modal_upload');
$('#input_upload_file').attr('accept', '.pem');
$('#input_upload_file').on('change', function (event) {
  const files = event.target.files;
  const container = $(this).siblings('ul');
  container.empty();
  Array.from(files).forEach(f => container.append(`<li>${f.name}</li>`));
  modalUpload.find('.btn-upload').prop('disabled', !files.length);
});
$('#form_upload').on('submit', function (event) {
  event.preventDefault();
  $(this).disableButtons('.btn-upload').find('.spinner').show();
  const xhr = new XMLHttpRequest();
  xhr.open('POST', getConfigUrl('/config/cert/upload'));
  xhr.onload = () => {
    if (xhr.status == 200) {
      updateCertList($(this).data('select_cert'));
      modalUpload.modal('hide');
    } else {
      alert(xhr.statusText);
      $(this).enableButtons('.btn-upload');
    }
  };
  xhr.onerror = (err) => {
    alert(err.message || 'Error');
    $(this).enableButtons('.btn-upload');
  };
  xhr.ontimeout = () => {
    alert('Timeout');
    $(this).enableButtons('.btn-upload');
  };
  const body = new FormData();
  const files = $('#input_upload_file')[0].files;
  Array.from(files).forEach(f => body.append(f.name, f));
  xhr.send(body);
});
modalUpload.on('hide.bs.modal', function () {
  $(this).disableButtons('.btn-upload').find('.spinner').hide();
  $(this).find('ul').empty();
  $('#input_upload_file').val('');
});

// Modal commons
modalRefreshBtnClicks.subscribe(event =>
  $(event.target).closest('.modal-content').disableButtons('.refresh')
);
$('.modal').modalScrollUp();

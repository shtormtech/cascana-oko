const util = {
  formatBytes(bytes, decimals=2) {
      if (bytes == 0) return 0;
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  readCheckboxes(selector) {
    let clsToHide = [];
    $(selector).each((idx, elem) =>
      $(elem).prop('checked') || clsToHide.push('camera-' + $(elem).attr('data-cam'))
    );
    return clsToHide;
  },

  formatPhoneNumbers() {
    $('.phone-number').each((idx, elem) => {
      if (!$(elem).hasClass('converted')) {
        $(elem).text() && $(elem).text($(elem).text().trim().replace(/^(.{2})(.{3})(.+)$/, '$1 $2 $3'));
        $(elem).addClass('converted');
      }
    });
  },

  countTimeDiff(time0, time1, timeStyle='medium') {
    if (!time0) return 0;
    const value1 = time1 ? new Date(time1).valueOf() : Date.now();
    const resultValue = value1 - new Date(time0).valueOf();
    return resultValue > 24*60*60*1000 ?
      '>24ч' :
      new Date(resultValue).toLocaleTimeString('ru', {timeZone: 'UTC', timeStyle});
  },

  convertTime(timeStr, timeStyle='medium') {
    return timeStr && new Date(timeStr).toLocaleTimeString('ru', {timeStyle}) || '';
  },

  escape(str) {
    return str.replace(/(\W)/g, '\\$1');
  },

  genItemId(size=10) {
    return parseInt(Math.random()*10**size).toString(32);
  },

  genPassword(size=2) {
    const arr = new Uint32Array(size);
    crypto.getRandomValues(arr);
    const result = Array.from(arr).map(n =>
      n.toString(36)).join('');
    return Array.from(result).map(c =>
      Math.random() > Math.random() ? c.toUpperCase() : c).join('');
  },

  getDateString(date=new Date()) {
    return date.getFullYear() +
      `0${date.getMonth()}`.slice(-2) +
      `0${date.getDate()}`.slice(-2) +
      `0${date.getHours()}`.slice(-2) +
      `0${date.getMinutes()}`.slice(-2) +
      `0${date.getSeconds()}`.slice(-2) +
      `00${date.getMilliseconds()}`.slice(-3);
  },

  suggestFileName(currentName) {
    const suffix = `-${util.getDateString()}`;
    return currentName.replace(/(^[^\.]+)(.*)$/, '$1' + suffix + '$2');
  },

  arrayDedupe(arr) {
    return arr.reduce((result, entry) =>
      result.includes(entry) && result || [...result, entry], []);
  }
};

export class Timer {
  constructor(delay, container) {
    this.id = 't' + (parseInt(Math.random()*10**10)).toString(36);
    this.delay = delay;
    this.container = container; // jQuery element
  }

  start(time0) {
    this.reset();
    this.time0 = time0;
    this.ref = setInterval(this.display.bind(this), this.delay);
    return this;
  }

  count() {
    const units = [['мин', 60000], ['сек', 1000]];
    const term = Date.now() - this.time0;
    const result = units.find(entry => entry[1] < term);
    return result && `более ${Math.round(term/result[1])} ${result[0]} назад` || '';
  }

  reset() {
    clearInterval(this.ref);
    this.ref = undefined;
    this.container.empty();
    return this;
  }

  display() {
    if (!this.container || this.container.is(':hidden')) {
      this.reset();
      return;
    }
    this.container.text(this.count());
    return this;
  }
}

export class Filter {
  constructor(form, container, params) {
    this.form = form;
    this.container = container;
    this.params = params;
    this.input = form.find('input[type=text]');
    this.setHandlers();
  }

  setHandlers() {
    this.form
      .on('submit', this.start.bind(this));
    this.input
      .on('input', () =>
        (this.timeout === undefined) && (this.timeout = setTimeout(this.start.bind(this), 500)));
    this.form.find('.filter-reset')
      .on('click', this.reset.bind(this));
  }

  start(event) {
    event && event.type=='submit' && event.preventDefault();
    const searchStr = this.input.val();
    if (searchStr.length == 0) {
      this.reset();
      return;
    }
    this.preStart && this.preStart();
    this.redisplay();
    const re = new RegExp(`(${util.escape(searchStr)})`, 'ig');
    this.container
      .find(this.params.target)
      .each((idx, target) => {
        let visible = false;
        $(target).find('*').not(this.params.skip).each((idx, elem) => {
          if ((elem.hasChildNodes() && elem.children.length==0) || $(elem).children('.search').length) {
            //const text = $(elem).text().trim();
            const text = $(elem).text();
            if (text.length == 0) return;
            if (re.test(text)) {
              $(elem).html(text.replace(re, '<span class="search">$1</span>'));
              visible = true;
            }
          }
        });
        $(target).toggle(visible);
      });
    this.postStart && this.postStart(this);
    this.timeout = undefined;
    return this;
  }

  redisplay() {
    this.container.find('span.search').replaceWith(function () {
      return $(this).text();
    });
    this.container.find(this.params.target).css('display', '');
  }

  reset() {
    this.input.val('');
    this.timeout = undefined;
    this.redisplay();
    this.onReset && this.onReset();
    return this;
  }
}

export const {
  formatBytes,
  readCheckboxes,
  formatPhoneNumbers,
  countTimeDiff,
  convertTime,
  escape,
  genItemId,
  genPassword,
  suggestFileName,
  arrayDedupe
} = util;

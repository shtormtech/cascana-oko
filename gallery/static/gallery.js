(() => {
  const socket = io();

  const dir = '/gallery' + location.pathname.replace(/(\/)?$/, '\/');
  const getParam = (name) => {
    try {
      return location.search.match(new RegExp(`.*[\\?\\&]{1}${name}=([^\\&]+).*`))[1];
    } catch (e) {}
  };
  const size = +getParam('size');
  if (size) {
    // Set image size in pixels
    $('.template img').css('width', size+'px');
  }
  if (['false', 'no', 'off'].indexOf(getParam('paging'))>-1) {
    // Turn off paging
    $('.bar').hide();
    $('body').css('padding', 0);
  }
  let imageList;
  let curPage = getParam('page') || 1;
  let options = {
    pageSize: getParam('count') || 10,
    autoHidePrevious: true,
    autoHideNext: true,
    showGoInput: true,
    showGoButton: true,
    formatGoInput: 'на страницу <%= input %>',
    callback: (data, pagination) => {
      $('.gallery div').replaceWith(compose(data));
    },
    afterPageOnClick: (e, num) => curPage = num,
    afterNextOnClick: (e, num) => curPage = num,
    afterGoButtonOnClick: (e, num) => curPage = num
  };
  const bgColor = decodeURIComponent(getParam('bgc'));
  bgColor && $('body').css('background-color', bgColor);

  const init = (list) => {
    imageList = list;
    options.dataSource = list;
    options.pageNumber = curPage;
    $('.pagination').pagination(options);
  };

  const setTitle = function () {
    this.title = `${this.clientWidth} x ${this.clientHeight}`;
  };

  const fname =  ['false', 'no', 'off'].indexOf(getParam('fname'))>-1;
  const compose = (list) => {
    const container = $('<div></div>');
    list.forEach(name => {
      let elem = $('.template > figure').clone();
      let img = elem.find('img').attr('src', dir + name);
      if (!size) {
        img.on('load', setTitle);
      }
      elem.find('figcaption')
        .html((fname ? '' : `<span class="filename">${name}</span><br>`) +
          //`<span class="time">${name.substr(4, 10).replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$2.$1 $3:$4:$5')}</span>`);
          (/\d{17}(_.+)?\.jpg$/.test(name) ? `<span class="time">${name.substr(4, 10).replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$3:$4:$5')}</span>` : ''));
      container.append(elem);
    });
    return container;
  };

  socket.on('init', (list) => {
    init(list);
  });

  socket.on('add', (item) => {
    imageList.unshift(item);
    init(imageList);
  });

  socket.on('remove', (item) => {
    init(imageList.splice(imageList.indexOf(item), 1));
  });
})();

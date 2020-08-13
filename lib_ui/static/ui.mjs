import { genPassword } from './util.mjs';

export function setListOnClick(container) {
  return container.find('.list-group-item-action')
    .on('click', function () {
      $(this)
        .closest('.list-group')
        .find('.list-group-item.active')
        .removeClass('active');
      $(this).addClass('active');
    });
}

export function setOnChange(container) {
  return container.find('input, select').on('change', function () {
    const input = $(this);
    const initVal = input.attr('data-init-val');
    if (input.prop('type')=='checkbox') {
      input.parent().toggleClass('changed', input.prop('checked').toString()!=initVal);
    } else {
      input.toggleClass('changed', input.val()!=initVal);
    }
  });
}

export function setPasswordHandler(container) {
  container.find('.password-addon-toggle').on('click', function () {
    const state = $(this).children('i').hasClass('fa-eye');
    $(this).children('i')
      .toggleClass('fa-eye-slash', state)
      .toggleClass('fa-eye', !state);
    $(this).parent()
      .siblings('.input-password')
      .attr('type', state ? 'text' : 'password');
  });
  container.find('.password-addon-refresh').on('click', function () {
    $(this).parent().siblings('.input-password')
      .val(genPassword())
      .trigger('change');
  });
}

export function setAddonButtonHandler(container) {
  return container.find('.item-addon-minus, .item-addon-plus').on('click', function () {
    const inputGroup = $(this).closest('.input-group');
    const onchange = () => {
      inputGroup.parent().addClass('changed');
      inputGroup.closest('form').trigger('change');
    };
    if ($(this).hasClass('item-addon-minus')) {
      if (inputGroup.parent().find('.input-group').length > 1) {
        onchange();
        inputGroup.remove();
      } else {
        alert('Невозможно удалить единственную позицию');
      }
    } else {
      if (inputGroup.parent().find('.input-group').length < 10) {
        onchange();
        inputGroup.clone(true).insertAfter(inputGroup)
          .parent().children('.input-group').each((idx, elem) =>
            $(elem).children().each((i, e) =>
              e.name && (e.name = e.name.replace(/(?<=\[)\d+(?=\])/, idx)))
          );
      } else {
        alert('Невозможно создать более 10 позиций');
      }
    }
  });
}

export function setCollapseButtonHandler(container) {
  return container.find('button[data-toggle=collapse]').on('click', function () {
    $(this).children('i').toggleClass('fa-caret-up fa-caret-down');
  });
}

export function addColorPicker(container) {
  return container.find('.color-picker')
    .colorpicker({
      fallbackColor: '#FFFFFF',
      extensions: [{
        name: 'swatches',
        options: {
          colors: {
            red:       '#FF0000',
            DarkRed:   '#8B0000',
            orange:    '#FFA500',
            OrangeRed: '#FF4500',
            yellow:    '#FFFF00',
            gold:      '#FFD700',
            LimeGreen: '#32CD32',
            MediumSeaGreen: '#3CB371',
            RoyalBlue: '#4169E1',
            navy:      '#000080'
          },
          namesAsValues: true,
        }
      }]
    });
}

export function getRequest(url, body, headers={}) {
  // rxjs required
  const req = body ?
    {
      url,
      method: 'POST',
      body,
      headers: Object.assign({'Content-Type': 'application/json'}, headers)
    } : {url, headers};
  return rxjs
    .ajax.ajax(req)
    .pipe(
      rxjs.operators.map(res => res.response),
      rxjs.operators.publish(),
      rxjs.operators.refCount()
    )
}

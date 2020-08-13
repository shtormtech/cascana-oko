$.fn.extend({
  disableButtons(selector='.btn') {
    return $(this).find(selector)
      .prop('disabled', true);
  },

  enableButtons(selector='.btn') {
    const buttons = $(this).find(selector);
    buttons
      .prop('disabled', false)
      .find('.spinner:visible').hide();
    return buttons;
  },

  updateCounter(num=0) {
    num = isNaN(num) ? $(num).length : num;   // num is a selector string
    return $(this).text(num);
  },

  modalScrollUp(selector='.scroll-up') {
    const modals = $(this);
    modals
      .on('shown.bs.modal', function () {
        $(this).one('scroll', function () {
          $(this).find('.scroll-up').show();
        });
      })
      .on('hidden.bs.modal', function () {
        $(this).find('.scroll-up').hide();
      })
      .find(selector).on('click', function () {
        $(this).closest('.modal').scrollTop(0);
      });
    return modals;
  }

});

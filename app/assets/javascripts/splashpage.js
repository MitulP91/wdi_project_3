// Splash Page Modal Login and Signup
$(function() {
  $('.modal').on('click', function() {
    var modal_id = $(this).attr('id').replace("-link","");
    console.log(modal_id);
    show_modal(modal_id);
  });

  $('.close_modal').on('click', function() {
    close_modal();
  });

	function close_modal() {
    $('#mask').stop().fadeOut(500);
    $('.modal-window').stop().fadeOut(500);
	}

	function show_modal(modal_id) {
    $('#mask').stop().fadeOut(0);
    $('.modal-window').stop().fadeOut(0);
    $('#mask').css({ 'display' : 'block', opacity : 0});
    $('#mask').stop().fadeTo(500,0.8);
    $('#'+modal_id).stop().fadeIn(500);
	}
});
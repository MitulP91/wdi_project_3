// Prepares all redis events when threads are open
function prepareBroadcast() {
	// Checks to see that the user is in a room
	// TODO: Find a better way to match URL
	if((document.URL).match(/\/rooms\/.+/)) {
	  getRoomId(); // changes global variable to user's room id
	  var source = new EventSource('/rooms/events?room_id=' + room_id);
	  var room;

	  // Publishes when user in room adds song to playlist ---------------------------------
	  source.addEventListener('add_song_'+room_id, function (e) {
	  	console.log('add song redis triggered');
	  	data = JSON.parse(e.data);
	  	console.log(data);
	  	$("#room-" + room_id + " #playlist").append($('<li>'+data.title+' added by '+data.added_by+'</li>'));
	  });

	  // Publishes when a new user joins the room ------------------------------------------
	  source.addEventListener('add_user_'+room_id, function (e) {
	  	console.log('add user redis triggered');
	    data = JSON.parse(e.data);
	    console.log(data);
	    $("#room-" + room_id + " #current-users").append($('<li>').attr('id', data.id).text(data.user));
	  });

	  // Publishes to remove user when user leaves the room --------------------------------
	  source.addEventListener('remove_user_'+room_id, function (e) {
	  	console.log('remove user redis triggered');
	  	data = JSON.parse(e.data);
	  	console.log(data);
	  	$("#room-" + room_id + " #current-users #" + data.id).remove();
	  });

	  // Publishes to change song ----------------------------------------------------------
	  source.addEventListener('change_song_'+room_id, function (e) {
	  	console.log('change song redis triggered');
	  	data = JSON.parse(e.data);
	  	console.log(data);
	  	// reset the global variables
	  	like = 0; 
	  	dislike = 0;
	  	like_count = 0;
	  	dislike_count = 0;
	  	// --------------------------
	  	$('#room-' + room_id + " #like .num").text(like);
	  	$('#room-' + room_id + " #dislike .num").text(dislike);
	  	window.playSong(data.sc_ident);
	  	if(isMuted) {
	  		song.toggleMute();
	  	}
	  	$("#room-" + room_id + " #current-track").text(data.title);
	  });


	  // Publishes to show a like or dislike -----------------------------------------------
	  source.addEventListener("like_or_dislike_"+room_id, function (e) {
	  	console.log('voted redis triggered');
	  	data = JSON.parse(e.data);
	  	console.log(data);
	  	if(data.vote === 'like') {
	  		like = data.likes;
	  		$('#room-' + room_id + " #like .num").text(like);
	  	} else if(data.vote === 'dislike') {
	  		dislike = data.dislikes;
	  		$('#room-' + room_id + " #dislike .num").text(dislike);

	  		if(dislike >= Math.ceil(data.users / 2)) {
	  			app.changeCurrentSong(data.sc_ident);
	  		}
	  	}
	  });

	  // Publishes to add message to chatroom ----------------------------------------------
	  source.addEventListener("add_message_"+room_id, function (e) {
	  	console.log('chat redis triggered');
	  	data = JSON.parse(e.data);
	  	console.log(data);
	  	$('#room-' + room_id + " #messages").append('<div><span class="content">'+data.message+'</span><br/><span class="author"> - '+data.author+'</span></div><hr/></div>');
	  	$('#messages').scrollTop(999999);
	  });
	}
}
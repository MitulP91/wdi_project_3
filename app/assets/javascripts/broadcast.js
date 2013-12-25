// Prepares all redis events when threads are open
function prepareBroadcast() {
	// Checks to see that the user is in a room
	// TODO: Find a better way to match URL
	if((document.URL).match(/\/rooms\/.+/)) {
		getRoomId(); // changes global variable to user's room id
		var source = new EventSource('/rooms/events?room_id=' + room_id);
		var room;

		// Publishes when user in room adds song to playlist ---------------------------------
		source.addEventListener('add_song_' + room_id, function (e) {
		data = JSON.parse(e.data);
		$("#room-" + room_id + " #playlist").append($('<li><i class="fa fa-chevron-right"></i> &nbsp;' + data.title + '<br>&nbsp;&nbsp;&nbsp;&nbsp;<span class="added-by">added by ' + data.added_by + '</span></li>'));
		// --- Masonry Append ---
		var $container = $("#room-" + room_id + " #album-art-container");
			var msnry = $container.data('masonry');
			$container.masonry({
				itemSelector: '.cover-art',
				columnWidth: 80,
				isAnimated: true
			});
			var random_num = (Math.random() * 70) + 90;
			var $image_div = $("<div id='art-" + data.sc_ident + "' class='cover-art'><img style='height: " + random_num + "px; width: " + random_num + "px;' src=" + data.album_art + ">");
			$container.prepend($image_div).masonry('reload');
			// --- end ---
		});

		// Publishes when a new user joins the room ------------------------------------------
		source.addEventListener('add_user_' + room_id, function (e) {
			data = JSON.parse(e.data);
			$("#room-" + room_id + " #current-users").append($('<li>').attr('id', data.id).text(data.user));
		});

		// Publishes to remove user when user leaves the room --------------------------------
		source.addEventListener('remove_user_' + room_id, function (e) {
			data = JSON.parse(e.data);
			$("#room-" + room_id + " #current-users #" + data.id).remove();
		});

		// Publishes to change song ----------------------------------------------------------
		source.addEventListener('change_song_' + room_id, function (e) {
			data = JSON.parse(e.data);
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
		source.addEventListener("like_or_dislike_" + room_id, function (e) {
			data = JSON.parse(e.data);
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
		source.addEventListener("add_message_" + room_id, function (e) {
			data = JSON.parse(e.data);
			num_messages++;
			checkMessages();
			$('#room-' + room_id + " #messages").append('<div><span class="content">' + data.message + '</span><br/><span class="author"> - ' + data.author + '</span></div><hr/></div>');
			$('#messages').scrollTop(999999);
		});
	}
}
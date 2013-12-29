var app = app || {};

var app = {
	// Adds a new user to the room and plays the rooms current song ------------------------
	newUser: function(room_id) {
		$.ajax({
			url: '/rooms/get_time',
			type: 'POST',
			dataType: 'json',
			async: false,
			data: {room_id: room_id}
		}).done(function(data) {
			if(data.sc_ident) {
				$("#room-" + room_id + " #current-track").text(data.title);
				window.playSong(data.sc_ident, data.elapsed);
			}
			if(data.album_arts) {
				setTimeout(function() {
					for(var i = 0; i < data.album_arts.length; i++) {
						window.animateAlbumArt(data.album_arts[i]);
					}
				}, 500);
			}
		});
	},

	// Removes user from the room ----------------------------------------------------------
	removeUser: function(id) {
		$.ajax({
			url: '/rooms/remove_user',
			async: false,
			type: 'POST',
			dataType: 'json',
			data: {room_id: id}
		});
	},

	// Adds a new song to the rooms playlist when user picks one ---------------------------
	addNewSong: function(artist, title, stream_url, album_art, sc_ident, genre) {
		$.ajax({
			type: 'POST',
			url: '/rooms/add_song',
			async: false,
			dataType: 'json',
			data: {song: {artist: artist , title: title , stream_url: stream_url, album_art: album_art, sc_ident: sc_ident, genre: genre}}
		});
	},

	// Changes the song in room when previous one ends, or none are existing ---------------
	changeCurrentSong: function(sc_ident) {
		$.ajax({
			type: 'POST',
			url: '/rooms/change_song',
			dataType: 'json',
			async: false,
			data: {current_sc_ident: sc_ident}
		});
	},

	// Likes or dislikes the currently playing song ----------------------------------------
	likeOrDislike: function(val) {
		$.ajax({
			type: 'POST',
			url: '/rooms/like_or_dislike',
			dataType: 'json',
			async: false,
			data: {vote: val}
		});
	},

	// Send a message to the room ----------------------------------------------------------
	sendMessage: function(string) {
		$.ajax({
			type: 'POST',
			url: '/rooms/add_message',
			dataType: 'json',
			data: {message: string}
		});
	}
};


// Global variables ----------------------------------------------------------------------
var song;
var room_id;
var like = 0;
var dislike = 0;
var like_count = 0; // Seems redundant, but being used to stop user from voting more than once per song
var dislike_count = 0; // Seems redundant, but being used to stop user from voting more than once per song
var isMuted = false; // Carries mute result from one song to the next
var volume = 50; // Default volume
var num_messages = 0; // Default number of messages received

// Document ready function ---------------------------------------------------------------
$(function() {
	// Connect to SoundCloud
	SC.initialize({
		client_id: '6fd538372b02e1f99a4145ee258cda36' // TODO: Make this an environment variable?
	});

	// Prepare event listeners and redis broadcasts
	prepareBroadcast(); // found at broadcast.js
	searchButtonClick(); // found below
	searchResultClick(); // found below
	muteButton(); // found below
	voteClick(); // found below
	messageClick(); // found below
	volumeSlider(); // found below
	logoSearch(); // found below
	logoChat(); // found below
	searchResultHover(); // found below

	// Trigger certain events on room page load
	if((document.URL).match(/\/rooms\/.+/)) {
		getRoomId(); // change global variable
		$('#room-'+room_id).fadeIn(1000);
		app.newUser(room_id); // add new user to room list
	}

	if((document.URL).match(/\/home\/index/)) {
		$('#all-rooms').fadeIn(1000);
		findRoom();
	}
});

// Window unload function ----------------------------------------------------------------
window.onbeforeunload = function(e) {
	if((document.URL).match(/\/rooms\/.+/)) {
		if(song) {
			song.unload(); // Backup. In case of error where song object carries out of room, unload it
			song = undefined;
		}
		isMuted = false;
		var id = parseInt(room_id);
		app.removeUser(id);
		return null;
	}
};

// Plays a song based on SoundCloud ID and current song position --------------------------
function playSong(sc_ident, position) {
	if(typeof(position)==='undefined') position = 0; // If no position is given, defaults to 0
	SC.stream('/tracks/' + sc_ident, {position: position, onfinish: function() {
		app.changeCurrentSong(sc_ident); // Change song when previous one ends
	}}, function(sound) {
		if(song){
			song.unload(); // Safety. Unload song before new song is loaded
		}
		song = sound; // Assign song to global variable
		song.setVolume(volume);
		song.play();
	});
}

// Assigns global variable to current room id --------------------------------------------
function getRoomId() {
	room_id_unparsed = $(".room").attr('id');
	room_id = parseInt(room_id_unparsed.replace("room-",""));
}

// Index page room listeners -------------------------------------------------------------
function findRoom() {
	$('#find-room').on('click', function() {
		$('.roomlist').stop().fadeIn(600);
	});

	$('#create-room-link').on('click', function() {
		$('.roomlist').stop().fadeOut(600);
	});
}

// Slides out search menu ----------------------------------------------------------------
function logoSearch() {
  $('#logo-search').on('click', function() {
    if ($(".room").hasClass('out-left')) {
			$('#search-text').attr('disabled', 'disabled');
      $('.room').stop().animate({
        left: '0'
      }, 500);
      $('.room').toggleClass('out-left');
    } else {
			$('#search-text').removeAttr('disabled');
      $('.room').stop().animate({
        left: '-20%'
      }, 500);
      $('.room').toggleClass('out-left');
    }
  });
}

// function clickAnywhereToSlideSearchBack() {
//	$('#main-container').
// }


// Displays chat room --------------------------------------------------------------------
function logoChat() {
	$('#logo-chat').on('click', function() {
		$('#chatroom').stop().fadeToggle(500);
		checkMessages();
	});
}

// Returns search results from SoundCloud on click ---------------------------------------
function searchButtonClick() {
	$('#search-button').on('click', function() {
		var search_string = $('#search-text').val();
		$search_text.val('');
		if(search_string !== '') {
			searchSC(search_string);
		}
	});

	var $search_text = $('#search-text');
  $search_text.on('keyup', function(e) {
    if(e.keyCode === 13) {
      search_string = $search_text.val();
      $search_text.val('');
      if(search_string !== '') {
				searchSC(search_string);
			}
			$('#search-results').scrollTop(0);
    }
  });
}

// Queries the SoundCloud API for songs matching a search string -------------------------
function searchSC(search_string) {
	SC.get('/tracks', { q: search_string, limit: 25, order: 'hotness', streamable: true }, function(tracks) {
		search_return = tracks; // Returns all search results from SoundCloud
		var $search_results = $('#search-results');
		$search_results.empty();
		for(i = 0; i < tracks.length; i++) {
			if(tracks[i].streamable === true) { // Checks to see if the track can be streamed
				var id = tracks[i].id;
				$search_results.append($("<div class='each-result' id='song-"+id+"' data-index='"+i+"'><span id='results-title'>"+tracks[i].title+"</span></div>"));
			}
		}
	});
}

// Adds a hover effect on the returned search results ------------------------------------
function searchResultHover() {
	$("#search-results").on("mouseenter", "div", function() {
		$(this).animate({
			"color": "#27ae60",
			"opacity": "1"
		}, 500);
	});

	$("#search-results").on("mouseleave", "div", function() {
		$(this).animate({
			"color": "white",
			"opacity": "0.7"
		}, 500);
	});
}

// Puts a song from the search results to room playlist on click -------------------------
function searchResultClick() {
	$("#search-results").on("click", "div", function() {
		var index = $(this).attr('data-index');
		var sc_ident = search_return[index].id;
		var title = search_return[index].title;
		var stream_url = search_return[index].stream_url;
		var artist = search_return[index].user.username;
		var album_art;
		var genre;
		if(search_return[index].artwork_url === null || search_return[index].artwork_url === '') {
			album_art_array = ["http://epilepsyu.com/wp-content/uploads/2013/10/brain_music-150x150.jpeg", "http://hammarica.com/wp-content/uploads/2013/10/1005-Ghost-Crew-Hammarica-PR-657-DJ-Agency-Bookings-Electronic-Dance-Music-News-80x80.jpg", "http://www.cellphone-wallpapers.net/thumb.php?p=Wallpapers/User/20869-colors---rainbow.jpg&m=1&h=75&w=90", "http://media.npr.org/assets/news/2010/02/19/giantfish_sq-e1595c4822f1bcbd17bb2882a030859498a2b876-s11.jpg"]; // Default album art
			album_art = album_art_array[Math.floor(Math.random() * album_art_array.length)];
		} else {
			album_art = search_return[index].artwork_url;
		}
		if(search_return[index].genre === null || search_return[index].genre === '') {
			genre = "Not Given"; // Default genre
		} else {
			genre = search_return[index].genre;
		}
		app.addNewSong(artist, title, stream_url, album_art, sc_ident, genre);
		if(typeof(song) === 'undefined') {
			app.changeCurrentSong(sc_ident); // Plays if no song is in the room yet
			$('#current-track').text(title); // Changes currently playing text
		}
	});
}

// Submits like or dislike to currently played song --------------------------------------
function voteClick() {
	$('#like').on('click', function(e) {
		if(like_count === 0) { // If you haven't voted before, you can vote.
			app.likeOrDislike('like');
			like_count++;
		}
	});
	$('#dislike').on('click', function(e) {
		if(dislike_count === 0) { // If you haven't voted before, you can vote.
			app.likeOrDislike('dislike');
			dislike_count++;
		}
	});
}

// Submits message to chatroom when clicked or enter -------------------------------------
function messageClick() {
	$message_input = $('#message-input');
	$('#send').on('click', function(e) {
		e.preventDefault();
		message = $message_input.val(); // Gets the message content from input field
		$message_input.val('');
		if(message !== '') {
			app.sendMessage(message); // Sends message to be published
		}
	});

	$message_input.on('keyup', function(e) {
		if(e.keyCode === 13) { // Listens for user hitting enter while in input-field
			message = $message_input.val();
			$message_input.val('');
			if(message !== '') {
				app.sendMessage(message);
			}
		}
	});
}

// Checks to see if you have unviewed messages -------------------------------------------
function checkMessages() {
	$logo_chat = $('#logo-chat');
	if($('#chatroom:visible').length === 0 && num_messages > 0) {
		$logo_chat.animate({
			"background-color": "red"
		}, 300);
	} else {
		num_messages = 0;
		$logo_chat.animate({
			"background-color": "black"
		}, 300);
	}
}

// Mute button ---------------------------------------------------------------------------
function muteButton() {
	$('#mute').on('click', function() {
		song.toggleMute();
		isMuted = !isMuted; // Each time you click, toggles between true and false
	});
}

// Masonry album art --------------------------------------------------------------------- 
function animateAlbumArt(album_art) {
	var $container = $('#album-art-container');
	var msnry = $container.data('masonry');
	$container.masonry({
		itemSelector: '.cover-art',
		columnWidth: 80,
		isAnimated: true
	});
	var random_num = (Math.random()*70)+90;
  var $image_div = $("<div class='cover-art'><img style='height: "+random_num+"px; width: "+random_num+"px;' src="+album_art+">");
  $container.prepend($image_div).masonry('reload');
}

// jQuery UI slider for volume -----------------------------------------------------------
function volumeSlider() {
	$('#slider').slider({
		min: 0, // Ranges from 0-100 (SoundCloud volume range)
		max: 100,
		value: 50,	// Default volume is 50
		slide: function(event, ui) {}
	});

	$('#slider').on('slide', function() {
		volume = $('#slider').slider('value');
		$('#vol').text(volume);
		if(song) {
			song.setVolume(volume); // Changes song volume based on slider value
		}
	});
}
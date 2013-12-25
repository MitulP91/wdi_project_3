require 'streamer/sse' # found in lib

class RoomsController < ApplicationController 
	include ActionController::Live  # allows for use of SSE and concurrency (web socket)
	before_filter :authenticate_user!

	# Initializes each room ----------------------------------------------------------------
	def initialize_room  
		@room = Room.find(params[:id])
		@users = @room.users
		@playlist = @room.songs.order('id') # Orders playlist for new users joining
		@this_user = current_user # Redundant?
		current_song = Song.where(currently_playing: true, room_id: @room.id).first 
		# --- Displays likes/dislikes if a song is playing ---
		if current_song 
			@likes = current_song.likes
			@dislikes = current_song.dislikes
		end
		# --- end ---
	end

	# Adds a new user to room and if song is playing, puts them in wherever that song is ---
	def get_time 
		response.headers['Content-Type'] = 'text/javascript' # Tells Rails/Redis that content is JavaScript
		room = Room.find(params[:room_id])
		current_song = Song.where(currently_playing: true, room_id: room.id).first # Finds currently playing song in room
		# Add new user to user list
		$redis.publish("add_user_#{room.id}", {user: current_user.username, id: current_user.id}.to_json)
		# --- end ---
		room.users << current_user
		album_arts = []
		room.songs.order('id').each do |song|
			album_arts << song.album_art
		end
		# --- Sends currently playing song data to new user if a song is playing ---
		if current_song 
			elapsed = ((Time.now - current_song.updated_at) * 1000).to_i
			render :json => {elapsed: elapsed, sc_ident: current_song.sc_ident, title: current_song.title, album_arts: album_arts}
		else
			render :json => false # Does nothing if no song is playing
		end
		# --- end ---
	end

	# When user closes window or leaves the page, removes them from the room ---------------
	def remove_user
		room = Room.find(params[:room_id].to_i)
		user = current_user
		room.users.delete(user) # Deletes user from room when they leave the browser window
		# --- If no users remain in room, all data about the room deletes itself ---
		if room.users.length == 0 
			room.songs.each do |song|
				song.destroy
			end
			room.destroy
		end
		# --- end ---
		# Remove user from user-list
		$redis.publish("remove_user_#{room.id}", {user: current_user.username, id: current_user.id}.to_json) 
		# --- end ---
		render nothing: true
	end

	# Adds song to the room playlist when user adds song -----------------------------------
	def add_song
		response.headers['Content-Type'] = 'text/javascript' # Tells Rails/Redis that content is JavaScript
		room = current_user.room
		new_song_params = song_params
		new_song_params[:added_by] = current_user.username
		# --- If this is the first song, set it as currently playing ---
		if room.songs.length == 0
			new_song_params[:currently_playing] = true
		end
		# --- end ---
		check = Song.where(sc_ident: params[:song][:sc_ident])
		if check.length == 0
			@song = Song.create(new_song_params)
			room.songs << @song
		  $redis.publish("add_song_#{room.id}", {title: @song.title, added_by: @song.added_by, sc_ident: @song.sc_ident, album_art: @song.album_art}.to_json)
		end
    render nothing: true
	end

	# Controls which song is playing (whether queued or the first) -------------------------
	def change_song
		response.headers['Content-Type'] = 'text/javascript' # Tells Rails/Redis that content is JavaScript
		room = current_user.room
		current_sc_ident = params[:current_sc_ident]
		ended_song = Song.where(sc_ident: current_sc_ident, room_id: room.id).first # Finds ended song
		# --- If a song ended, reset currently playing attribute and set it to played ---
		if ended_song
			ended_song.update_attributes(played: true, currently_playing: false, likes: 0, dislikes: 0)
		end
		# --- end ---
		new_song = Song.where(played: false, room_id: room.id).limit(1).first # Finds next song that has not been played
		# --- Sets song as currently playing, or restarts playlist if all songs are played ---
		if new_song
			new_song.update_attributes(currently_playing: true)
			$redis.publish("change_song_#{room.id}", {sc_ident: new_song.sc_ident, title: new_song.title}.to_json)
			render nothing: true
		else
			songs = Song.where(played: true, room_id: room.id)			
			songs.each do |song|
				song.update_attributes(played: false)
			end
			new_song = Song.where(played: false, room_id: room.id).limit(1).first
			new_song.update_attributes(currently_playing: true)
			$redis.publish("change_song_#{room.id}", {sc_ident: new_song.sc_ident, title: new_song.title}.to_json)
			render nothing: true
		end
		# --- end ---
	end

	# Action triggered when someone likes or dislikes a song -------------------------------
	def like_or_dislike
		response.headers['Content-Type'] = 'text/javascript' # Tells Rails/Redis that content is JavaScript
		room = current_user.room
		users = room.users.length
		current_song = Song.where(currently_playing: true).first
		likes = current_song.likes
		dislikes = current_song.dislikes
		# --- Increments either like or dislike to all users depending on which is clicked ---
		if params[:vote] == 'like'
			likes += 1
			current_song.update_attributes(likes: likes)
			$redis.publish("like_or_dislike_#{room.id}", {vote: 'like', sc_ident: current_song.sc_ident, users: users, likes: likes}.to_json)
		elsif params[:vote] == 'dislike'
			dislikes += 1
			current_song.update_attributes(dislikes: dislikes)
			$redis.publish("like_or_dislike_#{room.id}", {vote: 'dislike', sc_ident: current_song.sc_ident, users: users, dislikes: dislikes}.to_json)
		end
		# --- end ---
		render nothing: true
	end

	# Leave a message in the room chatroom -------------------------------------------------
	def add_message
		response.headers['Content-Type'] = 'text/javascript' # Tells Rails/Redis that content is JavaScript
		room = current_user.room
		message = params[:message]
		# -- Add new message to chatroom ---
		$redis.publish("add_message_#{room.id}", {message: message, author: current_user.username}.to_json)
		# --- end ---
		render nothing: true
	end

	# Controls all redis subscriptions to each room ----------------------------------------
  def events
    response.headers['Content-Type'] = 'text/event-stream' # Starts a Redis event stream (thread)
    room_id = params[:room_id]
    sse = Streamer::SSE.new(response.stream) # Opens server sent event stream
    redis ||= Redis.new # If the user doesn't already have a thread open, creates a new redis thread
    # --- Adds all the subscription events for each room --- 
    redis.subscribe(["add_song_#{room_id}", "add_user_#{room_id}", "change_song_#{room_id}", "remove_user_#{room_id}", "like_or_dislike_#{room_id}", "add_message_#{room_id}", "heart"]) do |on|
      on.message do |event, data|
      	if event == "add_song_#{room_id}" # For the add song subscription
      		sse.write(data, event: "add_song_#{room_id}")
      	elsif event == "add_user_#{room_id}" # For the add user subscription
        	sse.write(data, event: "add_user_#{room_id}")
        elsif event == "change_song_#{room_id}" # For the change song subscription
        	sse.write(data, event: "change_song_#{room_id}")
        elsif event == "remove_user_#{room_id}" # For the remove user subscription
        	sse.write(data, event: "remove_user_#{room_id}")
        elsif event == "like_or_dislike_#{room_id}" # For the like/dislike subscription
        	sse.write(data, event: "like_or_dislike_#{room_id}")
        elsif event == "add_message_#{room_id}" # For the add message subscription
        	sse.write(data, event: "add_message_#{room_id}")
        elsif event == "heart" # For the heartbeat subscription
        	sse.write(data, event: "heart")
      	end
      end
    end
    # --- end ---
  rescue IOError
    # Client disconnected
    redis.quit
    sse.close
    response.stream.close
  ensure
  	# When not being used, threads close
    redis.quit
    sse.close
    response.stream.close
  end

  # Rails 4 strong parameters ------------------------------------------------------------
  def song_params
		params.require(:song).permit(:title, :artist, :stream_url, :album_art, :sc_ident, :genre)
	end

end 

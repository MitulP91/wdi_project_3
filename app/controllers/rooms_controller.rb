require 'streamer/sse'

class RoomsController < ApplicationController
	include ActionController::Live

	# before_filter :authenticate_user!

	def index
		@rooms = Room.all
	end

	def test_room
	end


	def initialize_room  # *** Adds a user to a room
		@room = Room.find(params[:id])
		@users = @room.users
	end

	def get_time
		response.headers['Content-Type'] = 'text/javascript'
		room = Room.find(params[:room_id])
		current_song = Song.where(currently_playing: true).first
		$redis.publish('rooms.add_user', {user: current_user.email, room_id: room.id}.to_json)
		room.users << current_user
		elapsed = ((Time.now - current_song.updated_at) * 1000).to_i
		render :json => {elapsed: elapsed, sc_ident: current_song.sc_ident}
	end

	def add_song
		response.headers['Content-Type'] = 'text/javascript'
		room = current_user.room
		new_song_params = song_params

		if room.songs.length == 0
			new_song_params[:currently_playing] = true
		end

		@song = Song.create(new_song_params)
		room.songs << @song
    $redis.publish('rooms.add_song', {title: @song.title, room_id: current_user.room.id}.to_json)
    render nothing: true
	end

	def change_song
		room = current_user.room
		current_sc_ident = params[:current_sc_ident]

		ended_song = Song.where(sc_ident: current_sc_ident, room_id: room.id).first

		if ended_song
			ended_song.update_attributes(played: true, currently_playing: false)
		end

		new_song = Song.where(played: false, room_id: room.id).limit(1).first

		if new_song
			new_song.update_attributes(currently_playing: true)
			render :json => {sc_ident: new_song.sc_ident}
		else
			songs = Song.where(played: true, room_id: room.id)
			
			songs.each do |song|
				song.update_attributes(played: false)
			end

			new_song = Song.where(played: false, room_id: room.id).limit(1).first
			new_song.update_attributes(currently_playing: true)
			render :json => {sc_ident: new_song.sc_ident}
		end
	end

  def events
    response.headers['Content-Type'] = 'text/event-stream'
    sse = Streamer::SSE.new(response.stream)
    redis = Redis.new
    # redis.subscribe(['rooms.add_user', 'rooms.add_song']) do |on|
    redis.subscribe(['rooms.add_song', 'rooms.add_user']) do |on|
      on.message do |event, data|
      	if event == 'rooms.add_song'
      		sse.write(data, event: 'rooms.add_song')
      	elsif event == 'rooms.add_user'
        	sse.write(data, event: 'rooms.add_user')
      	end
      end
    end
    render nothing: true
  rescue IOError
    # Client disconnected
  ensure
    redis.quit
    sse.close
  end

  def song_params
		params.require(:song).permit(:title, :artist, :stream_url, :album_art, :sc_ident, :genre)
	end

end 

class CreateSongs < ActiveRecord::Migration
  def change
    create_table :songs do |t|
      t.string :artist
      t.string :title
      t.string :stream_url      
      t.integer :sc_ident
      t.text :album_art
      t.boolean :played, :default => false 
      t.integer :room_id

      t.timestamps
    end
  end
end


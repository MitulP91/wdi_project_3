$(function(){

  function animateAlbumArt(){
    var $container = $('#album-art-container');
    
    var msnry = $container.data('masonry');

    $container.masonry({
      itemSelector: '.cover-art',
      columnWidth: 125,
      isAnimated: true
    });
  
      var $image = $( "<div id='art-"+sc_ident+"' class='cover-art'><img src="+album_art+">" );
      $container.prepend( $image ).masonry( 'reload' );
    }

});
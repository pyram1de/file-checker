var gulp = require('gulp')
  , nodemon = require('gulp-nodemon');


gulp.task('serve', function () {
  var stream = nodemon({ script: 'app.js', ext: 'html js'})

  stream
      .on('restart', function () {
        console.log('restarted!')
      })
      .on('crash', function() {
        console.error('Application has crashed!\n')
         stream.emit('restart', 10)  // restart the server in 10 seconds
      })
});
/////////////////////////////////////////////////
//      GULP.JS FOR BUILDING PRODUCTION FILES  //
/////////////////////////////////////////////////

// Install npm install gulp -g to execute gulp <task> in console
var gulp = require('gulp'),
gutil = require('gulp-util'),
rename = require('gulp-rename'),
browserify = require('browserify'),
shim = require('browserify-shim'),
hbsfy = require('hbsfy'),
uglify = require('gulp-uglify'),
source = require('vinyl-source-stream'),
streamify = require('gulp-streamify'),
sass = require('gulp-sass');

// });

// gulp.task('build', function(){
//   gulp.src('./src/*.coffee', { read: false })
//   .pipe(browserify({
//     transform: ['coffeeify', browserHandlebars],
//     extentions: ['.coffee'],

//   }))
//   .pipe(rename('parley.js'))
//   .pipe(gulp.dest('.'))
// });

gulp.task('browserify', function(){
  var browserify_stream = browserify('./src/app.coffee')
          .transform('coffeeify')
          .transform(hbsfy)
          .external('jquery')
          .bundle({debug: true})
          .on('error', console.error.bind(console));

  browserify_stream
              .pipe(source('./src/app.coffee'))
              .pipe(rename('parley.js'))
              .pipe(gulp.dest('.'));

});

gulp.task('production-build', function(){

  gulp.src('./src/*.scss')
      .pipe(sass({errLogToConsole: true}))
      .pipe(gulp.dest('.'));

  gulp.src('./parley.js')
      .pipe(uglify())
      .pipe(rename('parley.min.js'))
      .pipe(gulp.dest('.'));

})
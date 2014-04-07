/////////////////////////////////////////////////
//      GULP.JS FOR BUILDING PRODUCTION FILES  //
/////////////////////////////////////////////////

// Install npm install gulp -g to execute gulp <task> in console
var gulp = require('gulp'),
gutil = require('gulp-util'),
rename = require('gulp-rename'),
browserify = require('browserify'),
hbsfy = require('hbsfy'),
uglify = require('gulp-uglify'),
source = require('vinyl-source-stream'),
streamify = require('gulp-streamify');

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

gulp.task('build', function(){
  var browserify_stream = browserify('./src/app.coffee').transform('coffeeify').transform(hbsfy).bundle();

  browserify_stream
              .pipe(source('./src/app.coffee'))
              .pipe(rename('parley.js'))
              .pipe(gulp.dest('.'))
              // .pipe(streamify(uglify())
              // .pipe(rename('parley.min.js'))
              // .pipe(gulp.dest('./parley.min.js'))
});
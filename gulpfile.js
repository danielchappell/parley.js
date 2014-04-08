/////////////////////////////////////////////////
//      GULP.JS FOR BUILDING PRODUCTION FILES  //
/////////////////////////////////////////////////

// Install npm install gulp -g to execute gulp <task> in console
var gulp = require('gulp'),
gutil = require('gulp-util'),
rename = require('gulp-rename'),
browserify = require('browserify'),
shim = require('browserify-shim'),
hbsfy = require('hbsfy').configure({extensions: ["hbs"]}),
uglify = require('gulp-uglify'),
source = require('vinyl-source-stream'),
streamify = require('gulp-streamify'),
sass = require('gulp-sass'),
coffee = require('gulp-coffee');

// BUILD TASK CREATES BROWSERIFIED MODULIZED CONCATED JS FILE AND MINIFIED VERSION.
// ALSO COMPILES SASS FILE.

gulp.task('build', function(){
  var browserify_stream = browserify('./src/app.coffee')
          .transform('coffeeify')
          .transform(hbsfy)
          .external('jquery')
          .external('socket.io-browserify')
          .bundle({debug: true})
          .on('error', console.error.bind(console));

  browserify_stream
              .pipe(source('./src/app.coffee'))
              .pipe(rename('parley.js'))
              .pipe(gulp.dest('.'));

  gulp.src('./src/*.scss')
      .pipe(sass({errLogToConsole: true}))
      .pipe(gulp.dest('.'));

  gulp.src('./server.coffee')
      .pipe(coffee({bare: true}).on('error', gutil.log))
      .pipe(gulp.dest('.'));

  gulp.src('./parley.js')
      .pipe(uglify())
      .pipe(rename('parley.min.js'))
      .pipe(gulp.dest('.'));

});

/////////////////////////////////////////////////
//      GULP.JS FOR BUILDING PRODUCTION FILES  //
/////////////////////////////////////////////////

// Install npm install gulp -g to execute gulp <task> in console
var gulp = require('gulp'),
gutil = require('gulp-util'),
rename = require('gulp-rename');


//compiles and concats CoffeesScript to parley.js and in root directory
// Also adds minified version parley.min.js
var coffee = require('gulp-coffee'),
concatJS = require('gulp-concat'),
uglify = require('gulp-uglify'),
rjs = require('gulp-requirejs')

gulp.task('build', function(){
  gulp.src('./src/javascript/*.coffee')
    .pipe(coffee({bare:true}).on('error', gutil.log))
    .pipe(concatJS('parley.js'))
    .pipe(gulp.dest('.'))
    .pipe(uglify())
    .pipe(rename('parley.min.js'))
    .pipe(gulp.dest('.'));
});
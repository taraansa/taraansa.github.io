var gulp = require('gulp');
var browserSync = require('browser-sync');
var cp          = require('child_process');
var del = require('del');
var changed = require('gulp-changed');
var sourceMaps = require('gulp-sourcemaps');
var order = require('gulp-order');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var notify = require('gulp-notify');
var stylish = require('jshint-stylish');
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var scsslint = require('gulp-scss-lint');
var plumber = require('gulp-plumber');
var base64 = require('gulp-base64');
var runSequence = require('run-sequence');
var size = require('gulp-size');
//var print = require('gulp-print');
var cleancss = require('gulp-clean-css');
//var githubPages = require('gulp-gh-pages');
var indexer = require('./lunr_index_builder.js');
var fs = require('fs');
var incremental = '--incremental';

/**
 * Delete folders and files
 */
gulp.task('delete', function() {
  return del('build/assets');
});

/**
 * Create lunr index
 */
gulp.task('index', function(callback){
  indexer('build/development/json/all_posts.json','build/development/json/all_index.json', callback);
});

/**
 * Build the Jekyll Site
 */
gulp.task('jekyll', function(done) {
  browserSync.notify('Compiling Jekyll');

  return cp.spawn('bundle', ['exec', 'jekyll', 'build', incremental, '--source=app', '--destination=build/development', '--config=_config.yml,_config_dev.yml'], { stdio: 'inherit' })
  .on('close', done);
});

/**
 * It executes jekyll and than all tasks dependent on jekyll
 */
gulp.task('jekyll-tasks',
	gulp.series('jekyll','index'));

gulp.task('jekyll-rebuild', gulp.series('jekyll-tasks', function(callback) {
  browserSync.reload();
  callback();
}));

gulp.task('header:scripts', function() {
   browserSync.notify('Minimising header scripts and generating sourcemaps...');
   //header scripts
   var jsFiles = [
     'app/bower_components/modernizr/modernizr.js'
   ];
   return gulp.src(jsFiles)
     .pipe(order(jsFiles, {"base": "."}))
     .pipe(sourceMaps.init())
     .pipe(concat('inchmeal_head.js'))
     .pipe(sourceMaps.write('.'))
     .pipe(gulp.dest('build/assets/js'))
     //.pipe(notify({ message: 'Header scripts task complete' }));
 });

gulp.task('footer:scripts', function() {
  browserSync.notify('Minimising footer scripts and generating sourcemaps...');
  //footer scripts
  var jsFiles = [
    "app/bower_components/jquery/dist/jquery.js",
    "app/bower_components/fastclick/lib/fastclick.js",
    "app/bower_components/foundation/js/foundation/foundation.js",
    "app/bower_components/foundation/js/foundation/foundation.clearing.js",
    "app/bower_components/foundation/js/foundation/foundation.equalizer.js",
    "app/bower_components/foundation/js/foundation/foundation.topbar.js",
    "app/bower_components/foundation/js/foundation/foundation.accordion.js",
    "app/bower_components/jquery-backstretch/jquery.backstretch.js",
    "app/bower_components/microplugin/src/microplugin.js",
    "app/bower_components/sifter/sifter.js",
    "app/bower_components/selectize/dist/js/selectize.js",
    "app/bower_components/underscore/underscore.js",
    "app/bower_components/backbone/backbone.js",
    "node_modules/lunr/lunr.js",
    "app/_assets/js/*.js"
  ];
  return gulp.src(jsFiles)
    .pipe(order(jsFiles, {"base": "."}))
    .pipe(sourceMaps.init())
    .pipe(concat('inchmeal_all.js'))
    //.pipe(uglify())  //not required for dev
    .pipe(sourceMaps.write('.'))
    .pipe(gulp.dest('build/assets/js'))
});

/**
 * Minimise javascripts, generate sourcemaps
 */
gulp.task('scripts', gulp.parallel('header:scripts', 'footer:scripts'));

/**
 * Check JavaScript sytax with JSHint
 */
gulp.task('jshint', function() {
  return gulp.src('app/_assets/js/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter(stylish));
});

/**
 * Copy images to build folder
 * if changed
 */
gulp.task('images', function() {
  browserSync.notify('Copying images..');

  return gulp.src('app/_assets/img/**/*')
    .pipe(changed('build/assets/img')) // Ignore unchanged files
    .pipe(gulp.dest('build/assets/img'))
    .pipe(size())
});

/**
 * Copy fonts to build folder
 * if changed
 */
gulp.task('fonts', function() {
  browserSync.notify('Copying fonts..');

  return gulp.src('app/_assets/fonts/**/*')
    .pipe(changed('build/assets/fonts')) // Ignore unchanged files
    .pipe(gulp.dest('build/assets/fonts'))
    .pipe(size())
});

/**
 * Generate CSS from SCSS
 * Build sourcemaps
 */
gulp.task('sass', function() {
  browserSync.notify('Compiling Sass');

  var includePaths = [
    'app/bower_components/foundation/scss/foundation/components',
    'app/bower_components/foundation/scss/foundation',
    'app/_assets/scss'
  ];

  return gulp.src('app/_assets/scss/*.scss')
    .pipe(plumber())
    .pipe(sourceMaps.init())
    .pipe(sass({'includePaths': includePaths}))
    .pipe(sourceMaps.write('.'))
    .pipe(gulp.dest('build/assets/css'))
});

/**
 * Lint SCSS files
 * `gem install scss-lint` needed
 */
gulp.task('scsslint', function(callback) {
  callback();
  /*
  browserSync.notify('TODO. Ignoring scsslint.');

  var scssFiles = [
      'app/_assets/scss/*.{sass,scss}',
      '!app/_assets/scss/_selectize-link.scss'
  ]

  return gulp.src(scssFiles)
    .pipe(scsslint({'bundleExec': true}));
  */
});

/**
 * Run all tasks needed for a build in defined order
 */
gulp.task('build', gulp.series('delete',
	gulp.series(
		gulp.parallel('jekyll-tasks', 'sass', 'scripts','images','fonts'),
		gulp.parallel('jshint','scsslint')
	))
);

/**
 * Run the build task and start a server with BrowserSync
 */
gulp.task('browsersync', gulp.series('build', function(callback) {
  var config = {
        server: {
          baseDir: ['build/development', 'build', 'app']
        },
        port: 7777,
        files: [
          'build/assets/css/*.css',
          'build/assets/js/*.js',
          'build/assets/images/**',
        ]
      };
  browserSync(config);
  callback();
}));

/**
 * Start browsersync task and then watch files for changes
 */
gulp.task('watch', gulp.series('browsersync', function(callback) {
  //Watch fonts files
  var fontFiles = 'app/_assets/fonts/**/*';
  gulp.watch(fontFiles, gulp.parallel('fonts'));

  // Watch image files
  var imageFiles = 'app/_assets/img/**/*';
  gulp.watch(imageFiles, gulp.parallel('images'));

  // Watch .scss files
  var sassFiles = 'app/_assets/scss/**/*.{sass,scss}';
  gulp.watch(sassFiles, gulp.series('sass', 'scsslint'));

  // Watch .js files
  var jsFiles = 'app/_assets/js/**/*.js';
  gulp.watch(jsFiles, gulp.series('scripts', 'jshint'));

  // Watch (jekyll files) .html files and posts
  var jekyllFiles = [
      "_config.yml",
      "_config.build.yml",
      "app/_data/**/*.{json,yml,csv}",
      "app/_includes/**/*.{html,xml}",
      "app/_layouts/*.html",
      "app/_locales/*.yml",
      "app/_plugins/*.rb",
      "app/_posts/*.{markdown,md}",
      "app/**/*.{html,markdown,md,yml,json,txt,xml}",
      "app/json/**/*.json",
      "app/*"
  ];
  gulp.watch(jekyllFiles, gulp.parallel('jekyll-rebuild'));
  callback();
}));

gulp.task('default', gulp.series('watch'));
gulp.task('set-inc', function(callback) {
		incremental = ' ';
		callback();
	}
);
gulp.task('reset-inc', function(callback) {
		incremental = '--incremental';
		callback();
	}
);
gulp.task('fullbuild', gulp.series('set-inc', 'watch', 'reset-inc'));

/**************************************************************************
 *
 * Below sections contains code for building for production
 *
 **************************************************************************
*/

/**
 * Delete folders and files
 */
gulp.task('delete:production', function() {
    return del('build/production');
});


/**
 * Build jekyll in production folder
*/
gulp.task('jekyll:production', function(done) {
  browserSync.notify('Compiling Jekyll (Production)');

  return cp.spawn('bundle', ['exec', 'jekyll', 'build', '-q', '--source=app', '--destination=build/production', '--config=_config.yml'], { stdio: 'inherit' })
  .on('close', done);
});

/**
 * Copy js files from dev to production folder and minimise js
 */
gulp.task('js:production', function() {
  browserSync.notify('Copying js files and Uglifying (Production)..');

  return gulp.src('build/assets/js/*.js')
    .pipe(uglify())
    .pipe(gulp.dest('build/production/assets/js'))
    .pipe(size());
});

/**
 * Copy css files from dev to production folder and minimise css
 */
gulp.task('css:production', function() {
  browserSync.notify('Copying css files and Minimising (Production)..');

  return gulp.src('build/assets/css/*.css')
    .pipe(cleancss({"keepSpecialComments": 0}))
    .pipe(gulp.dest('build/production/assets/css'))
    .pipe(size());
});

gulp.task('images:production', function() {
  browserSync.notify('Copying images (Production)..');

  return gulp.src('build/assets/img/**/*.{jpg,jpeg,png,gif}')
    .pipe(gulp.dest('build/production/assets/img'))
    .pipe(size())
});

gulp.task('fonts:production', function() {
  browserSync.notify('Copying fonts (Production)..');

  return gulp.src('build/assets/fonts/**/*')
    .pipe(gulp.dest('build/production/assets/fonts'))
    .pipe(size())
});

gulp.task('index:production', function(callback){
  indexer('build/production/json/all_posts.json','build/production/json/all_index.json', callback);
});

/**
 * It executes jekyll and than all tasks dependent on jekyll
 */
 gulp.task('jekyll-tasks:production', gulp.series('jekyll:production', 'index:production'));

/**
 * Run all tasks needed for a build in defined order
 */
gulp.task('build:production', gulp.series('delete:production',
	gulp.series(
		gulp.parallel('jekyll-tasks:production', 'sass', 'scripts', 'images', 'fonts'),
		gulp.parallel('css:production', 'js:production', 'images:production', 'fonts:production')
	))
);

gulp.task('browsersync:production', gulp.series('build:production', function(callback) {
  var config = {
        server: {
          baseDir: ['build/production']
        },
        port: 8888,
  };
  browserSync(config);
  callback();
}));

/**
 * Run task browsersync:production
 */
gulp.task('publish', gulp.series('browsersync:production'));

/*******************************************************************************
 *
 * Code for deployment to github-pages
 *
 *******************************************************************************
 */
gulp.task('deploy', gulp.series('build:production', function(callback){

   var options = {
     "remoteUrl": "https://github.com/taraansa/taraansa.github.io",
     "branch": "master"
   }
	//TODO FIXME as of now gulp-gh-pages is not causing issues of certain dependencies - gulp-util was deprecated but it is using it.
   //return gulp.src('build/production/**/*', {'dot': true})
   //   .pipe(githubPages(options));
   callback();
 }));

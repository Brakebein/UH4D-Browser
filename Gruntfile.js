module.exports = function (grunt) {

	// load plugins
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-htmlmin');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-filerev');
	grunt.loadNpmTasks('grunt-usemin');
	grunt.loadNpmTasks('grunt-string-replace');

	grunt.loadNpmTasks('grunt-browserify');

	grunt.loadNpmTasks('grunt-version');
	grunt.loadNpmTasks('grunt-wiredep');

	// configuration
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		///// build project

		// clean folders
		clean: {
			tmp: ['.tmp'],
			dist: ['dist/*']
		},

		// copy files from src to dist folder
		copy: {
			dist: {
				files: [
					{expand: true, cwd: 'src/', src: 'index.html', dest: 'dist/'},
					{expand: true, cwd: 'src/', src: 'fonts/**/*', dest: 'dist/'},
					{expand: true, cwd: 'src/', src: 'bower_components/font-awesome/fonts/*', dest: 'dist/fonts/', flatten: true},
					{expand: true, cwd: 'src/', src: 'img/**/*.{png,jpg,svg,gif}', dest: 'dist/'}
				]
			}
		},

		// copy html partials without comments
		htmlmin: {
			dist: {
				options: {
					removeComments: true,
					collapseWhitespace: true,
					conservativeCollapse: true
				},
				files: [
					{expand: true, cwd: 'src/', src: 'app/**/*.html', dest: 'dist/'},
					{expand: true, cwd: 'src/', src: 'components/**/*.html', dest: 'dist/'},
					{expand: true, cwd: 'src/', src: 'partials/**/*.html', dest: 'dist/'}
				]
			}
		},

		// identify build blocks and prepare minification
		useminPrepare: {
			options: {
				root: 'src',
				dest: 'dist',
				flow: {
					html: {
						steps: {
							js: ['concat', 'uglify'],
							css: ['cssmin']
						},
						post: {}
					}
				}
			},
			html: 'src/index.html'
		},

		// cssmin: {
		// 	options: {
		// 		root: 'src'
		// 	}
		// },

		// static asset revisioning through file content hash
		filerev: {
			options: {
				algorithm: 'md5',
				length: 8
			},
			dist: {
				src: [
					'dist/app/**/*.html',
					'dist/components/**/*.html',
					'dist/partials/**/*.html',
					'dist/script/**/*.js',
					'dist/style/**/*.css',
					'dist/img/**/*.{png,jpg,svg,gif}'
				]
			}
		},

		// replace references
		usemin: {
			html: ['dist/**/*.html'],
			css: 'dist/style/*.css',
			js: 'dist/script/*.js',
			options: {
				assetsDirs: ['dist'],
				patterns: {
					html: [
						[/src="([^:'"]+)"/img, 'src replacement in html files'],
						[/ng-include="'([^:'"]+)'"/img, 'ng-include replacement in html files'],
						[/template-url="([^:'"]+)"/img, 'template-url replacement in html files']
					],
					js: [
						[/(?:templateUrl|contentTemplate):[\s]*['"]([^:'"]+\.html)['"]/img, 'Partials replacement in js files'],
						[/\.load\(['"]([^:'"]+)['"][,)]/img, 'TextureLoader image url']
					],
					css: [
						[/url\((?:\.\.\/)*((?!\.\.\/)[^:'"?#()]+)(?:[?#][^:'"?()]+)?\)/img, 'Url replacement in css files']
					]
				}
			}
		},

		// correct css url references
		'string-replace': {
			dist: {
				files: {
					'dist/': 'dist/style/*.css'
				},
				options: {
					replacements: [{
						pattern: /url\((?:\.\.\/)*((?!\.\.\/)[^:'"()]+)\)/ig,
						replacement: 'url(../$1)'
					}]
				}
			}
		},


		///// misc

		// convert CommonJS file to browser compatible js file
		browserify: {
			exports: {
				src: 'src/lib/exports.js',
				dest: 'src/lib/browserify.js'
			}
		},

		// update versions
		version: {
			js: {
				options: {
					prefix: '@version\\s'
				},
				src: ['src/app/app.js']
			},
			html: {
				options: {
					prefix: '>\\s*UH4D-Browser\\s+v'
				},
				src: ['src/app/header/header.tpl.html']
			},
			packages: {
				src: ['package.json', 'bower.json']
			}
		},

		// wire bower dependencies to index.html
		wiredep: {
			target: {
				src: ['src/index.html']
			}
		}
	});


	// tasks
	grunt.registerTask('default', ['wiredep']);

	grunt.registerTask('build', [
		'clean:dist',
		'copy:dist',
		'htmlmin:dist',
		'useminPrepare',
		'concat:generated',
		'cssmin:generated',
		'uglify:generated',
		'filerev',
		'usemin',
		'string-replace:dist',
		'clean:tmp'
	]);

};

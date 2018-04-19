module.exports = function (grunt) {

	// load plugins
	grunt.loadNpmTasks('grunt-wiredep');

	// configuration
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		wiredep: {
			target: {
				src: ['src/index.html']
			}
		}
	});

	grunt.registerTask('default', ['wiredep']);

};

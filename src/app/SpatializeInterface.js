/**
 * Interface between `imageViewer` and `webglView` directives and `spatializeModalCtrl` to manage interaction across their different scopes.
 * @ngdoc factory
 * @name SpatializeInterface
 * @module dokuvisApp
 */
angular.module('uh4dApp').factory('SpatializeInterface',
	function () {

		var si = {};

		/**
		 * Object to bind functions (to call them from outside)
		 * @ngdoc property
		 * @name SpatializeInterface#callFunc
		 * @type {Object}
		 */
		si.callFunc = {};

		/**
		 * Array of 2D markers
		 * @ngdoc property
		 * @name SpatializeInterface#markers2D
		 * @type {Array}
		 */
		si.markers2D = [];
		/**
		 * Array of 3D markers
		 * @ngdoc property
		 * @name SpatializeInterface#markers3D
		 * @type {Array}
		 */
		si.markers3D = [];

		/**
		 * Image width of current image
		 * @ngdoc property
		 * @name SpatializeInterface#imageWidth
		 * @type {number}
		 */
		si.imageWidth = 0;
		/**
		 * Image height of current image
		 * @ngdoc property
		 * @name SpatializeInterface#imageHeight
		 * @type {number}
		 */
		si.imageHeight = 0;

		/**
		 * Prepare the 2D and 3D coordinates for DLT computation.
		 * @ngdoc method
		 * @name SpatializeInterface#getDLTInputs
		 * @returns {string|undefined} Coordinates as formatted string or `undefined`, if `markers3D` and `markers2D` don't have the same length
		 */
		si.getDLTInputs = function () {
			if(si.markers2D.length !== si.markers3D.length) {
				console.warn('Missing markers!');
				console.log(si.markers2D, si.markers3D);
				return;
			}

			// var output = [si.imageWidth, si.imageHeight, "\n"].join(' ');
			var output = '';

			for(var i=0, l=si.markers2D.length; i<l; i++) {
				output += [i+1, si.markers3D[i].x, si.markers3D[i].y, si.markers3D[i].z, si.markers2D[i].x * 1000, si.markers2D[i].y * 1000, "\n"].join(' ');
			}

			console.log(output);
			return output;
		};

		return si;

	});

angular.module('uh4d.images', [
	'ngResource'
])

.factory('Image', ['$resource',
	function ($resource) {

		return $resource('api/image/:id', {
			id: '@id'
		}, {
			query: {
				url: 'api/search',
				method: 'GET',
				isArray: true
			},
			spatialize: {
				method: 'PUT',
				url: 'api/image/:id/spatial'
			}
		});

	}
])

.component('imageList', {
	templateUrl: 'components/uh4d.images/imageList.tpl.html',
	controller: ['$scope', '$state', 'Image', 'Utilities', 'viewportCache', function ($scope, $state, Image, Utilities, viewportCache) {

		var ctrl = this;

		ctrl.itemsPerPage = 20;

		this.$onInit = function () {
			console.log('imageList init');
			ctrl.listMode = 'list';
			ctrl.page = 0;
			//queryImages();
		};

		function queryImages() {
			Image.query().$promise
				.then(function (results) {
					ctrl.images = results;
					console.log(results);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.query', reason);
				});
		}

		$scope.$on('imageQuerySuccess', function (event, values) {
			ctrl.images = values;
			ctrl.currentPage = 1;
		});

		ctrl.openImage = function (id) {
			$state.go('.image', {imageId: id});
		};

		ctrl.setListMode = function (mode) {
			switch (mode) {
				case 'list':
				case 'cards':
					ctrl.listMode = mode;
					break;
			}
		};

		ctrl.focusImage = function (event, spatial) {
			event.stopPropagation();
			if (!spatial) return;

			var entry = viewportCache.spatialImages.getByName(spatial.id);
			console.log(entry);
			if (entry)
				entry.focus();
		}

	}]
})
	
.component('imageModal', {
	templateUrl: 'components/uh4d.images/imageModal.tpl.html',
	controller: ['$rootScope', '$state', '$timeout', 'Image', 'Utilities', function ($rootScope, $state, $timeout, Image, Utilities) {

		var $ctrl = this;

		$ctrl.$onInit = function () {
			$timeout(function () {
				getImage($state.params.imageId);
			}, 0, false);
		};

		function getImage(id) {
			if (!id) return;
			Image.get({ id: id }).$promise
				.then(function (value) {
					console.log(value);
					$ctrl.image = value;
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.get', reason);
				});
		}

		$ctrl.startSpatialize = function () {
			$state.go('^');
			spatializeManualStart($ctrl.image);
		};

		function spatializeManualStart(image) {
			$rootScope.$broadcast('spatializeManualStart', image);
		}

		$ctrl.close = function () {
			$state.go('^');
		};

	}]
})

.component('compareModal', {
	templateUrl: 'components/uh4d.images/compareModal.tpl.html',
	controller: ['$q', '$state', '$timeout', 'Image', 'Utilities', function ($q, $state, $timeout, Image, Utilities) {

		var $ctrl = this;

		$ctrl.$onInit = function () {
			$timeout(function () {
				getImage($state.params.imageId1).then(function (value) {
					$ctrl.image1 = value;
				});
				getImage($state.params.imageId2).then(function (value) {
					$ctrl.image2 = value;
				});
			}, 0, false);
		};

		function getImage(id) {
			var defer = $q.defer();

			Image.get({ id: id }).$promise
				.then(function (value) {
					defer.resolve(value);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.get', reason);
					defer.resolve(null);
				});

			return defer.promise;
		}

		$ctrl.close = function () {
			$state.go('^');
		};

	}]
});

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

			ctrl.pages = [];
			ctrl.pages.push({active: true, value: 0});
			for (var i = 1, l = Math.ceil(values.length / 20); i < l; i++) {
				ctrl.pages.push({active: false, value: i});
			}
			ctrl.setPage(0);
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

		ctrl.setPage = function (value) {
			if (value === 'prev') value = ctrl.page - 1;
			else if (value === 'next') value = ctrl.page + 1;

			ctrl.pages[ctrl.page].active = false;
			ctrl.page = value;
			ctrl.pages[ctrl.page].active = true;
			ctrl.limit = ctrl.page < 3 ? 4 : 5;
			ctrl.skip = Math.max(Math.min(ctrl.page - 2, ctrl.pages.length - 6), 1);
			if (ctrl.page > ctrl.pages.length - 4) {
				ctrl.limit -= 1;
				ctrl.skip += 1;
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

.controller('imageModalCtrl', ['$scope', '$rootScope', '$state', '$uiRouterGlobals', 'Image', 'Utilities',
	function ($scope, $rootScope, $state, $uiRouterGlobals, Image, Utilities) {

		$scope.image = null;

		console.log($uiRouterGlobals.params);

		function getImage(id) {
			Image.get({ id: id }).$promise
				.then(function (value) {
					console.log(value);
					$scope.image = value;
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.get', reason);
				});
		}

		$scope.$watch(function () {
			return $uiRouterGlobals.params.imageId;
		}, function (value) {
			if (value)
				getImage(value);
		});

		$scope.startSpatialize = function () {
			$state.go('^');
			spatializeManualStart($scope.image);
		};

		function spatializeManualStart(image) {
			$rootScope.$broadcast('spatializeManualStart', image);
		}

		$scope.close = function () {
			$state.go('^');
		};
	}
]);

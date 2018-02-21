angular.module('uh4dApp')
.component('search', {
	
	templateUrl: 'app/search/search.tpl.html',
	
	controller: ['$rootScope', '$state', '$uiRouterGlobals', 'Image', 'DigitalObject', 'Utilities', function ($rootScope, $state, $uiRouterGlobals, Image, DigitalObject, Utilities) {

		var ctrl = this;

		ctrl.$onInit = function () {
			// recover search
			if ($state.params.query) {
				//ctrl.searchTerm = $state.params.query;
				performSearch($state.params.query);
			}
			else {
				//ctrl.searchTerm = '';
				performSearch('');
			}
		};

		// ctrl.onSearchTermEnter = function (event) {
		// 	if (event.keyCode === 13) // Enter
		// 		ctrl.performSearch();
		// };

		function performSearch(term) {
			// $state.go($state.$current, { query: ctrl.searchTerm });

			Image.query({ query: term }).$promise
				.then(function (values) {
					console.log(values);
					imageQuerySuccess(values);
					updateSpatialImages(values);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.query() in search component', reason);
				});
		}

		$rootScope.$on('updateSearchTerm', function (event, term) {
			console.log('updateSearchTerm', term);
			performSearch(term);
		});

		ctrl.loadModel = function () {
			DigitalObject.query().$promise
				.then(function (values) {
					console.log(values);
					$rootScope.showModelLoadPanel = false;
					modelQuerySuccess(values);
				})
				.catch(function (reason) {
					Utilities.throwApiException('DigitalObject.query', reason);
				});
		};

		function imageQuerySuccess(values) {
			$rootScope.$broadcast('imageQuerySuccess', values);
		}

		function modelQuerySuccess(values, keepScene) {
			$rootScope.$broadcast('modelQuerySuccess', values, keepScene === true);
		}

		function spatialImageLoad(values) {
			$rootScope.$broadcast('spatialImageLoad', values, true);
		}

		$rootScope.$on('spatializeManualSuccess', function () {
			ctrl.performSearch();
		});

		function updateSpatialImages(values) {
			var spatials = [];
			values.forEach(function (v) {
				if (v.spatial)
					spatials.push(v);
			});
			spatialImageLoad(spatials);
		}

	}]
	
});

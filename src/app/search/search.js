angular.module('uh4dApp')
.component('search', {
	
	templateUrl: 'app/search/search.tpl.html',
	
	controller: ['$scope', '$rootScope', '$state', '$uiRouterGlobals', 'Image', 'DigitalObject', 'Utilities', function ($scope, $rootScope, $state, $uiRouterGlobals, Image, DigitalObject, Utilities) {

		var ctrl = this;

		console.log('search component', $scope);

		function performSearch(term) {
			// $state.go($state.$current, { query: ctrl.searchTerm });

			Image.query({
				query: term || $state.params.query,
				filterObjIncl: $state.params.filterObjIncl,
				filterObjExcl: $state.params.filterObjExcl
			}).$promise
				.then(function (values) {
					console.log(values);
					imageQuerySuccess(values);
					updateSpatialImages(values);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.query() in search component', reason);
				});
		}

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

		$scope.$on('searchUpdate', function () {
			performSearch();
		});

		function updateSpatialImages(values) {
			var spatials = [];
			values.forEach(function (v) {
				if (v.spatial)
					spatials.push(v);
			});
			spatialImageLoad(spatials);
		}

		// populate params filter arrays
		$scope.$on('filterByObject', function (event, entry, mode) {
			console.log('filterByObject event', entry, mode);

			var includes = [].concat($state.params.filterObjIncl);
			var excludes = [].concat($state.params.filterObjExcl);

			var somethingChanged = false;

			switch (mode) {
				case 'include':
					if (includes.indexOf(entry.name) === -1) {
						includes.push(entry.name);
						somethingChanged = true;
					}
					break;
				case 'exclude':
					if (excludes.indexOf(entry.name) === -1) {
						excludes.push(entry.name);
						somethingChanged = true;
					}
					break;
				default:
					var index = includes.indexOf(entry.name);
					if (index !== -1) {
						includes.splice(index, 1);
						somethingChanged = true;
					}
					index = excludes.indexOf(entry.name);
					if (index !== -1) {
						excludes.splice(index, 1);
						somethingChanged = true;
					}
			}

			if (somethingChanged)
				$state.go('root.search', { filterObjIncl: includes, filterObjExcl: excludes });

		});

		// watch for state/url params change and perform search
		$scope.$watchGroup([
			function () { return $state.params.query; },
			function () { return $state.params.filterObjIncl.length; },
			function () { return $state.params.filterObjExcl.length; }
		], function () {
			performSearch();
		});


	}]
	
});

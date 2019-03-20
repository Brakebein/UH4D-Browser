angular.module('uh4dApp')
.component('search', {
	
	templateUrl: 'app/search/search.tpl.html',
	
	controller: ['$scope', '$rootScope', '$state', '$uiRouterGlobals', '$timeout', 'Image', 'DigitalObject', 'Utilities', function ($scope, $rootScope, $state, $uiRouterGlobals, $timeout, Image, DigitalObject, Utilities) {

		var ctrl = this;

		console.log('search component', $scope);

		function performSearch(term) {
			Image.query({
				query: term || $state.params.query,
				from: $state.params.from,
				to: $state.params.to,
				undated: $state.params.undated,
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

		// ctrl.loadModel = function () {
		// 	DigitalObject.query().$promise
		// 		.then(function (values) {
		// 			console.log(values);
		// 			$rootScope.showModelLoadPanel = false;
		// 			modelQuerySuccess(values);
		// 		})
		// 		.catch(function (reason) {
		// 			Utilities.throwApiException('DigitalObject.query', reason);
		// 		});
		// };

		function queryObjects() {
			DigitalObject.query({
				modelDate: $state.params.modelDate
			}).$promise
				.then(function (results) {
					console.log(results);
					$rootScope.showModelLoadPanel = false;
					modelQuerySuccess(results);
				})
				.catch(function (reason) {
					Utilities.throwApiException('DigitalObject.query', reason);
				});
		}

		function imageQuerySuccess(values) {
			$rootScope.$broadcast('imageQuerySuccess', values);
		}

		function modelQuerySuccess(values, keepScene) {
			$rootScope.$broadcast('modelQuerySuccess', values, keepScene === true);
		}

		function spatialImageLoadStart(values) {
			$rootScope.$broadcast('spatialImageLoadStart', values);
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
			spatialImageLoadStart(spatials);
		}

		$scope.$on('timeSliderReady', function (event, from, to, modelDate, undated) {
			$state.go('root.search', { from: from, to: to, modelDate: modelDate, undated: undated });
			$timeout(setWatchers, 0, true);
		});

		$scope.$on('filterByDate', function (event, from, to, modelDate, undated) {
			$state.go('root.search', { from: from, to: to, modelDate: modelDate, undated: undated });
		});

		// populate params filter arrays
		$scope.$on('filterByObject', function (event, entry, mode) {
			console.log('filterByObject event', entry, mode);

			var includes = [].concat($state.params.filterObjIncl);
			var excludes = [].concat($state.params.filterObjExcl);

			var somethingChanged = false;

			// TODO: uniform id/name
			var id = entry instanceof DV3D.ObjectEntry ? entry.name : entry.id;

			switch (mode) {
				case 'include':
					if (includes.indexOf(id) === -1) {
						includes.push(id);
						somethingChanged = true;
					}
					break;
				case 'exclude':
					if (excludes.indexOf(id) === -1) {
						excludes.push(id);
						somethingChanged = true;
					}
					break;
				default:
					var index = includes.indexOf(id);
					if (index !== -1) {
						includes.splice(index, 1);
						somethingChanged = true;
					}
					index = excludes.indexOf(id);
					if (index !== -1) {
						excludes.splice(index, 1);
						somethingChanged = true;
					}
			}

			if (somethingChanged)
				$state.go('root.search', { filterObjIncl: includes, filterObjExcl: excludes });

		});

		function setWatchers() {
			// watch for state/url params change and perform image search
			$scope.$watchGroup([
				function () { return $state.params.query; },
				function () { return $state.params.from; },
				function () { return $state.params.to; },
				function () { return $state.params.undated; },
				function () { return $state.params.filterObjIncl.length; },
				function () { return $state.params.filterObjExcl.length; }
			], function () {
				performSearch();
			});

			// watch for state/url params change and query objects
			$scope.$watchGroup([
				function () { return $state.params.modelDate }
			], function () {
				queryObjects();
			});
		}

	}]
	
});

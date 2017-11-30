angular.module('dokuvis.viewport')

.directive('viewportObjectTree', ['viewportCache',
	function (viewportCache) {

		return {
			templateUrl: 'components/dokuvis.viewport/viewportObjectTree.tpl.html',
			restrict: 'E',
			link: function (scope) {

				scope.objects = viewportCache.objects;
				scope.layers = viewportCache.objects.layers;
				scope.hierarchy = viewportCache.objects.hierarchy;

				scope.showLayers = false;
				scope.showHierarchy = true;

				scope.switchTo = function (type) {
					switch (type) {
						case 'layers':
							scope.showLayers = true;
							scope.showHierarchy = false;
							break;
						default:
							scope.showLayers = false;
							scope.showHierarchy = true;
					}
				};

			}
		};

	}
])

.directive('viewportPlanList', ['viewportCache',
	function (viewportCache) {

		return {
			templateUrl: 'components/dokuvis.viewport/viewportPlanList.tpl.html',
			restrict: 'E',
			link: function (scope) {

				scope.plans = viewportCache.plans;

			}
		};

	}
])

.directive('viewportImageList', ['viewportCache',
	function (viewportCache) {

		return {
			templateUrl: 'components/dokuvis.viewport/viewportImageList.tpl.html',
			restrict: 'E',
			link: function (scope) {

				scope.images = viewportCache.spatialImages;

			}
		};

	}
]);

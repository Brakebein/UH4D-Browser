angular.module('uh4dApp')
.component('search', {
	
	templateUrl: 'app/search/search.tpl.html',
	
	controller: ['$rootScope', '$state', '$uiRouterGlobals', 'Image', 'DigitalObject', 'Utilities', function ($rootScope, $state, $uiRouterGlobals, Image, DigitalObject, Utilities) {

		var ctrl = this;

		ctrl.$onInit = function () {
			// recover search
			if ($uiRouterGlobals.params.query) {
				ctrl.searchTerm = $uiRouterGlobals.params.query;
				ctrl.performSearch();
				ctrl.showLoadPanel = true;
			}
			else {
				ctrl.searchTerm = '';
			}
		};

		ctrl.onSearchTermEnter = function (event) {
			if (event.keyCode === 13) // Enter
				ctrl.performSearch();
		};

		ctrl.performSearch = function () {
			$state.go($state.$current, { query: ctrl.searchTerm });

			Image.query({ query: ctrl.searchTerm }).$promise
				.then(function (values) {
					console.log(values);
					imageQuerySuccess(values);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.query', reason);
				});
		};

		ctrl.loadModel = function () {
			DigitalObject.query().$promise
				.then(function (values) {
					console.log(values);
					ctrl.showLoadPanel = false;
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

	}]
	
});

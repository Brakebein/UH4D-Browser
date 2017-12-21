angular.module('uh4dApp')
.component('search', {
	
	templateUrl: 'app/search/search.tpl.html',
	
	controller: ['$rootScope', 'Image', 'Utilities', function ($rootScope, Image, Utilities) {

		var ctrl = this;

		ctrl.searchTerm = '';

		ctrl.onSearchTermEnter = function (event) {
			if (event.keyCode === 13) // Enter
				ctrl.performSearch();
		};

		ctrl.performSearch = function () {
			var termConcat = ctrl.searchTerm.split(/\s+/).join('+');

			Image.query({ query: termConcat }).$promise
				.then(function (values) {
					console.log(values);
					imageQuerySuccess(values);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.query', reason);
				});
		};

		function imageQuerySuccess(values) {
			$rootScope.$broadcast('imageQuerySuccess', values);
		}

	}]
	
});

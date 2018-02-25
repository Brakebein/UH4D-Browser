angular.module('uh4dApp')
.component('header', {

	templateUrl: 'app/header/header.tpl.html',
	controller: ['$rootScope', '$state', function ($rootScope, $state) {

		var $ctrl = this;

		$ctrl.$onInit = function () {
			// recover search
			// if ($state.params.query) {
			// 	$ctrl.searchTerm = $state.params.query;
			// }
			// else {
			// 	$ctrl.searchTerm = '';
			// }
		};


		$ctrl.submitSearch = function () {
			$state.go('root.search', { query: $ctrl.searchTerm });
			// updateSearchTerm($ctrl.searchTerm);
		};

		function updateSearchTerm(term) {
			$rootScope.$broadcast('updateSearchTerm', term);
		}

		$rootScope.$watch(function () {
			return $state.params.query;
		}, function (newVal) {
			$ctrl.searchTerm = newVal;
			updateSearchTerm($ctrl.searchTerm);
		});

	}]

});

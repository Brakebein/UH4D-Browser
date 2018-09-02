angular.module('uh4dApp')
.component('header', {

	templateUrl: 'app/header/header.tpl.html',
	controller: ['$scope', '$state', function ($scope, $state) {

		var $ctrl = this;

		// search bar enter/submit
		$ctrl.submitSearch = function () {
			$state.go('root.search', { query: $ctrl.searchTerm });
		};

		// watch for query param changes and update search bar
		$scope.$watch(function () {
			return $state.params.query;
		}, function (newVal) {
			$ctrl.searchTerm = newVal;
		});

	}]

});

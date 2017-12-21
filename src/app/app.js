angular.module('uh4dApp', [
	'ui.router',
	'ngAnimate',
	'ngResource',
	'ng-clamp',

	'dokuvis.viewport',
	'dokuvis.utils',

	'uh4d.images'
])

.config(['$stateProvider', '$urlRouterProvider',
	function ($stateProvider, $urlRouterProvider) {

		$urlRouterProvider.otherwise('/');

		$stateProvider
			.state({
				name: 'root',
				views: {
					root: {
						template: '<ui-view></ui-view>'
					},
					header: 'header',
					footer: {
						templateUrl: 'partials/footer.html'
					}
				}
			})
			.state({
				name: 'root.home',
				url: '/',
				templateUrl: 'partials/home.html'
			})
			.state({
				name: 'root.search',
				url: '/search',
				component: 'search'
			});

	}
])

.run(['$state',
	function ($state) {

		//$state.go('root.home');

	}
]);

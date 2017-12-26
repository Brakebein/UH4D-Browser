angular.module('uh4dApp', [
	'ui.router',
	'ngAnimate',
	'ngResource',
	'mgcrea.ngStrap',
	'ng-clamp',

	'dokuvis.viewport',
	'dokuvis.utils',
	'dokuvis.imageViewer',

	'uh4d.images',
	'uh4d.models'
])

.config(['$stateProvider', '$urlRouterProvider', '$modalProvider',
	function ($stateProvider, $urlRouterProvider, $modalProvider) {

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
				url: '/search?query&page',
				component: 'search',
				params: {
					query: {
						type: 'query',
						dynamic: true,
						value: null
					},
					page: {
						type: 'query',
						dynamic: true,
						value: null
					}
				}
			})
			.state({
				name: 'root.search.image',
				url: '/image/:imageId',
				redirectTo: function (trans) {
					if (!trans.params().imageId)
						return 'root.search';
				},
				resolve: {
					imageModalInstance: ['$modal', function ($modal) {
						return $modal({
							templateUrl: 'partials/modals/_modalLarge.tpl.html',
							contentTemplate: 'components/uh4d.images/imageModal.tpl.html',
							controller: 'imageModalCtrl',
							show: false
						})
					}]
				},
				onEnter: ['imageModalInstance', function (imageModalInstance) {
					imageModalInstance.$promise.then(imageModalInstance.show);
				}],
				onExit: ['imageModalInstance', function (imageModalInstance) {
					imageModalInstance.hide();
					imageModalInstance.destroy();
				}],
				params: {
					imageId: {
						dynamic: true
					}
				}
			});

		// defaults
		angular.extend($modalProvider.defaults, {
			backdrop: 'static',
			keyboard: false
		});

	}
])

.run(['$rootScope', '$state',
	function ($rootScope, $state) {

		$rootScope.showModelLoadPanel = true;
		//$state.go('root.home');

	}
]);

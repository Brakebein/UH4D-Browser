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
				params: {
					imageId: {
						dynamic: true
					}
				},
				resolve: {
					imageModalInstance: ['$modal', function ($modal) {
						return $modal({
							templateUrl: 'partials/modals/_modalLarge.tpl.html',
							contentTemplate: 'components/uh4d.images/imageModal.tpl.html',
							controller: 'imageModalCtrl',
							show: false
						});
					}]
				},
				onEnter: ['imageModalInstance', function (imageModalInstance) {
					imageModalInstance.$promise.then(imageModalInstance.show);
				}],
				onExit: ['imageModalInstance', function (imageModalInstance) {
					imageModalInstance.hide();
					imageModalInstance.destroy();
				}]
			})
			.state({
				name: 'root.search.compare',
				url: '/compare?imageId1&imageId2',
				redirectTo: function (trans) {
					if (!trans.params().imageId1 || !trans.params().imageId2)
						return 'root.search';
				},
				resolve: {
					compareModalInstance: ['$modal', function ($modal) {
						return $modal({
							templateUrl: 'partials/modals/_modalXlarge.tpl.html',
							contentTemplate: 'components/uh4d.images/compareModal.tpl.html',
							controller: 'compareModalCtrl',
							show: false
						});
					}]
				},
				onEnter: ['compareModalInstance', function (compareModalInstance) {
					compareModalInstance.$promise.then(compareModalInstance.show);
				}],
				onExit: ['compareModalInstance', function (compareModalInstance) {
					compareModalInstance.hide();
					compareModalInstance.destroy();
				}]
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

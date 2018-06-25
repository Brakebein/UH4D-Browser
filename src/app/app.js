angular.module('uh4dApp', [
	'ui.router',
	'ngAnimate',
	'ngResource',
	'mgcrea.ngStrap',
	'ui.bootstrap',
	'ng-clamp',

	'dokuvis.viewport',
	'dokuvis.utils',
	'dokuvis.imageViewer',

	'uh4d.images',
	'uh4d.models'
])

.config(['$stateProvider', '$urlRouterProvider', '$modalProvider', '$uibModalProvider',
	function ($stateProvider, $urlRouterProvider, $modalProvider, $uibModalProvider) {

		$urlRouterProvider.otherwise('/');

		$stateProvider
			.state({
				name: 'root',
				url: '?edit',
				abstract: true,
				views: {
					root: {
						template: '<ui-view></ui-view>'
					},
					header: 'header'
					// footer: {
					// 	templateUrl: 'partials/footer.html'
					// }
				},
				params: {
					edit: {
						type: 'query',
						value: null
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
				url: '/search?query&page&filterObjIncl&filterObjExcl',
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
					},
					filterObjIncl: {
						type: 'query',
						dynamic: true,
						array: true,
						value: []
					},
					filterObjExcl: {
						type: 'query',
						dynamic: true,
						array: true,
						value: []
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
					imageModalInstance: ['$uibModal', function ($uibModal) {
						return $uibModal.open({
							component: 'imageModal',
							size: 'large'
						});
					}]
				},
				onExit: ['imageModalInstance', function (imageModalInstance) {
					imageModalInstance.close();
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
					compareModalInstance: ['$uibModal', function ($uibModal) {
						return $uibModal.open({
							component: 'compareModal',
							size: 'xlarge'
						});
						// return $modal({
						// 	templateUrl: 'partials/modals/_modalXlarge.tpl.html',
						// 	contentTemplate: 'components/uh4d.images/compareModal.tpl.html',
						// 	controller: 'compareModalCtrl',
						// 	show: false
						// });
					}]
				},
				// onEnter: ['compareModalInstance', function (compareModalInstance) {
				// 	compareModalInstance.$promise.then(compareModalInstance.show);
				// }],
				onExit: ['compareModalInstance', function (compareModalInstance) {
					compareModalInstance.close();
					// compareModalInstance.hide();
					// compareModalInstance.destroy();
				}]
			})
			.state({
				name: 'root.help',
				url: '/help',
				templateUrl: 'partials/help.html'
			});

		// defaults
		angular.extend($modalProvider.defaults, {
			backdrop: 'static',
			keyboard: false
		});

		angular.extend($uibModalProvider.options, {
			animation: false,
			backdrop: 'static',
			keyboard: false
		});

	}
])

.run(['$rootScope', '$state',
	function ($rootScope, $state) {

		$rootScope.showModelLoadPanel = true;
		//$state.go('root.home');

		$rootScope.$watch(function () {
			return $state.params.edit;
		}, function (newVal) {
			$rootScope.editableMode = newVal === 'true';
		});

	}
]);

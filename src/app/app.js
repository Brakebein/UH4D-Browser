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
	'uh4d.models',
	'uh4d.timeSlider'
])

.config(['$stateProvider', '$urlRouterProvider', '$modalProvider', '$uibModalProvider', '$selectProvider',
	function ($stateProvider, $urlRouterProvider, $modalProvider, $uibModalProvider, $selectProvider) {

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
				url: '/search?query&from&to&modelDate&undated&page&filterObjIncl&filterObjExcl',
				component: 'search',
				params: {
					query: {
						type: 'query',
						dynamic: true,
						value: null
					},
					from: {
						type: 'query',
						dynamic: true,
						value: null
					},
					to: {
						type: 'query',
						dynamic: true,
						value: null
					},
					modelDate: {
						type: 'query',
						dynamic: true,
						value: null
					},
					undated: {
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
					imageModalInstance: ['$state', '$uibModal', function ($state, $uibModal) {
						var modal =  $uibModal.open({
							component: 'imageModal',
							size: 'large'
						});
						modal.result.then(null, function () {
							$state.go('^');
						});
						return modal;
					}]
				},
				onExit: ['imageModalInstance', function (imageModalInstance) {
					imageModalInstance.close();
				}]
			})
			.state({
				name: 'root.search.object',
				url: '/object/:objectId',
				resolve: {
					objectModalInstance: ['$state', '$uibModal', function ($state, $uibModal) {
						var modal = $uibModal.open({
							component: 'objectModal',
							size: 'large'
						});
						modal.result.then(null, function () {
							$state.go('^');
						});
						return modal;
					}]
				},
				onExit: ['objectModalInstance', function (objectModalInstance) {
					objectModalInstance.close();
				}]
			})
			.state({
				name: 'root.search.uploadModel',
				url: '/uploadModel',
				resolve: {
					uploadModalInstance: ['$state', '$uibModal', function ($state, $uibModal) {
						var modal = $uibModal.open({
							component: 'uploadModal'
						});
						modal.result.then(null, function () {
							$state.go('^');
						});
						return modal;
					}]
				},
				onExit: ['uploadModalInstance', 'ModelUploader', function (uploadModalInstance, ModelUploader) {
					uploadModalInstance.close();
					ModelUploader.clearQueue();
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
					compareModalInstance: ['$state', '$uibModal', function ($state, $uibModal) {
						var modal = $uibModal.open({
							component: 'compareModal',
							size: 'xlarge'
						});
						modal.result.then(null, function () {
							$state.go('^');
						});
						return modal;
					}]
				},
				onExit: ['compareModalInstance', function (compareModalInstance) {
					compareModalInstance.close();
				}]
			})
			.state({
				name: 'root.help',
				url: '/help',
				templateUrl: 'partials/help.html'
			})
			.state({
				name: 'root.legalnotice',
				url: '/legalnotice',
				templateUrl: 'partials/legalnotice.html'
			});

		// defaults
		angular.extend($modalProvider.defaults, {
			backdrop: 'static',
			keyboard: false
		});

		angular.extend($uibModalProvider.options, {
			animation: false,
			backdrop: true, //'static',
			keyboard: false
		});

		angular.extend($selectProvider.defaults, {
			templateUrl: 'partials/overrides/bs.select.tpl.html'
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

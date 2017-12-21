angular.module('uh4d.images', [
	'ngResource',
])

.factory('Image', ['$resource',
	function ($resource) {

		return $resource('api/search');

	}
])

.component('imageList', {
	templateUrl: 'components/uh4d.images/imageList.tpl.html',
	require: 'E',
	controller: ['$scope', 'Image', 'Utilities', function ($scope, Image, Utilities) {

		var ctrl = this;

		ctrl.listMode = 'list';

		this.$onInit = function () {
			console.log('imageList init');
			queryImages();
		};

		function queryImages() {
			Image.query().$promise
				.then(function (results) {
					ctrl.images = results;
					console.log(results);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.query', reason);
				});
		}

		ctrl.setListMode = function (mode) {
			switch (mode) {
				case 'list':
				case 'cards':
					ctrl.listMode = mode;
					break;
			}
		};

		$scope.$on('imageQuerySuccess', function (event, values) {
			ctrl.images = values;
		});

	}]
});

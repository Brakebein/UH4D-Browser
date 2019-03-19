angular.module('uh4d.models', [
	'ngResource',
	'angularFileUpload'
])

.factory('DigitalObject', ['$resource',
	function ($resource) {

		return $resource('api/model/:id', {
			id: '@id'
		}, {
			query: {
				method: 'GET',
				isArray: true,
				transformResponse: function (json) {
					var data = angular.fromJson(json);
					data.forEach(function (value) {
						value.object.node = value;
						// TODO: node is no resource object
					});
					return data;
				}
			},
			update: {
				method: 'PUT'
			},
			save: {
				url: 'api/model',
				method: 'POST'
			},
			deleteTemp: {
				url: 'api/model/temp',
				method: 'POST',
				hasBody: true
			}
		});

	}
])

.factory('ModelUploader', ['$rootScope', 'FileUploader', 'Utilities', function ($rootScope, FileUploader, Utilities) {

	var uploader = new FileUploader({
		url: 'api/model/upload',
		alias: 'uploadModelFile',
		queueLimit: 1
	});

	// FILTER
	var modelType = ['dae'];

	uploader.filters.push({
		name: 'modelFilter',
		fn: function (item) {
			var type = item.name.slice(item.name.lastIndexOf('.') + 1).toLowerCase();
			return modelType.indexOf(type) !== -1;
		}
	});

	// CALLBACKS
	uploader.onWhenAddingFileFailed = function (item, filter, options) {
		// if there is already another file in the queue, replace it by the new file
		if (filter.name === 'queueLimit') {
			uploader.clearQueue();
			uploader.addToQueue(item);
		}
		else if (filter.name === 'modelFilter') {
			Utilities.dangerAlert('Model type not supported! Use Collada (.dae).');
		}
		else {
			console.warn('onWhenAddingFileFailed', item, filter, options);
			Utilities.dangerAlert('Unkown error. See console.');
		}
	};

	uploader.onSuccessItem = function (item, response) {
		if (!(response instanceof Object) || response.error) {
			Utilities.throwApiException('#model/upload', response);
		}
		else {
			console.log(item, response);
			response.object.node = response;
			$rootScope.$broadcast('modelUploadSuccess', response);
		}
	};

	uploader.onErrorItem = function (item, response, status, headers) {
		console.error('onErrorItem', item, response, status, headers);
		Utilities.throwApiException('#model/upload', response);
	};

	return uploader;

}])

.component('uploadModal', {
	templateUrl: 'components/uh4d.models/uploadModal.tpl.html',
	controller: ['$scope', '$state', 'ModelUploader', 'Utilities', function ($scope, $state, ModelUploader, Utilities) {

		var $ctrl = this;

		$ctrl.$onInit = function () {

			$ctrl.uploader = ModelUploader;

		};

		// watch first queue item and assign to scope
		$scope.$watch(function () {
			return ModelUploader.queue[0];
		}, function (item) {
			if (item)
				$ctrl.fileItem = item;
			else
				$ctrl.fileItem = null;
		});

		$ctrl.upload = function () {
			if (!$ctrl.fileItem) return;

			$ctrl.fileItem.upload();
		};

		$scope.$on('modelUploadSuccess', function () {
			$ctrl.close();
		});

		$ctrl.close = function () {
			$state.go('^');
		};

	}]
})

.component('objectModal', {
	templateUrl: 'components/uh4d.models/objectModal.tpl.html',
	controller: ['$rootScope', '$state', '$timeout', 'DigitalObject', 'viewportCache', 'moment', 'Utilities', function ($rootScope, $state, $timeout, DigitalObject, viewportCache, moment, Utilities) {

		var $ctrl = this;

		$ctrl.$onInit = function () {
			$timeout(function () {
				getObject();
			}, 0, false);
		};

		function getObject() {
			DigitalObject.get({ id: $state.params.objectId }).$promise
				.then(function (result) {
					console.log(result);
					$ctrl.object = result;
				})
				.catch(function (reason) {
					Utilities.throwApiException('DigitalObject.get', reason);
				});
		}

		$ctrl.updateObject = function (prop, data) {
			if ($ctrl.object[prop] === data) return false;

			var oldValue = $ctrl.object[prop];

			// if (prop === 'tags')
			// 	$ctrl.image.tags = data.map(function (t) {
			// 		return t.text;
			// 	});
			switch (prop) {
				case 'from':
					var fromDate = moment(data, 'YYYY-MM-DD');
					if (!fromDate.isValid()) {
						Utilities.dangerAlert('Wrong date format! Use "YYYY-MM-DD".');
						return false;
					}
					if ($ctrl.object.date.to && moment($ctrl.object.date.to).isBefore(fromDate)) {
						Utilities.dangerAlert('Date must be before destruction date!');
						return false;
					}
					$ctrl.object.date.from = fromDate.format('YYYY-MM-DD');
					break;
				case 'to':
					var toDate = moment(data, 'YYYY-MM-DD');
					if (!toDate.isValid()) {
						Utilities.dangerAlert('Wrong date format! Use "YYYY-MM-DD".');
						return false;
					}
					if ($ctrl.object.date.from && moment($ctrl.object.date.from).isAfter(toDate)) {
						Utilities.dangerAlert('Date must be after erection date!');
						return false;
					}
					$ctrl.object.date.to = toDate.format('YYYY-MM-DD');
					break;
				default:
					$ctrl.object[prop] = data;
			}

			return $ctrl.object.$update({ prop: prop })
				.then(function (result) {
					console.log(result);
					// objectUpdate(result);
					// update entry
					var entry = viewportCache.objects.getByName(result.object.id);
					if (entry) {
						entry.label = result.name;
						entry.node = result;
						entry.object.userData.node = result;
					}
					return false;
				})
				.catch(function (reason) {
					Utilities.throwApiException('DigitalObject.update', reason);
					$ctrl.object[prop] = oldValue;
					return false;
				});
		};

		// function objectUpdate(item) {
		// 	$rootScope.$broadcast('objectUpdate', item);
		// }

		$ctrl.close = function () {
			$state.go('^');
		};

	}]
});

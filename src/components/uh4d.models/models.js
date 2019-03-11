angular.module('uh4d.models', [
	'ngResource'
])

.factory('DigitalObject', ['$resource',
	function ($resource) {

		function createHierarchy(data) {
			for (var i = 0; i < data.length; i++) {
				var obj = data[i];
				if (!obj.children) obj.children = [];
				if (obj.parent) {
					var parent = getObjectById(data, obj.parent);
					if (parent) {
						if (!parent.children) parent.children = [];
						parent.children.push(new resource(obj));
						data.splice(i, 1);
						i--;
					}
				}
			}
			return data;
		}

		function getObjectById(data, id) {
			for (var i = 0; i < data.length; i++) {
				if (data[i].id === id) return data[i];
				if (data[i].children) {
					var obj = getObjectById(data[i].children, id);
					if (obj !== undefined) return obj;
				}
			}
			return undefined;
		}

		var resource = $resource('api/model/:id', {
			id: '@id'
		}, {
			query: {
				method: 'GET',
				isArray: true,
				transformResponse: function (json) {
					return createHierarchy(angular.fromJson(json));
				}
			},
			update: {
				method: 'PUT'
			}
		});

		return resource;

	}
])

.component('objectModal', {
	templateUrl: 'components/uh4d.models/objectModal.tpl.html',
	controller: ['$state', '$timeout', 'DigitalObject', 'Utilities', function ($state, $timeout, DigitalObject, Utilities) {

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
			if (prop === 'date')
				$ctrl.image[prop] = { value: data };
			else
				$ctrl.object[prop] = data;

			return $ctrl.object.$update({ prop: prop })
				.then(function (result) {
					console.log(result);
					// imageUpdate($ctrl.image);
					return false;
				})
				.catch(function (reason) {
					Utilities.throwApiException('DigitalObject.update', reason);
					$ctrl.object[prop] = oldValue;
					return false;
				});
		};

		$ctrl.close = function () {
			$state.go('^');
		};

	}]
});

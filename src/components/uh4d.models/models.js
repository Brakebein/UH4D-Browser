angular.module('uh4d.models', [
	'ngResource'
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
			}
		});

	}
])

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
					if ($ctrl.object.date.to && moment($ctrl.object.date.to).isAfter(fromDate)) {
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
					if ($ctrl.object.date.from && moment($ctrl.object.date.from).isBefore(toDate)) {
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

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
			}
		});

		return resource;

	}
]);

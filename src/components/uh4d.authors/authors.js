angular.module('uh4d.authors', [
	'ngResource'
])

.factory('Author', ['$resource',
	function ($resource) {

		return $resource('api/author/:id', {
			id: '@id'
		});

	}
]);

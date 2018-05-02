angular.module('uh4d.actors', [
	'ngResource'
])

.factory('Person', ['$resource',
	function ($resource) {

		return $resource('api/person/:id', {
			id: '@id'
		});

	}
])

.factory('LegalBody', ['$resource',
	function ($resource) {

		return $resource('api/legalbody/:id', {
			id: '@id'
		});

	}
]);

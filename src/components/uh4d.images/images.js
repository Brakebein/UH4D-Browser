angular.module('uh4d.images', [
	'ngResource',
	'xeditable',
	'ngTagsInput',
	'uh4d.actors'
])

.run(['editableOptions', 'editableThemes', function (editableOptions, editableThemes) {
	editableOptions.theme = 'bs3';
	editableThemes.bs3.buttonsClass = 'btn-sm';
	editableThemes.bs3.inputClass = 'form-control-sm';
	editableThemes.bs3.submitTpl = '<button type="submit" class="btn btn-primary"><span class="fa fa-check"></span></button>';
	editableThemes.bs3.cancelTpl = '<button type="button" class="btn btn-default" ng-click="$form.$cancel()"><span class="fa fa-times"></span></button>';
}])

.factory('Image', ['$resource',
	function ($resource) {

		return $resource('api/image/:id', {
			id: '@id'
		}, {
			query: {
				url: 'api/search',
				method: 'GET',
				isArray: true
			},
			update: {
				method: 'PUT'
			},
			spatialize: {
				method: 'PUT',
				url: 'api/image/:id/spatial'
			},
			checkFileUpdate: {
				url: 'api/image/:id/file/check',
				method: 'GET'
			},
			updateFile: {
				url: 'api/image/:id/file/update',
				method: 'GET'
			},
			setLinksToObjects: {
				url: 'api/image/:id/link',
				method: 'PUT'
			}
		});

	}
])

.component('imageList', {
	templateUrl: 'components/uh4d.images/imageList.tpl.html',
	controller: ['$scope', '$state', 'Image', 'Utilities', 'viewportCache', '$debounce', 'ImageCollection', function ($scope, $state, Image, Utilities, viewportCache, $debounce, ImageCollection) {

		var ctrl = this;



		ctrl.itemsPerPage = 20;

		ctrl.$onInit = function () {
			console.log('imageList init');
			ctrl.listTab = 'selection';
			ctrl.listMode = 'list';
			ctrl.listOrderBy = {
				prop: 'title',
				desc: false
			};
			ctrl.page = 0;
			ctrl.selection = [];

			ImageCollection.promise.then(function (collection) {
				ctrl.collection = collection;
				updateImageMeta();
			});
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

		$scope.$on('imageQuerySuccess', function (event, values) {
			ctrl.images = values;
			ctrl.currentPage = 1;
			updateImageMeta();
		});

		var setSelection = $debounce(function (selected) {
			ctrl.selection = selected
				.filter(function (item) {
					return item instanceof DV3D.ImageEntry;
				})
				.map(function (item) {
					return item.source;
				});
		}, 200);

		$scope.$on('viewportSelectionChange', function (event, selected) {
			console.log(selected);
			setSelection(selected);
			// ctrl.selection = selected.filter(function (item) {
			// 	return item instanceof DV3D.ImageEntry;
			// });
		});

		$scope.$on('ImageCollectionUpdate', function () {
			updateImageMeta();
		});

		$scope.$on('imageUpdate', function (event, imgNew) {
			var img = ctrl.images.find(function (value) {
				return value.id === imgNew.id;
			});
			// extend by new values
			if (img)
				angular.extend(img, imgNew);
		});
		
		function updateImageMeta() {
			if (!ctrl.images || !ctrl.images.length) return;

			ctrl.images.forEach(function (item) {
				if (ImageCollection.get(item.id))
					item.inCollection = true;
				else if (item.inCollection === true)
					item.inCollection = false;
			});
		}

		ctrl.openImage = function (id) {
			$state.go('.image', {imageId: id});
		};

		ctrl.openCompareModal = function (event, img1, img2) {
			event.stopPropagation();
			$state.go('.compare', {
				imageId1: img1.id,
				imageId2: img2.id
			});
		};

		ctrl.setListTab = function (tab) {
			if (tab === ctrl.listTab)
				ctrl.listTab = '';
			else
				ctrl.listTab = tab;
		};

		ctrl.setListMode = function (mode) {
			switch (mode) {
				case 'list':
				case 'cards':
					ctrl.listMode = mode;
					break;
			}
		};

		ctrl.addToCollection = function (event, item) {
			event.stopPropagation();

			ImageCollection.add(item);
			ctrl.collection = ImageCollection.get();
		};

		ctrl.removeFromCollection = function (event, item) {
			event.stopPropagation();

			ImageCollection.remove(item);
			ctrl.collection = ImageCollection.get();
		};

		ctrl.focusImage = function (event, spatial) {
			event.stopPropagation();
			if (!spatial) return;

			var entry = viewportCache.spatialImages.getByName(spatial.id);
			console.log(entry);
			if (entry)
				entry.focus();
		}

	}]
})
	
.component('imageModal', {
	templateUrl: 'components/uh4d.images/imageModal.tpl.html',
	controller: ['$rootScope', '$state', '$timeout', 'Image', 'Utilities', 'ImageCollection', 'Person', 'LegalBody', '$http', function ($rootScope, $state, $timeout, Image, Utilities, ImageCollection, Person, LegalBody, $http) {

		var $ctrl = this;

		$ctrl.$onInit = function () {
			$timeout(function () {
				getImage($state.params.imageId);
			}, 0, false);
		};

		function getImage(id) {
			if (!id) return;
			Image.get({ id: id }).$promise
				.then(function (value) {
					console.log(value);
					$ctrl.image = value;
					$ctrl.tags = value.tags.map(function (t) {
						return { text: t };
					});

					if (ImageCollection.get(id))
						$ctrl.image.inCollection = true;

					if ($rootScope.editableMode)
						checkFileUpdate(id);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.get', reason);
				});
		}

		function checkFileUpdate(id) {
			Image.checkFileUpdate({ id: id }).$promise
				.then(function (value) {
					if (!value.message)
						$ctrl.fileUpdate = value;
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.checkFileUpdate', reason);
				});
		}

		$ctrl.addToCollection = function () {
			ImageCollection.add($ctrl.image);
		};

		$ctrl.removeFromCollection = function () {
			ImageCollection.remove($ctrl.image);
		};

		$ctrl.startSpatialize = function () {
			$state.go('^');
			spatializeManualStart($ctrl.image);
		};

		function spatializeManualStart(image) {
			$rootScope.$broadcast('spatializeManualStart', image);
		}

		function imageUpdate(image) {
			$rootScope.$broadcast('imageUpdate', image);
		}

		$ctrl.updateImage = function (prop, data) {
			if ($ctrl.image[prop] === data) return false;

			var oldValue = $ctrl.image[prop];

			if (prop === 'tags')
				$ctrl.image.tags = data.map(function (t) {
					return t.text;
				});
			else
				$ctrl.image[prop] = data;

			return $ctrl.image.$update({ prop: prop })
				.then(function (result) {
					console.log(result);
					imageUpdate($ctrl.image);
					return false;
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.update', reason);
					$ctrl.image[prop] = oldValue;
					return false;
				});
		};

		$ctrl.updateFile = function () {
			$ctrl.isSaving = true;
			Image.updateFile({ id: $ctrl.image.id }).$promise
				.then(function (result) {
					console.log(result);
					$ctrl.image.file = result;
					$ctrl.fileUpdate = null;
					imageUpdate($ctrl.image);
					$ctrl.isSaving = false;
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.updateFile', reason);
					$ctrl.isSaving = false;
				});
		};

		$ctrl.queryPersons = function (value) {
			return Person.query({ name: value }).$promise
				.then(function (results) {
					return results.map(function (item) {
						return item.name;
					});
				})
				.catch(function (reason) {
					Utilities.throwApiException('Person.query', reason);
				});
		};

		$ctrl.queryLegalBodies = function (value) {
			return LegalBody.query({ name: value }).$promise
				.then(function (results) {
					return results.map(function (item) {
						return item.name;
					});
				})
				.catch(function (reason) {
					Utilities.throwApiException('LegalBody.query', reason);
				});
		};

		$ctrl.queryTags = function (value) {
			return $http.get('api/tag?query=' + value)
				.then(function (results) {
					console.log(results);
					return results.data.map(function (t) {
						return t.tag;
					});
				})
				.catch(function (reason) {
					Utilities.throwApiException('$http.get api/tag', reason);
				})
		};

		$ctrl.close = function () {
			$state.go('^');
		};

	}]
})

.component('compareModal', {
	templateUrl: 'components/uh4d.images/compareModal.tpl.html',
	controller: ['$q', '$state', '$timeout', 'Image', 'Utilities', function ($q, $state, $timeout, Image, Utilities) {

		var $ctrl = this;

		$ctrl.$onInit = function () {
			$timeout(function () {
				getImage($state.params.imageId1).then(function (value) {
					$ctrl.image1 = value;
				});
				getImage($state.params.imageId2).then(function (value) {
					$ctrl.image2 = value;
				});
			}, 0, false);
		};

		function getImage(id) {
			var defer = $q.defer();

			Image.get({ id: id }).$promise
				.then(function (value) {
					defer.resolve(value);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.get', reason);
					defer.resolve(null);
				});

			return defer.promise;
		}

		$ctrl.close = function () {
			$state.go('^');
		};

	}]
})

.service('ImageCollection', ['$window', '$rootScope', '$q', 'Image', 'Utilities',
	function ($window, $rootScope, $q, Image, Utilities) {

		var scope = this;

		var collection = [],
			collectionIds = $window.localStorage['collectionIds'] ? angular.fromJson($window.localStorage['collectionIds']) : [];


		// initialize
		var promises = [],
			defer = $q.defer();

		collectionIds.forEach(function (id) {
			promises.push(Image.get({ id: id }).$promise);
		});

		$q.all(promises).then(function (values) {
			values.forEach(function (item) {
				if (item) {
					item.inCollection = true;
					collection.push(item);
				}
			});
			defer.resolve(collection);
		});

		this.promise = defer.promise;


		// methods

		this.get = function (id) {
			if (id)
				return collection.find(function (element) {
					return element.id === id;
				});
			else
				return collection;
		};

		this.add = function (item) {
			if (!item) return;
			var id = typeof item === 'string' ? item : item.id;

			if (collectionIds.indexOf(id) !== -1) return;
			collectionIds.push(id);

			$window.localStorage['collectionIds'] = angular.toJson(collectionIds);

			if (typeof item === 'string') {
				getImage(id).then(function (value) {
					if (value) {
						value.inCollection = true;
						collection.push(value);
					}
				});
			}
			else {
				item.inCollection = true;
				collection.push(item);
			}

			ImageCollectionUpdate();
		};

		this.remove = function (item) {
			if (!item) return;
			var id = typeof item === 'string' ? item : item.id;

			var index = collectionIds.indexOf(id);
			if (index === -1) return;
			collectionIds.splice(index, 1);

			$window.localStorage['collectionIds'] = angular.toJson(collectionIds);

			index = collection.findIndex(function (element) {
				return element.id === id;
			});

			if (index !== -1)
				collection.splice(index, 1);

			if (item.inCollection)
				item.inCollection = false;

			ImageCollectionUpdate();
		};

		function getImage(id) {
			var defer = $q.defer();

			Image.get({ id: id }).$promise
				.then(function (value) {
					defer.resolve(value);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.get() in ImageCollection', reason);
					defer.resolve();
				});

			return defer.promise;
		}

		function ImageCollectionUpdate() {
			$rootScope.$broadcast('ImageCollectionUpdate', collection);
		}

	}
]);

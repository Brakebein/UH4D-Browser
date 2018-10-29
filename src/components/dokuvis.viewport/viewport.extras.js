angular.module('dokuvis.viewport')

/**
 * Top-left navigation bar.
 * @ngdoc directive
 * @name viewportNavigation
 * @module dokuvis.viewport
 * @requires viewportSettings
 * @restrict E
 */
.component('viewportNavigation', {

	templateUrl: 'components/dokuvis.viewport/viewportNavigation.tpl.html',

	controller: ['$scope', 'viewportSettings', function ($scope, viewportSettings) {

		var $ctrl = this;

		this.$onInit = function () {
			this.navigation = {'default': true, rotate: false, pan: false, zoom: false};
			this.vpSettings = viewportSettings;
		};

		this.focus = function (mode) {
			$scope.$parent.focus(mode);
		};

		function setNavigationMode(mode) {
			$ctrl.navigation.default = false;
			$ctrl.navigation.rotate = false;
			$ctrl.navigation.pan = false;
			$ctrl.navigation.zoom = false;

			if (mode && mode in $ctrl.navigation)
				$ctrl.navigation[mode] = true;
			else
				$ctrl.navigation.default = true;

			$scope.$applyAsync();
		}

		this.setNavigationMode = function (mode) {
			$scope.$emit('viewportNavigationChange', mode);
		};

		// listen on viewportNavigationChange event
		$scope.$on('viewportNavigationChange', function (event, mode) {
			setNavigationMode(mode);
		});

		/**
		 * Event that gets fired, when user set another shading.
		 * @ngdoc event
		 * @name viewportNavigation#viewportShadingChange
		 * @eventType emit on viewportNavigation
		 * @param mode {string} New shading mode
		 * @param lastMode {string} Previous shading mode
		 */
		// function viewportShadingChange(mode, lastMode) {
		// 	$scope.$emit('viewportShadingChange', mode, lastMode);
		// }
		//
		// // listen to viewportShadingChange event
		// $scope.$on('viewportShadingChange', function (event, mode, lastMode) {
		// 	if (event.targetScope === $scope || mode === lastMode) return;
		// 	$ctrl.vpSettings.shading = mode;
		// 	triggerShadingEvent = false;
		// });
		//
		// // watch for shading changes
		// $scope.$watch('vpSettings.shading', function (mode, lastMode) {
		// 	if (triggerShadingEvent)
		// 		viewportShadingChange(mode, lastMode);
		// 	else
		// 		triggerShadingEvent = true;
		// });

		/**
		 * Event that gets fired, when user changed camera mode.
		 * @ngdoc event
		 * @name viewportNavigation#viewportCameraChange
		 * @eventType emit on viewportNavigation
		 * @param mode {string} New camera mode
		 * @param lastMode {string} Previous camera mode
		 */
		// function viewportCameraChange(mode, lastMode) {
		// 	$scope.$emit('viewportCameraChange', mode, lastMode);
		// }
		//
		// // listen to viewportCameraChange event
		// $scope.$on('viewportCameraChange', function (event, mode, lastMode) {
		// 	if (event.targetScope === $scope || mode === lastMode) return;
		// 	$ctrl.vpSettings.camera = mode;
		// 	triggerCameraEvent = false;
		// });
		//
		// // watch for camera changes
		// $scope.$watch('vpSettings.camera', function (mode, lastMode) {
		// 	if (triggerCameraEvent)
		// 		viewportCameraChange(mode, lastMode);
		// 	else
		// 		triggerCameraEvent = true;
		// });

	}]

})

/**
 * World axes for orientation.
 * @ngdoc directive
 * @name viewportAxis
 * @module dokuvis.viewport
 * @requires https://docs.angularjs.org/api/ng/service/$timeout $timeout
 * @restrict E
  */
.directive('viewportAxis', ['$timeout',
	function ($timeout) {

		return {
			restrict: 'E',
			scope: true,
			link: function (scope, element) {

				var renderer, camera, scene, axis;

				$timeout(function () {
					init();
				});
				
				function init() {
					var width = element.width(),
						height = element.height();

					renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
					renderer.setSize(width, height);
					element.append(renderer.domElement);

					camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 1, 100);
					camera.position.set(0, 0, 50);

					axis = new THREE.AxisHelper(50);
					scene = new THREE.Scene();
					scene.add(axis);
					
					render();
				}

				function render() {
					renderer.render(scene, camera);
				}

				// listen to viewportCameraMove event
				scope.$on('viewportCameraMove', function (event, cam) {
					camera.rotation.copy(cam.rotation);
					camera.position.copy(cam.getWorldDirection().negate().setLength(50));
					render();
				});

				// dispose axis
				scope.$on('$destroy', function () {
					axis.geometry.dispose();
					axis.material.dispose();

					renderer.forceContextLoss();
					renderer.dispose();
				});

			}
		};

	}
])

/**
 * Compass for orientation.
 * @ngdoc directive
 * @name viewportCompass
 * @module dokuvis.viewport
 * @requires https://docs.angularjs.org/api/ng/service/$timeout $timeout
 * @restrict E
  */
.component('viewportCompass', {

	template: '<div class="north" title="Orient north" ng-click="$ctrl.faceNorth()">N</div>',

	controller: ['$scope', '$element', '$timeout', function ($scope, $element, $timeout) {

		var renderer, camera, scene, plane, distance;

		$timeout(function () {
			init();
		});

		function init() {
			var width = $element.width(),
				height = $element.height();

			distance = width;

			renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
			renderer.setSize(width, height);
			$element.append(renderer.domElement);

			camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 1, 100);
			camera.position.set(0, 0, distance);

			scene = new THREE.Scene();

			new THREE.TextureLoader().load('img/compass_v01.png', function (texture) {
				texture.anisotropy = 8;

				// instantiate compass plane
				var geo = new THREE.PlaneBufferGeometry(distance - 1, distance - 1);
				geo.rotateX(-Math.PI / 2);
				var mat = new THREE.MeshBasicMaterial({
					map: texture,
					side: THREE.DoubleSide
				});

				plane = new THREE.Mesh(geo, mat);
				scene.add(plane);

				render();
			});
		}

		function render() {
			renderer.render(scene, camera);
		}

		this.faceNorth = function () {
			$scope.$parent.faceNorth();
		};

		// listen to viewportCameraMove event
		$scope.$on('viewportCameraMove', function (event, cam) {
			camera.rotation.copy(cam.rotation);
			camera.position.copy(cam.getWorldDirection().negate().setLength(distance));
			render();
		});

		// dispose axis
		$scope.$on('$destroy', function () {
			plane.geometry.dispose();
			plane.material.dispose();

			renderer.forceContextLoss();
			renderer.dispose();
		});

	}]

})

/**
 * Display of load progress while loading 3D objects.
 * @ngdoc directive
 * @name viewportLoadProgress
 * @module dokuvis.viewport
 * @restrict E
 */
.component('viewportLoadProgress', {

	template: '<div class="loadprogress-bar ng-hide" ng-show="$ctrl.visible" ng-style="{ width: $ctrl.progress + \'%\' }"></div>\n<div class="loadprogress-label ng-hide" ng-show="$ctrl.visible">{{ $ctrl.item }} &ndash; {{ $ctrl.loaded }} / {{ $ctrl.total }}</div>',

	controller: ['$scope', function ($scope) {

		var $ctrl = this;

		this.$onInit = function () {
			this.visible = false;
			this.item = '';
			this.loaded = 0;
			this.total = 0;
			this.progress = 0;
		};

		// listen to viewportLoadProgress event
		$scope.$on('viewportLoadProgress', function (event, item, loaded, total) {
			if (!$ctrl.visible) {
				$ctrl.progress = loaded / total * 100;
				$ctrl.visible = true;
				$scope.$apply();
			}

			$ctrl.item = item;
			$ctrl.loaded = loaded;
			$ctrl.total = total;
			$ctrl.progress = loaded / total * 100;

			if ($ctrl.progress === 100) {
				$ctrl.visible = false;
				$scope.$applyAsync();
			}
		});

	}]

})

.component('viewportSpatializeManual', {

	templateUrl: '/components/dokuvis.viewport/viewportSpatializeManual.tpl.html',

	controller: ['$scope', '$rootScope', 'Utilities', function ($scope, $rootScope, Utilities) {

		var $ctrl = this;

		var source, camera, controls;

		this.$onInit = function () {
			source = this.source = $scope.$parent.source;
			camera = this.camera = $scope.$parent.camera;
			controls = $scope.$parent.controls;

			this.opacity = 50;
			this.moveStep = 0.2;
		};

		this.transformView = function (dir) {
			var up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
			var forward = new THREE.Vector3().subVectors(controls.center, camera.position).normalize();

			var cameraV, centerV;

			switch (dir) {
				case 'up':
					cameraV = new THREE.Vector3(0,$ctrl.moveStep,0);
					centerV = up;
					break;
				case 'down':
					cameraV = new THREE.Vector3(0,-$ctrl.moveStep,0);
					centerV = up.negate();
					break;
				case 'left':
					cameraV = new THREE.Vector3(-$ctrl.moveStep,0,0);
					centerV = up.cross(forward);
					break;
				case 'right':
					cameraV = new THREE.Vector3($ctrl.moveStep,0,0);
					centerV = up.cross(forward).negate();
					break;
				case 'forward':
					cameraV = new THREE.Vector3(0,0,-$ctrl.moveStep);
					break;
				case 'backward':
					cameraV = new THREE.Vector3(0,0,$ctrl.moveStep);
					break;
				case 'tilt-up':
					centerV = new THREE.Vector3(0,$ctrl.moveStep,0);
					break;
				case 'tilt-down':
					centerV = new THREE.Vector3(0,-$ctrl.moveStep,0);
					break;
			}

			if (cameraV)
				camera.translateOnAxis(cameraV, $ctrl.moveStep);
			if (centerV) {
				centerV.setLength($ctrl.moveStep);
				controls.center.add(centerV);
			}

			$scope.$parent.animate();
		};

		this.changeFOV = function () {
			camera.updateProjectionMatrix();
			$scope.$parent.animate();
		};

		this.save = function () {
			if (!source || !camera) return;

			source.spatialize = {
				matrix: camera.matrixWorld.toArray(),
				offset: [0,0],
				ck: 1 / Math.tan((camera.fov / 2) * THREE.Math.DEG2RAD) * 0.5
			};

			source.$spatialize({ method: 'manual' })
				.then(function (result) {
					console.log(result);
					$rootScope.$broadcast('searchUpdate');
				})
				.catch(function (reason) {
					Utilities.throwApiException('#Source.spatialize', reason);
				});
		};

		$scope.$on('spatialImageLoadSuccess' , function () {
			$scope.$parent.linkToObjects(source)
				.then(function () {
					console.log('linkToObjects done');
					$ctrl.close();
				})
				.catch(function (reason) {
					Utilities.throwApiException('#Source.setLinksToObjects', reason);
				});
		});

		this.close = function () {
			$scope.$parent.close();
		};

	}]

})

.directive('viewportSnapshot', ['$rootScope',
	function ($rootScope) {

		return {
			templateUrl: 'components/dokuvis.viewport/viewportSnapshot.html',
			restrict: 'E',
			scope: true,
			link: function (scope, element) {

				scope.mode = 'paint';

				scope.paintOptions = {
					opacity: 1.0,
					color: 'rgba(255,255,0,1.0)',
					backgroundColor: 'rgba(255,255,255,0.0)',
					lineWidth: 3,
					undo: true,
					imageSrc: false,
					width: scope.size.width,
					height: scope.size.height
				};

				scope.setMode = function (mode) {
					scope.mode = mode;
					if (mode === 'pin') {
						scope.startPinning();
					}
					else {
						scope.abortPinning();
					}
				};
				
				scope.$on('snapshotPrepareSave', function () {
					snapshotPainting(element.find('#pwCanvasMain')[0].toDataURL("image/png"));
				});
				
				function snapshotPainting(paintData) {
					$rootScope.$broadcast('snapshotPainting', paintData);
				}

				element.on('$destroy', function () {
					scope.$destroy();
				});

			}
		};

	}
])

.directive('viewportSnapshotView', function () {

	return {
		templateUrl: 'components/dokuvis.viewport/viewportSnapshotView.tpl.html',
		restrict: 'E',
		scope: true,
		link: function (scope, element) {

			scope.screenOpacity = 0;
			scope.paintOpacity = 1;

			element.on('$destroy', function () {
				scope.$destroy();
			});

		}
	};

})

.component('viewportImageControls', {

	templateUrl: 'components/dokuvis.viewport/viewportImageCtrls.tpl.html',

	controller: ['viewportCache', 'viewportSettings', function (viewportCache, viewportSettings) {

		var $ctrl = this;

		this.$onInit = function () {
			this.opacity = viewportSettings.images.opacity * 100;
			this.scale = viewportSettings.images.scale;
		};

		this.setOpacity = function () {
			viewportCache.spatialImages.setOpacity($ctrl.opacity / 100);
			viewportSettings.images.opacity = $ctrl.opacity / 100;
		};

		this.setScale = function () {
			viewportCache.spatialImages.forEach(function (image) {
				image.setScale($ctrl.scale);
			});
			viewportSettings.images.scale = $ctrl.scale;
		};

	}]

})

.component('viewportSelectionDisplay', {

	templateUrl: 'components/dokuvis.viewport/viewportSelectionDisplay.tpl.html',

	controller: ['$scope', '$rootScope', '$state', 'DigitalObject', function ($scope, $rootScope, $state, DigitalObject) {

		var $ctrl = this;

		this.$onInit = function () {
			this.imageList = [];
			this.objectList = [];
			this.inIsolationMode = false;

			this.includesList = [];
			this.excludesList = [];

			$state.params.filterObjIncl.forEach(function (value) {
				DigitalObject.get({ id: value }).$promise
					.then(function (result) {
						console.log(result);
						$ctrl.includesList.push({
							id: result.id,
							name: result.obj.name,
							label: result.obj.name
						});
					});
			});
			$state.params.filterObjExcl.forEach(function (value) {
				DigitalObject.get({ id: value }).$promise
					.then(function (result) {
						$ctrl.excludesList.push({
							id: result.id,
							name: result.obj.name,
							label: result.obj.name
						});
					});
			});
		};

		// listen to viewportSelectionChange event
		$scope.$on('viewportSelectionChange', function (event, selected) {
			$ctrl.imageList = selected.filter(function (item) {
				return item instanceof DV3D.ImageEntry;
			});
			$ctrl.objectList = selected.filter(function (item) {
				return item instanceof DV3D.ObjectEntry;
			});
		});

		this.exitIsolation = function () {
			$scope.$parent.exitIsolation();
		};

		$scope.$on('viewportIsolationEnter', function () {
			$ctrl.inIsolationMode = true;
		});

		$scope.$on('viewportIsolationExit', function () {
			$ctrl.inIsolationMode = false;
		});

		this.removeFilterObject = function (entry) {
			$rootScope.$broadcast('filterByObject', entry, 'remove');
		};

		$scope.$on('filterByObject', function (event, entry, mode) {
			switch (mode) {
				case 'include': $ctrl.includesList.push(entry); break;
				case 'exclude': $ctrl.excludesList.push(entry); break;
				default:
					var index = $ctrl.includesList.findIndex(function (value) {
						return value.name === entry.name;
					});
					if (index !== -1)
						$ctrl.includesList.splice(index, 1);

					index = $ctrl.excludesList.findIndex(function (value) {
						return value.name === entry.name;
					});
					if (index !== -1)
						$ctrl.excludesList.splice(index, 1);
			}
		});

	}]

})
	
.component('viewportContextMenu', {

	templateUrl: 'components/dokuvis.viewport/viewportContextMenu.tpl.html',

	controller: ['$scope', '$element', '$rootScope', '$state', '$timeout', 'ImageCollection', function ($scope, $element, $rootScope, $state, $timeout, ImageCollection) {

		var $ctrl = this;

		this.$onInit = function () {
			this.entry = $scope.$parent.entry;

			this.position = { x: -999, y: -999 };

			$timeout(function () {
				var dialogElement = $element.find('.context-menu-dialog');
				$ctrl.position.x = Math.min($scope.$parent.position.x, $element.width() - dialogElement.width());
				$ctrl.position.y = Math.min($scope.$parent.position.y, $element.height() - dialogElement.height());
			});

			this.isImage = this.entry instanceof DV3D.ImageEntry;
			this.isObject = this.entry instanceof DV3D.ObjectEntry;
			this.isDummyImage = /_dummy$/.test(this.entry.name);

			if (this.isObject) {
				if ($state.params.filterObjIncl.indexOf(this.entry.name) !== -1)
					this.isIncluded = true;
				if ($state.params.filterObjExcl.indexOf(this.entry.name) !== -1)
					this.isExcluded = true;
			}
		};

		this.openDetails = function () {
			$state.go('.image', { imageId: this.entry.source.id });
			$scope.$parent.close();
		};

		this.addToCollection = function () {
			ImageCollection.add(this.entry.source);
			$scope.$parent.close();
		};

		this.removeFromCollection = function () {
			ImageCollection.remove(this.entry.source);
			$scope.$parent.close();
		};

		this.focus = function () {
			this.entry.focus();
			$scope.$parent.close();
		};

		this.filterByObject = function (mode) {
			$rootScope.$broadcast('filterByObject', this.entry, mode);
			$scope.$parent.close();
		};

		this.deleteDummyImage = function() {
			$scope.$parent.deleteDummy(this.entry);
			$scope.$parent.close();
		};

	}]

})

.component('viewportTooltip', {

	templateUrl: 'components/dokuvis.viewport/viewportTooltip.tpl.html',

	controller: ['$scope', '$element', '$timeout', function ($scope, $element, $timeout) {

		var $ctrl = this;

		this.$onInit = function () {
			this.entry = $scope.$parent.entry;

			this.position = { x: -999, y: -999 };

			this.isImage = this.entry instanceof DV3D.ImageEntry;
			this.isObject = this.entry instanceof DV3D.ObjectEntry;

			// position tooltip within the viewport, displace if near edge
			this.tooltipCss = {};

			var dialogElement = $element.find('.tooltip-dialog'),
				imgElement = dialogElement.find('img.tooltip-image');

			imgElement.on('load', function () {
				$ctrl.tooltipCss.image = {
					left: Math.min(0, $element.width() - $scope.$parent.position.x - dialogElement.width()),
					top: Math.min(0, $element.height() - $scope.$parent.position.y - dialogElement.height())
				};
				$scope.$applyAsync();
			});

			$timeout(function () {
				var labelElement = dialogElement.find('[ng-bind]'),
					labelPos = labelElement.position();

				var isAbove = $scope.$parent.position.y + labelPos.top > 0,
					labelOffset = $element.width() - $scope.$parent.position.x - labelElement.outerWidth();

				$ctrl.tooltipCss.label = {
					transform: 'translate(' + Math.min(labelOffset, Math.max(-10, -$scope.$parent.position.x)) + 'px,' + (isAbove ? '-100%' : '0') + ')',
					top: isAbove ? '-20px' : '20px'
				};
				$ctrl.tooltipCss.line = {
					top: isAbove ? '-20px' : '0'
				};

				$ctrl.position = $scope.$parent.position;
			});
		};

	}]

})

.component('viewportAnalysisTools', {

	templateUrl: 'components/dokuvis.viewport/viewportAnalysisTools.tpl.html',

	controller: ['$scope', '$element', '$timeout', '$debounce', function ($scope, $element, $timeout, $debounce) {

		var $ctrl = this;

		this.$onInit = function () {
			$ctrl.analysis = {
				type: 'heatMap',
				visible: false,
				overlay: false,
				radius: 40,
				disWeight: false,
				toggle: function () {
					viewportHeatMapUpdate({typeChange: true, overlayChange: true});
				},
				toggleOverlay: function () {
					viewportHeatMapUpdate({overlayChange: true});
				},
				changeType: function () {
					viewportHeatMapUpdate({typeChange: true, overlayChange: true});
				},
				changeRadius: $debounce(function () {
					viewportHeatMapUpdate({radiusChange: true});
				}, 1000),
				changeSetting: function () {
					viewportHeatMapUpdate({settingsChange: true})
				}
			};
		};

		function viewportHeatMapUpdate(options) {
			$scope.$emit('viewportHeatMapUpdate', angular.extend(options, {
				type: $ctrl.analysis.type,
				visible: $ctrl.analysis.visible,
				overlay: $ctrl.analysis.overlay,
				radius: $ctrl.analysis.radius,
				useWeight: $ctrl.analysis.disWeight ? 'disWeight': 'countWeight'
			}));
		}

		this.linkToObjects = function () {
			$scope.$parent.linkToObjects();
		};

		this.toggleDummyCreationMode = function () {
			$ctrl.dummyCreationMode = $scope.$parent.toggleDummyCreationMode();
		};

		$scope.$on('viewportHeatMapComplete', function (event, config) {
			$ctrl.legend = {
				gradient: config.gradient,
				domain: [config.scale.min, config.scale.max]
			};
		});

	}]

});

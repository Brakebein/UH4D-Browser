angular.module('dokuvis.viewport')

/**
 * Top-left navigation bar.
 * @ngdoc directive
 * @name viewportNavigation
 * @module dokuvis.viewport
 * @requires viewportSettings
 * @restrict E
 */
.directive('viewportNavigation', ['viewportSettings',
	function (viewportSettings) {

		return {
			templateUrl: 'components/dokuvis.viewport/viewportNavigation.tpl.html',
			restrict: 'E',
			link: function (scope) {

				var triggerCameraEvent = true,
					triggerShadingEvent = true;

				scope.navigation = {'default': true, rotate: false, pan: false, zoom: false};

				scope.shadings = viewportSettings.shadings;
				scope.cameras = viewportSettings.cameras;

				scope.vpSettings = viewportSettings;

				scope.focus = function (mode) {
					viewportFocusStart(mode);
				};

				/**
				 * Event that gets fired, when user clicked one of the focus buttons.
				 * @ngdoc event
				 * @name viewportNavigation#viewportFocusStart
				 * @eventType emit on viewportNavigation
				 * @param mode {string} Focus mode, should be `all` or `selected`
				 */
				function viewportFocusStart(mode) {
					scope.$emit('viewportFocusStart', mode);
				}

				function setNavigationMode(mode, triggerEvent) {
					scope.navigation.default = false;
					scope.navigation.rotate = false;
					scope.navigation.pan = false;
					scope.navigation.zoom = false;

					if (mode && mode in scope.navigation)
						scope.navigation[mode] = true;
					else
						scope.navigation.default = true;

					scope.$applyAsync();

					if (triggerEvent !== false)
						viewportNavigationChange(mode);
				}
				scope.setNavigationMode = setNavigationMode;

				/**
				 * Event that gets fired, when user changed navigation mode.
				 * @ngdoc event
				 * @name viewportNavigation#viewportNavigationChange
				 * @eventType emit on viewportNavigation
				 * @param mode {string} New navigation mode
				 */
				function viewportNavigationChange(mode) {
					scope.$emit('viewportNavigationChange', mode);
				}

				// listen on viewportNavigationChange event
				scope.$on('viewportNavigationChange', function (event, mode) {
					if (event.targetScope === scope) return;
					setNavigationMode(mode, false);
				});

				/**
				 * Event that gets fired, when user set another shading.
				 * @ngdoc event
				 * @name viewportNavigation#viewportShadingChange
				 * @eventType emit on viewportNavigation
				 * @param mode {string} New shading mode
				 * @param lastMode {string} Previous shading mode
				 */
				function viewportShadingChange(mode, lastMode) {
					scope.$emit('viewportShadingChange', mode, lastMode);
				}

				// listen to viewportShadingChange event
				scope.$on('viewportShadingChange', function (event, mode, lastMode) {
					if (event.targetScope === scope || mode === lastMode) return;
					scope.vpSettings.shading = mode;
					triggerShadingEvent = false;
				});

				// watch for shading changes
				scope.$watch('vpSettings.shading', function (mode, lastMode) {
					if (triggerShadingEvent)
						viewportShadingChange(mode, lastMode);
					else
						triggerShadingEvent = true;
				});

				/**
				 * Event that gets fired, when user changed camera mode.
				 * @ngdoc event
				 * @name viewportNavigation#viewportCameraChange
				 * @eventType emit on viewportNavigation
				 * @param mode {string} New camera mode
				 * @param lastMode {string} Previous camera mode
				 */
				function viewportCameraChange(mode, lastMode) {
					scope.$emit('viewportCameraChange', mode, lastMode);
				}

				// listen to viewportCameraChange event
				scope.$on('viewportCameraChange', function (event, mode, lastMode) {
					if (event.targetScope === scope || mode === lastMode) return;
					scope.vpSettings.camera = mode;
					triggerCameraEvent = false;
				});

				// watch for camera changes
				scope.$watch('vpSettings.camera', function (mode, lastMode) {
					if (triggerCameraEvent)
						viewportCameraChange(mode, lastMode);
					else
						triggerCameraEvent = true;
				});

			}
		};

	}
])

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
				var cleanOnCameraMove = scope.$on('viewportCameraMove', function (event, cam) {
					camera.rotation.copy(cam.rotation);
					camera.position.copy(cam.getWorldDirection().negate().setLength(50));
					render();
				});

				// dispose axis
				scope.$on('$destroy', function () {
					axis.geometry.dispose();
					axis.material.dispose();

					// unregister events
					cleanOnCameraMove();
				});

			}
		};

	}
])

/**
 * Display of load progress while loading 3D objects.
 * @ngdoc directive
 * @name viewportLoadProgress
 * @module dokuvis.viewport
 * @restrict E
 */
.directive('viewportLoadprogress', function () {

	return {
		template: '<div class="loadprogress-bar ng-hide" ng-show="visible" ng-style="{ width: progress + \'%\' }"></div>\n<div class="loadprogress-label ng-hide" ng-show="visible">{{ item }} &ndash; {{ loaded }} / {{ total }}</div>',
		restrict: 'E',
		link: function (scope) {

			scope.visible = false;
			scope.item = '';
			scope.loaded = 0;
			scope.total = 0;
			scope.progress = 0;

			// listen to viewportLoadProgress event
			var cleanOnLoadProgress = scope.$on('viewportLoadProgress', function (event, item, loaded, total) {
				if (!scope.visible) {
					scope.progress = loaded / total * 100;
					scope.visible = true;
					scope.$apply();
				}

				scope.item = item;
				scope.loaded = loaded;
				scope.total = total;
				scope.progress = loaded / total * 100;

				if (scope.progress === 100) {
					scope.visible = false;
				}
			});

			scope.$on('$destroy', function () {
				// unregister events
				cleanOnLoadProgress();
			});

		}
	};

})

.directive('viewportSpatializeManual', ['$rootScope', 'Utilities',
	function ($rootScope, Utilities) {

		return {
			templateUrl: '/components/dokuvis.viewport/viewportSpatializeManual.tpl.html',
			restrict: 'E',
			link: function (scope, element) {

				scope.opacity = 50;
				scope.moveStep = 0.2;

				scope.transformView = function (dir) {
					var up = new THREE.Vector3(0,1,0).applyQuaternion(scope.camera.quaternion);
					var forward = new THREE.Vector3().subVectors(scope.controls.center, scope.camera.position).normalize();

					var cameraV, centerV;

					switch (dir) {
						case 'up':
							cameraV = new THREE.Vector3(0,scope.moveStep,0);
							centerV = up;
							break;
						case 'down':
							cameraV = new THREE.Vector3(0,-scope.moveStep,0);
							centerV = up.negate();
							break;
						case 'left':
							cameraV = new THREE.Vector3(-scope.moveStep,0,0);
							centerV = up.cross(forward);
							break;
						case 'right':
							cameraV = new THREE.Vector3(scope.moveStep,0,0);
							centerV = up.cross(forward).negate();
							break;
						case 'forward':
							cameraV = new THREE.Vector3(0,0,-scope.moveStep);
							break;
						case 'backward':
							cameraV = new THREE.Vector3(0,0,scope.moveStep);
							break;
						case 'tilt-up':
							centerV = new THREE.Vector3(0,scope.moveStep,0);
							break;
						case 'tilt-down':
							centerV = new THREE.Vector3(0,-scope.moveStep,0);
							break;
					}

					if (cameraV)
						scope.camera.translateOnAxis(cameraV, scope.moveStep);
					if (centerV) {
						centerV.setLength(scope.moveStep);
						scope.controls.center.add(centerV);
					}

					scope.animate();
				};

				scope.changeFOV = function () {
					scope.camera.updateProjectionMatrix();
					scope.animate();
				};

				scope.save = function () {
					if (!scope.source || !scope.camera) return;

					scope.source.spatialize = {
						matrix: scope.camera.matrixWorld.toArray(),
						offset: [0,0],
						ck: 1 / Math.tan((scope.camera.fov / 2) * THREE.Math.DEG2RAD) * 0.5
					};

					scope.source.$spatialize({ method: 'manual' })
						.then(function (result) {
							console.log(result);
							spatializeManualSuccess(result);
							scope.closeSpatializeManual();
						})
						.catch(function (reason) {
							Utilities.throwApiException('#Source.spatialize', reason);
						});
				};

				function spatializeManualSuccess(src) {
					$rootScope.$broadcast('spatializeManualSuccess', src);
				}

				element.on('$destroy', function () {
					scope.$destroy();
				});

			}
		};

	}
])

.directive('viewportSnapshot', ['$rootScope',
	function ($rootScope) {

		return {
			templateUrl: 'components/dokuvis.viewport/viewportSnapshot.html',
			restrict: 'E',
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
		link: function (scope, element) {

			scope.screenOpacity = 0;
			scope.paintOpacity = 1;

			element.on('$destroy', function () {
				scope.$destroy();
			});

		}
	};

})

.directive('viewportImageControls', ['viewportCache', 'viewportSettings', function (viewportCache, viewportSettings) {

	return {
		templateUrl: 'components/dokuvis.viewport/viewportImageCtrls.tpl.html',
		restrict: 'E',
		link: function (scope) {
			scope.opacity = viewportSettings.images.opacity * 100;
			scope.scale = viewportSettings.images.scale;

			scope.setOpacity = function () {
				viewportCache.spatialImages.setOpacity(scope.opacity / 100);
				viewportSettings.images.opacity = scope.opacity / 100;
			};

			scope.setScale = function () {
				viewportCache.spatialImages.forEach(function (image) {
					image.setScale(scope.scale);
				});
				viewportSettings.images.scale = scope.scale;
			};

		}
	};

}])

.directive('viewportSelectionDisplay', ['$state', function ($state) {

	return {
		templateUrl: 'components/dokuvis.viewport/viewportSelectionDisplay.tpl.html',
		restrict: 'E',
		link: function (scope) {

			scope.imageList = [];
			scope.objectList = [];
			scope.inIsolationMode = false;

			// listen to viewportSelectionChange event
			scope.$on('viewportSelectionChange', function (event, selected) {
				scope.imageList = selected.filter(function (item) {
					return item instanceof DV3D.ImageEntry;
				});
				scope.objectList = selected.filter(function (item) {
					return item instanceof DV3D.ObjectEntry;
				});
			});

			scope.$on('viewportIsolationEnter', function () {
				scope.inIsolationMode = true;
				console.log(scope);
			});

			scope.$on('viewportIsolationExit', function () {
				scope.inIsolationMode = false;
			});

		}
	};

}])
	
.directive('viewportContextMenu', ['$state', 'ImageCollection', function ($state, ImageCollection) {

	return {
		templateUrl: 'components/dokuvis.viewport/viewportContextMenu.tpl.html',
		restrict: 'E',
		link: function (scope, element) {

			scope.openDetails = function () {
				$state.go('.image', { imageId: scope.entry.source.id });
				scope.$parent.closeContextMenu();
			};

			scope.addToCollection = function () {
				ImageCollection.add(scope.entry.source);
				scope.$parent.closeContextMenu();
			};

			scope.removeFromCollection = function () {
				ImageCollection.remove(scope.entry.source);
				scope.$parent.closeContextMenu();
			};

			scope.focus = function () {
				scope.entry.focus();
				scope.$parent.closeContextMenu();
			};

			element.on('$destroy', function () {
				scope.$destroy();
			});

		}
	};

}])

.directive('viewportAnalysisTools', ['$debounce', function ($debounce) {

	return {
		templateUrl: 'components/dokuvis.viewport/viewportAnalysisTools.tpl.html',
		restrict: 'E',
		link: function (scope, element) {

			scope.heatMap = {
				visible: false,
				overlay: false,
				radius: 40,
				toggle: function () {
					viewportHeatMapUpdate({visibilityChange: true});
				},
				toggleOverlay: function () {
					viewportHeatMapUpdate({overlayChange: true});
				},
				changeRadius: $debounce(function () {
					viewportHeatMapUpdate({radiusChange: true});
				}, 1000)
			};

			function viewportHeatMapUpdate(options) {
				scope.$emit('viewportHeatMapUpdate', angular.extend(options, {
					visible: scope.heatMap.visible,
					overlay: scope.heatMap.overlay,
					radius: scope.heatMap.radius
				}));
			}

			element.on('$destroy', function () {
				scope.$destroy();
			});

		}
	};

}]);

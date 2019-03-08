/**
 * 3D viewport
 * @ngdoc module
 * @name dokuvis.viewport
 * @module dokuvis.viewport
 */
angular.module('dokuvis.viewport',[
	'pascalprecht.translate',
	'ngDebounceThrottle'
])

/**
 * Main directive, core element
 * @ngdoc directive
 * @name viewport
 * @module dokuvis.viewport
 * @restrict E
 * @param navigation {boolean} Enable navigation bar
 * @param compass {boolean} Enable compass for orientation
 * @param loadProgress {boolean} Enable progress bar while loading objects
 * @param imageControls {boolean} Enable image controls panel
 * @param selectionDisplay {boolean} Enable selection display panel
 * @param analysisTools {boolean} Enable analysis tools panel
 * @param spatializeManual {boolean} Enable image spatialization functionality
 */
.component('viewport', {

	template: '<canvas ng-class="{\'cursor_orbit\': navigation.rotate, \'cursor_pan\': navigation.pan, \'cursor_zoom\': navigation.zoom}"></canvas>\n<div class="viewport-extras"></div>',

	controller: ['$scope', '$element', '$attrs', '$state', '$window', '$timeout', 'viewportCache', 'viewportSettings', '$rootScope', '$q', 'Utilities', '$debounce', '$throttle', 'SpatializeInterface', '$log', '$compile', '$animate', 'Image', function (scope, element, attrs, $state, $window, $timeout, viewportCache, viewportSettings, $rootScope, $q, Utilities, $debounce, $throttle, SpatializeInterface, $log, $compile, $animate, Image) {

		console.log(scope, element, attrs);

		var cfId = attrs.id || 0;
		SpatializeInterface.callFunc[cfId] = {};

		///// VARIABLES

		var contextMenuElement, contextMenuScope,
			tooltipElement, tooltipScope,
			spatializeManualElement, spatializeManualScope,
			progressBarElement, progressBarScope;

		// constants frustum clipping
		var NEAR = viewportSettings.defaults.NEAR,
			FAR = viewportSettings.defaults.FAR;

		// general
		var SCREEN_WIDTH, SCREEN_HEIGHT,
			canvas,
			renderer, scene, controls,
			camera, dlight,
			raycaster = new THREE.Raycaster(),
			octree, rbushTree, clusterTree,
			ctmloader, textureLoader;

		// lists
		var selected = [], highlighted = null, marked = [],
			hoverObject = null;

		// Gizmo, Slice, Messen
		var gizmo, gizmoMove, gizmoRotate;
		var measureTool, pin, heatMap, objHeatMap, vectorField, windMap, radarChart, radialFan;
		var heatMapRadius = 0;

		var isAnimating = false,
			isLoading = false;

		// navigation flags
		var mouseDownCoord = new THREE.Vector2(),
			mouseDownEvent = null;
		var isMouseDown = -1,
			isRotatingView = false,
			isZoomingView = false,
			isPanningView = false;
		var navigation = scope.navigation = {'default': true, rotate: false, pan: false, zoom: false};

		var isSelecting = false,
			isPinning = false,
			isMarking = false;

		var currentMarker;

		var inIsolationMode = true;

		var dummyCreationMode = false;
		var dummyOrigin, dummyDir, dummyArrow;


		// Übernahme aus viewportCache
		var objects = viewportCache.objects;
		var plans = viewportCache.plans;
		var spatialImages = viewportCache.spatialImages;
		var geometries = viewportCache.geometries;
		var materials = viewportCache.materials;


		///// INITIALIZE

		// Initialisierung des Ganzen
		// $timeout(function () {
		// 	init();
		// });

		this.$onInit = function () {
			console.log('viewport $onInit');

			// viewport width and height
			SCREEN_WIDTH = element.width();
			SCREEN_HEIGHT = element.height();
			console.log('viewport size: ', SCREEN_WIDTH, SCREEN_HEIGHT);

			// Camera
			camera = new THREE.CombinedCamera(SCREEN_WIDTH, SCREEN_HEIGHT, 35, NEAR, FAR, NEAR, FAR);
			if (viewportCache.viewpoint) camera.position.copy(viewportCache.viewpoint.cameraPosition);
			else camera.position.set(-100, 60, 100);

			// Scene
			scene = viewportCache.scene;

			canvas = element.find('canvas');

			// Renderer
			renderer = new THREE.WebGLRenderer({
				antialias: true,
				alpha: false,
				preserveDrawingBuffer: true,
				canvas: canvas.get(0)
			});
			renderer.setClearColor(DV3D.Defaults.backgroundColor, 1);
			renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
			element.append(renderer.domElement);

			// Controls (for navigation)
			controls = new THREE.OrbitControls(camera, renderer.domElement);
			controls.zoomSpeed = 1.0;
			// if (viewportCache.viewpoint) controls.target = viewportCache.viewpoint.controlsPosition.clone();
			if (viewportCache.viewpoint) controls.target.copy(viewportCache.viewpoint.controlsTarget);
			camera.target = controls.target;
			controls.addEventListener('change', onControlsChange);
			controls.addEventListener('end', function () {
				updateHeatMapAsync();
			});

			// Light
			dlight = viewportCache.directionalLight;

			// loading progress bar
			var manager = new THREE.LoadingManager();
			manager.onProgress = viewportLoadProgress;
			manager.onLoad = function () {
				focusAll();
			};

			// objloader = new THREE.OBJMTLLoader(manager);
			ctmloader = new THREE.CTMLoader(manager);
			textureLoader = new THREE.TextureLoader(manager);

			// bind event listeners
			canvas.on('mousedown', mousedown);
			canvas.on('mousemove', mousemove);
			canvas.on('mouseup', mouseup);
			canvas.on('dblclick', dblclick);
			element.on('mouseleave', mouseleave);
			canvas.on('wheel', mousewheel);

			canvas.on('contextmenu', function(event) {
				event.preventDefault();
			});

			var windowElement = angular.element($window);
			windowElement.on('keydown', keydown);
			windowElement.on('keyup', keyup);
			windowElement.on('resize', resizeViewport);

			scope.$on('resizeLayout', resizeViewport);

			// octree
			octree = new THREE.Octree({
				//scene: scene
				//depthMax: 16,
				//objectsThreshold: 8
				//undeferred: true
			});

			// rbushTree = rbush(2, ['.x', '.y', '.x', '.y']);

			clusterTree = new DV3D.ClusterTree(scene, octree);

			// var ground = new THREE.Mesh(new THREE.PlaneBufferGeometry(10000, 10000), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
			// ground.rotation.x = -Math.PI / 2;
			// scene.add(ground);

			// Gizmo
			gizmoMove = new DV3D.GizmoMove(10, 2.5, 1.2);
			gizmoMove.addEventListener('change', animate);
			gizmoRotate = new DV3D.GizmoRotate(10);
			gizmoRotate.addEventListener('change', animate);
			//console.log(gizmo);

			// add event listeners to entries
			objects.forEach(function (entry) {
				entry.addEventListener('change', animateAsync);
				entry.addEventListener('toggle', toggleObjectHandler);
				entry.addEventListener('focus', focusHandler);
				entry.addEventListener('select', selectHandler);
			});

			spatialImages.forEach(function (entry) {
				entry.addEventListener('change', animateAsync);
				entry.addEventListener('toggle', toggleSourceHandler);
				entry.addEventListener('select', selectHandler);
				entry.addEventListener('focus', focusHandler);
				octree.add(entry.object.collisionObject);
			});

			animate();
			viewportCameraMove(camera);

			octree.update();


			///// STATIC COMPONENTS

			var elScope, el;

			// <viewport-navigation> component
			if ('navigation' in attrs) {
				elScope = scope.$new(false);
				elScope.focus = function (mode) {
					if (camera.inOrthographicMode) return;
					switch (mode) {
						case 'selected': focusSelection(selected); break;
						default: focusAll();
					}
				};

				el = $compile('<viewport-navigation></viewport-navigation>')(elScope);
				$animate.enter(el, element);
			}

			// <viewport-compass> component
			if ('compass' in attrs) {
				elScope = scope.$new(false);
				elScope.faceNorth = faceNorth;
				el = $compile('<viewport-compass></viewport-compass>')(elScope);
				$animate.enter(el, element);
			}

			// <viewport-load-progress> component
			if ('loadProgress' in attrs) {
				elScope = scope.$new(false);
				el = $compile('<viewport-load-progress></viewport-load-progress>')(elScope);
				$animate.enter(el, element);
			}

			// <viewport-image-controls> component
			if ('imageControls' in attrs) {
				elScope = scope.$new(false);
				el = $compile('<viewport-image-controls></viewport-image-controls>')(elScope);
				$animate.enter(el, element);
			}

			// <viewport-selection-display> component
			if ('selectionDisplay' in attrs) {
				elScope = scope.$new(false);
				elScope.exitIsolation = exitIsolation;

				el = $compile('<viewport-selection-display></viewport-selection-display>')(elScope);
				$animate.enter(el, element);
			}

			// <viewport-analysis-tools> component
			if ('analysisTools' in attrs) {
				elScope = scope.$new(false);
				elScope.linkToObjects = function () {
					var count = 0, length = spatialImages.list.length;
					spatialImages.forEach(function (img) {
						linkObjectsInSight(img);
						console.log('Link object ' + (++count) + ' / ' + length);
					});
				};
				elScope.toggleDummyCreationMode = function () {
					dummyCreationMode = !dummyCreationMode;
					return dummyCreationMode;
				};

				el = $compile('<viewport-analysis-tools></viewport-analysis-tools>')(elScope);
				$animate.enter(el, element);
			}

		};


		///// DYNAMIC COMPONENTS

		/**
		 * Open context menu for item.
		 * @param entry {DV3D.Entry} Entry item
		 * @param position {THREE.Vector2} viewport screen coordinates where to place the context menu
		 */
		function openContextMenu(entry, position) {
			contextMenuScope = scope.$new(false);
			contextMenuScope.position = position;
			contextMenuScope.entry = entry;
			contextMenuScope.close = closeContextMenu;
			contextMenuScope.deleteDummy = deleteDummyImage;
			contextMenuElement = $compile('<viewport-context-menu no-context-menu></viewport-context-menu>')(contextMenuScope);
			$animate.enter(contextMenuElement, element);
		}

		/**
		 * Close existing context menu
		 */
		function closeContextMenu() {
			if (contextMenuScope) {
				contextMenuScope.$destroy();
				contextMenuScope = null;
			}
			if (contextMenuElement) {
				$animate.leave(contextMenuElement);
				contextMenuElement = null;
			}
		}

		/**
		 * Delay tooltip instantiation
		 */
		var hoverDebounce = $debounce(function (entry, position) {
			if (entry instanceof DV3D.ClusterObject) {
				entry.explode();
				animateAsync();
			}
			else
				openTooltip(entry, position);
		}, 500, false, false);

		function enterHover(entry, position) {
			hoverObject = entry;

			if (hoverObject instanceof DV3D.ClusterObject)
				hoverObject.highlight(true);

			else if (entry instanceof DV3D.ObjectEntry)
				assignHighlightMat(entry.object);
				// entry.highlight(true);

			else if (entry instanceof DV3D.ImageEntry)
				entry.highlight(true);
			// else
			// 	spatialImages.dehighlight();

			animateThrottle20();

			hoverDebounce(entry, position);
		}

		function exitHover() {
			if (hoverObject instanceof DV3D.ClusterObject) {
				hoverObject.implode();
				hoverObject.highlight(false);
			}
			else if (hoverObject instanceof DV3D.ObjectEntry) {
				rejectHighlightMat(hoverObject.object);
			}
			else if (hoverObject instanceof DV3D.ImageEntry) {
				hoverObject.highlight(false);
			}

			animateThrottle20();
			// animateAsync();

			hoverObject = null;

			closeTooltip();
		}

		function openTooltip(entry, position) {
			tooltipScope = scope.$new(false);
			tooltipScope.position = position;
			tooltipScope.entry = entry;
			tooltipScope.close = closeTooltip;
			tooltipElement = $compile('<viewport-tooltip></viewport-tooltip>')(tooltipScope);
			$animate.enter(tooltipElement, element);
		}

		function closeTooltip() {
			if (tooltipScope) {
				tooltipScope.$destroy();
				tooltipScope = null;
			}
			if (tooltipElement) {
				$animate.leave(tooltipElement);
				tooltipElement = null;
				scope.$applyAsync();
			}
		}

		function openProgressBar() {
			progressBarScope = scope.$new(false);
			progressBarScope.close = closeProgressBar;
			progressBarElement = $compile('<viewport-progress-bar></viewport-progress-bar>')(progressBarScope);
			$animate.enter(progressBarElement, element);
		}

		function closeProgressBar() {
			if (progressBarScope) {
				progressBarScope.$destroy();
				progressBarScope = null;
			}
			if (progressBarElement) {
				$animate.leave(progressBarElement);
				progressBarElement = null;
			}
		}

		/**
		 * Open manual spatialize interface
		 * @param src
		 */
		function openSpatializeManual(src) {
			if (angular.element(element).find('viewport-spatialize-manual').length)
				return;

			spatializeManualScope = scope.$new(false);
			spatializeManualScope.source = src;
			spatializeManualScope.camera = camera;
			spatializeManualScope.controls = controls;
			spatializeManualScope.animate = animateThrottle20;
			spatializeManualScope.close = closeSpatializeManual;
			spatializeManualScope.linkToObjects = function (src) {
				var entry = spatialImages.getByName(src.spatial.id);
				return linkObjectsInSight(entry);
			};

			spatializeManualElement = $compile('<viewport-spatialize-manual></viewport-spatialize-manual>')(spatializeManualScope);
			$animate.enter(spatializeManualElement, element);

			element.find('viewport-selection-display, viewport-analysis-tools').hide();
		}

		function closeSpatializeManual() {
			if (spatializeManualScope) {
				spatializeManualScope.$destroy();
				spatializeManualScope = null;
			}
			if (spatializeManualElement) {
				$animate.leave(spatializeManualElement);
				spatializeManualElement = null;
			}
			element.find('viewport-selection-display, viewport-analysis-tools').show();
		}

		// listen to triggerSpatializeManual event
		scope.$on('triggerSpatializeManual', function (event, source) {
			if ('spatializeManual' in attrs)
				openSpatializeManual(source);
		});


		/**
		 * Event that broadcasts the progress of the loading manager.
		 * @ngdoc event
		 * @name viewport#viewportLoadProgress
		 * @eventType broadcast on viewport
		 * @param item {string} Name/url of the last loaded item.
		 * @param loaded {number} Number of already loaded items.
		 * @param total {number} Total number of items.
		 */
		function viewportLoadProgress(item, loaded, total) {
			scope.$broadcast('viewportLoadProgress', item, loaded, total);
		}

		/**
		 * Event that gets fired, when camera has moved.
		 * @ngdoc event
		 * @name viewport#viewportCameraMove
		 * @eventType broadcast on viewport
		 * @param cam {THREE.Camera} Camera that has changed/moved
		 */
		function viewportCameraMove(cam) {
			scope.$broadcast('viewportCameraMove', cam);
		}


		function updateOctree() {
			if (renderer) renderer.render(scene, camera);
			octree.update();
		}
		var updateOctreeAsync = $debounce(updateOctree, 100);

		function onControlsChange() {
			exitIsolation();
			animateThrottle20();
			viewportCameraMove(camera);
		}


		///// ANIMATION LOOP / RENDER

		// start animation loop
		function startAnimation() {
			if (!isAnimating) {
				controls.removeEventListener('change', onControlsChange);
				isAnimating = true;
				animate();
			}
		}

		// stop animation loop
		function stopAnimation() {
			if (isAnimating) {
				controls.addEventListener('change', onControlsChange);
				isAnimating = false;
			}
		}

		function animateOnce() {
			if (!isAnimating) animate();
		}

		/**
		 * Call animate() with debounce. Useful, when iterating over an array, so animate() isn't called a hundred times to update the changes in the viewport.
		 */
		var animateAsync = $debounce(animateOnce, 50);
		var animateThrottle20 = $throttle(animateOnce, 20);
		var animateThrottle500 = $throttle(animateOnce, 500);
		// var animateDebounce50 = $debounce(animate, 50);

		/**
		 * animation loop
		 */
		function animate() {
			if (isAnimating) {
				TWEEN.update();
				// only if there are active Tweens
				if (TWEEN.getAll().length || windMap) {
					requestAnimationFrame(animate);
				}
				// if no Tweens -> stop animation loop
				else {
					stopAnimation();
				}
			}
			else {
				// update image resolution
				// spatialImages.forEach(function (img) {
				// 	img.updateTextureByDistance(camera.position, 30);
				// }, true);
				if (!isLoading)
					clusterTree.update(camera);
			}

			if (controls) controls.update();

			if (viewportCache.grid) {
				var gridResolution = viewportSettings.defaults.gridSize / viewportSettings.defaults.gridDivisions;
				viewportCache.grid.position.x = Math.round(camera.position.x / gridResolution) * gridResolution;
				viewportCache.grid.position.z = Math.round(camera.position.z / gridResolution) * gridResolution;
			}

			if (windMap) windMap.draw();

			// position light depending on camera
			if (dlight) {
				dlight.position.set(4, 4, 4);
				var lightMatrix = new THREE.Matrix4().makeRotationFromQuaternion(camera.quaternion);
				dlight.position.applyMatrix4(lightMatrix);
			}

			// update markers lookAt
			// if (scope.hud.spatialize && SpatializeInterface.markers3D.length) {
			// 	for (var i=0, l=SpatializeInterface.markers3D.length; i<l; i++) {
			// 		SpatializeInterface.markers3D[i].object.lookAt(camera.position);
			// 	}
			// }

			render();
		}

		/**
		 * render calls
		 */
		function render() {
			if (renderer) renderer.render(scene, camera);
			//postprocessing.composer.render();
		}


		///// SELECTION / RAYCASTING

		/**
		 * Set raycaster to be prepared for recasting
		 * @param mouse {THREE.Vector2} Mouse viewport coordinates
		 */
		function prepareRaycaster(mouse) {
			var direction = new THREE.Vector3(mouse.x, mouse.y, NEAR).unproject(camera).sub(camera.position).normalize();
			raycaster.set(camera.position, direction);
		}

		/**
		 * Raycasting mouse coords and return first object/intersection.
		 * @param testObjects {Array} Array of objects to be testet
		 * @param [recursive=false] {boolean} If true, also check descendants
		 * @return {Object|null} First object that was hit by the ray
		 */
		function raycast(testObjects, recursive) {
			var intersects = raycaster.intersectObjects(testObjects, recursive || false);

			if (intersects.length)
				return intersects[0];
			else
				return null;
		}

		/**
		 * Collect test objects
		 * @param type {...string} Which kind of test objects should be retrieved? `spatialImages` will return the collision object of images used for raycasting.
		 */
		function getRaycastTestObjects(type) {
			var args = Array.from(arguments),
				testObjects = [];

			if (args.indexOf('objects') !== -1)
				objects.forEach(function (obj) {
					if (obj.type === 'object')
						testObjects.push(obj.object);
				}, true);

			if (args.indexOf('plans') !== -1)
				plans.forEach(function (plan) {
					testObjects.push(plan.object.mesh);
				}, true);

			// spatialImages in octree
			if (args.indexOf('spatialImages') !== -1)
				octree.search(raycaster.ray.origin, 0, true, raycaster.ray.direction)
					.forEach(function (item) {
						//if (item.object.parent.entry.visible)
						testObjects.push(item.object);
					});

			return testObjects;
		}

		/**
		 * Selection by a simple click.
		 * @param mouse {THREE.Vector2} mouse position (in viewport coordinates)
		 * @param ctrlKey {boolean=false} if ctrlKey is pressed
		 */
		function selectRay(mouse, ctrlKey) {
			prepareRaycaster(mouse);
			var testObjects = getRaycastTestObjects('objects', 'plans', 'spatialImages');
			// raycast
			var intersection = raycast(testObjects, true);

			if (intersection) {
				$log.debug(intersection);

				if (intersection.object.entry instanceof DV3D.Entry)
					setSelected(intersection.object.entry, ctrlKey);
				else if (intersection.object.parent.entry instanceof DV3D.Entry)
					setSelected(intersection.object.parent.entry, ctrlKey);
				else if (intersection.object.parent.cluster instanceof DV3D.ClusterObject)
					setSelected(intersection.object.parent.cluster, ctrlKey);
				else
					$log.warn('Raycast hit unknown object', intersection);
			}
			else
				setSelected(null, ctrlKey);
		}

		/**
		 * Selection by drawing a rectangle.
		 * @param mStart {THREE.Vector2} mouse position at start (in viewport coordinates)
		 * @param mEnd {THREE.Vector2} mouse position at end (in viewport coordinates)
		 * @param ctrlKey {boolean=false} if ctrlKey is pressed
		 */
		function selectArea(mStart, mEnd, ctrlKey) {
			// viewport coordinates into world coordinates in front of camera
			var s0 = new THREE.Vector3(mStart.x, mStart.y, 0.5).unproject(camera);
			var s1 = new THREE.Vector3(mStart.x, mEnd.y, 0.5).unproject(camera);
			var s2 = new THREE.Vector3(mEnd.x, mEnd.y, 0.5).unproject(camera);
			var s3 = new THREE.Vector3(mEnd.x, mStart.y, 0.5).unproject(camera);
			var s4 = new THREE.Vector3(0, 0, 0.5).unproject(camera);
			// direction vectors from camera through those points
			var v0 = new THREE.Vector3().subVectors(s0, camera.position);
			var v1 = new THREE.Vector3().subVectors(s1, camera.position);
			var v2 = new THREE.Vector3().subVectors(s2, camera.position);
			var v3 = new THREE.Vector3().subVectors(s3, camera.position);
			var v4 = new THREE.Vector3().subVectors(s4, camera.position);

			var s5 = new THREE.Vector3(0, 0, 0.5).unproject(camera).add(v4.clone().setLength(FAR));
			var v5 = new THREE.Vector3().subVectors(s5, camera.position);

			// plane normals
			var n0 = new THREE.Vector3().crossVectors(v1, v0).normalize();
			var n1 = new THREE.Vector3().crossVectors(v2, v1).normalize();
			var n2 = new THREE.Vector3().crossVectors(v3, v2).normalize();
			var n3 = new THREE.Vector3().crossVectors(v0, v3).normalize();
			var n4 = v4.clone().normalize();
			var n5 = v5.clone().negate().normalize();
			// plane constants
			var d0 = - n0.dot(s0);
			var d1 = - n1.dot(s1);
			var d2 = - n2.dot(s2);
			var d3 = - n3.dot(s3);
			var d4 = - n4.dot(s4);
			var d5 = - n5.dot(s5);
			// planes
			var p0 = new THREE.Plane(n0, d0);
			var p1 = new THREE.Plane(n1, d1);
			var p2 = new THREE.Plane(n2, d2);
			var p3 = new THREE.Plane(n3, d3);
			var p4 = new THREE.Plane(n4, d4);
			var p5 = new THREE.Plane(n5, d5);

			// frustum
			var frustum = new THREE.Frustum(p0, p1, p2, p3, p4, p5);

			if (!ctrlKey)
				setSelected(null, false, true);

			objects.forEach(function (obj) {
				if (obj.type !== 'object') return;
				if (selected.indexOf(obj.object) !== -1) return;

				// first level check, `intersetcsObjects` only tests against boundingSphere
				if (frustum.intersectsObject(obj.object)) {
					console.log('first check');
					var position = obj.object.geometry.attributes.position.array,
						matrix = obj.object.matrixWorld;

					// second level check, test if any points are within frustum
					for (var i = 0, l = position.length; i < l; i += 3) {
						var vertex = new THREE.Vector3(position[i], position[i+1], position[i+2]);
						vertex.applyMatrix4(matrix);
						if (frustum.containsPoint(vertex)) {
							console.log('second check');
							setSelected(obj, true);
							break;
						}
					}
				}
			}, true);
		}

		/**
		 * deselect any selected object and assign original material,
		 * then select object and assign selection material
		 * @param {DV3D.Entry} entry - entry to be set
		 * @param {boolean} [onlySelect=false] - if true, no deselection
		 * @param {boolean} [onlyDeselect=false] - if true, no selection
		 */
		function setSelected(entry, onlySelect, onlyDeselect) {
			onlySelect = onlySelect || false;
			onlyDeselect = onlyDeselect || false;

			var selectionChanged = false;

			//dehighlight(); // TODO: revise dehighlight

			// deselect all
			if (selected.length && !onlySelect) {
				selected.forEach(function (item) {
					deselectEntry(item);
					selectionChanged = true;
				});

				setGizmo();
				selected = [];
			}

			// select object/entry
			if (entry && !onlyDeselect && selected.indexOf(entry) === -1) {
				selectEntry(entry);
				selected.push(entry);
				selectionChanged = true;

				if (entry instanceof DV3D.PlanEntry)
					setGizmo(entry.object, 'move');
			}

			// deselect single object/entry
			else if (entry && !onlyDeselect && selected.indexOf(entry) !== -1) {
				deselectEntry(entry);
				selected.splice(selected.indexOf(entry), 1);
				selectionChanged = true;

				if (gizmo) {
					if (gizmo.object === entry.object)
						setGizmo();
				}
			}

			if (selectionChanged)
				viewportSelectionChange();

			//$rootScope.$applyAsync();
			animateAsync();
		}

		/**
		 * Event that gets fired, when an object has been selected or deselected / selection array changed.
		 * @ngdoc event
		 * @name viewport#viewportSelectionChange
		 * @eventType broadcast on $rootScope
		 */
		var viewportSelectionChange = $debounce(function () {
			$rootScope.$broadcast('viewportSelectionChange', selected);
		}, 200);

		// apply selection material/color to entry's object and activate entry
		function selectEntry(entry) {
			if (entry instanceof DV3D.Entry) {
				if (entry instanceof DV3D.ObjectEntry) {
					assignSelectionMaterial(entry);
					entry.children.forEach(function (child) {
						selectEntry(child);
					});
				} else if (entry instanceof DV3D.PlanEntry) {
					entry.object.select();
				} else if (entry instanceof DV3D.ImageEntry) {
					entry.object.select();
				}
				entry.select(null, true);
			}
			else if (entry instanceof DV3D.ClusterObject) {
				entry.implode();
				entry.select(true);
			}
		}

		// apply original material/color to entry's object and deactivate entry
		function deselectEntry(entry) {
			if (entry instanceof DV3D.Entry) {
				if (entry instanceof DV3D.ObjectEntry) {
					rejectSelectionMaterial(entry);
					entry.children.forEach(function (child) {
						deselectEntry(child);
					});
				} else if (entry instanceof DV3D.PlanEntry) {
					entry.object.deselect();
				} else if (entry instanceof DV3D.ImageEntry) {
					entry.object.deselect();
				}
				entry.select(null, false);
			}
			else if (entry instanceof DV3D.ClusterObject) {
				// entry.implode();
				entry.select(false);
			}
		}

		/**
		 * Assign selection material to object.
		 * @param {DV3D.ObjectEntry} entry - entry
		 */
		function assignSelectionMaterial(entry) {
			if (entry.type !== 'object') return;

			switch (viewportSettings.shading) {
				case 'xray': entry.object.material = materials['xraySelectionMat']; break;
			}

			if (entry.edges) {
				if (entry.edges.material === materials['edgesMat'])
					entry.edges.material = materials['edgesSelectionMat'];
				else
					entry.edges.material.color = materials['edgesSelectionMat'].color;
			}
		}

		/**
		 * Reject selection material from object.
		 * @param {DV3D.ObjectEntry} entry - entry
		 */
		function rejectSelectionMaterial(entry) {
			if (entry.type !== 'object') return;

			switch (viewportSettings.shading) {
				case 'xray': entry.object.material = materials['xrayMat']; break;
			}

			if (entry.edges) {
				if (entry.edges.material === materials['edgesSelectionMat'])
					entry.edges.material = materials['edgesMat'];
				else
					entry.edges.material.color = materials['edgesMat'].color;
			}
		}

		function setHighlighted(entry) {
			var highlightChanged = false;

			if (highlighted && highlighted !== entry) {
				unhighlightEntry(highlighted);
				highlighted = null;
				highlightChanged = true;
			}

			if (entry && highlighted === null) {
				highlightEntry(entry);
				highlighted = entry;
				highlightChanged = true;
			}

			if (highlightChanged)
				animateAsync();
		}

		function highlightEntry(entry) {
			if (entry instanceof DV3D.Entry) {
				if (entry instanceof DV3D.ObjectEntry) {
					assignHighlightMat(entry.object);
					entry.children.forEach(function (child) {
						highlightEntry(child);
					});
				} else if (entry instanceof DV3D.ImageEntry) {
					entry.highlight(true);
				}
			}
			else if (entry instanceof DV3D.ClusterObject) {
				entry.highlight(true);
			}
		}

		function unhighlightEntry(entry) {
			if (entry instanceof DV3D.Entry) {
				if (entry instanceof DV3D.ObjectEntry) {
					rejectHighlightMat(entry.object);
					entry.children.forEach(function (child) {
						unhighlightEntry(child);
					});
				} else if (entry instanceof DV3D.ImageEntry) {
					entry.highlight(false);
				}
			}
			else if (entry instanceof DV3D.ClusterObject) {
				entry.implode();
				entry.highlight(false);
			}
		}

		function highlightObject(obj) {
			// if object is marked, do nothing
			if (marked.indexOf(obj) !== -1) return;

			// reject highlight material of all current highlighted objects, but exclude object which is to be set highlighted again
			for (var i = 0; i < highlighted.length; i++) {
				if (highlighted[i] === obj) continue;
				if (marked.indexOf(highlighted[i]) !== -1) continue;

				rejectHighlightMat(highlighted[i]);
				highlighted.splice(i, 1);
				--i;
			}

			// assign highlight material only to those objects, which aren't part of highlighted yet
			if(obj && highlighted.indexOf(obj) === -1) {
				if (obj.userData.type === 'object')
					assignHighlightMat(obj);
				highlighted.push(obj);
			}
		}

		function assignHighlightMat(obj) {
			var hColor = new THREE.Color(DV3D.Defaults.highlightColor);

			switch (viewportSettings.shading) {
				case 'grey':
					obj.material = materials['highlightMat'];
					break;
				case 'transparent':
					obj.material = materials['transparentHighlightMat'];
					break;
				case 'xray':
					obj.material = materials['xrayHighlightMat'];
					break;
				default:
					if (Array.isArray(obj.material))
						obj.material = obj.material.map(function (value) {
							var mat = value.clone();
							mat.color.lerp(hColor, 0.3);
							mat.name += '_highlight';
							return mat;
						});
					else {
						obj.material = obj.material.clone();
						obj.material.color.lerp(hColor, 0.3);
						obj.material.name += '_highlight';
					}
			}
		}

		function rejectHighlightMat(obj) {
			// be sure not to dispose standard or original material
			if (obj.material === materials[obj.userData.originalMat] ||
				viewportCache.standardMaterials.indexOf(obj.material.name) !== -1) {
				if (Array.isArray(obj.material))
					obj.material.forEach(function (value) {
						value.dispose();
					});
				else
					obj.material.dispose();
			}

			switch (viewportSettings.shading) {
				case 'grey':
					obj.material = materials['defaultDoublesideMat'];
					break;
				case 'transparent':
					obj.material = materials['transparentMat'];
					break;
				case 'xray':
					obj.material = materials['xrayMat'];
					break;
				default:
					if (Array.isArray(obj.userData.originalMat))
						obj.material = obj.userData.originalMat.map(function (value) {
							return materials[value];
						});
					else
						obj.material = materials[obj.userData.originalMat];
					break;
			}
		}

		function markObject(obj, remove) {
			if (remove === true) {
				if (obj && marked.indexOf(obj) !== -1) {
					rejectMarkMat(obj);
					marked.splice(marked.indexOf(obj), 1);
				}
			}
			else {
				if (obj && marked.indexOf(obj) === -1) {
					highlightObject();
					if (obj.userData.type === 'object')
						assignMarkmat(obj);
					marked.push(obj);
				}
			}
		}

		function clearMarked() {
			marked.forEach(function (obj) {
				rejectMarkMat(obj);
			});
			marked = [];
		}

		function assignMarkmat(obj) {
			rejectHighlightMat(obj);

			obj.material = obj.material.clone();
			var mcolor = new THREE.Color(0xff0000);
			obj.material.color.lerp(mcolor, 0.5);
			obj.material.name += '_mark';
		}

		function rejectMarkMat(obj) {
			rejectHighlightMat(obj);
		}
			
		function linkObjectsInSight(entry) {
			var defer = $q.defer(),
				resolution = 20;

			var testObjects = getRaycastTestObjects('objects');

			for (var i = 0; i < resolution; i++) {
				for (var j = 0; j < resolution; j++) {
					var x = i * entry.object.width / (resolution + 1) + entry.object.width / resolution - entry.object.width / 2,
						y = j * entry.object.height / (resolution + 1) + entry.object.height / resolution - entry.object.height / 2,
						v = new THREE.Vector3(x, y, 0);

					v.applyMatrix4(entry.object.image.matrixWorld);
					var dir = v.sub(entry.object.position).normalize();
					raycaster.set(entry.object.position, dir);

					var intersection = raycast(testObjects, true);
					if (intersection) {
						var objEntry = intersection.object.entry;
						if (objEntry && selected.indexOf(objEntry) === -1) {
							selectEntry(objEntry);
							selected.push(objEntry);
						}
					}
				}
			}

			console.log(entry);
			console.log(selected.map(function (value) {
				if (value instanceof DV3D.ObjectEntry)
					return value.name;
			}));

			entry.source.$setLinksToObjects({
				objectIds: selected.map(function (value) {
					if (value instanceof DV3D.ObjectEntry)
						return value.name;
				})
			})
				.then(function (response) {
					console.log(response);
					defer.resolve();
				})
				.catch(function (reason) {
					Utilities.throwApiException('#Image.setLinksToObjects', reason);
					defer.reject(reason);
				});

			setSelected(null, false, true);

			animateAsync();

			return defer.promise;
		}


		///// VIEWPORT SETTINGS / SHADING / CAMERA

		function applyShading(mode, lastMode) {
			if (mode === lastMode) return;

			var hideObj = mode === 'onlyEdges' && lastMode !== 'onlyEdges';
			var unhideObj = lastMode === 'onlyEdges' && mode !== 'onlyEdges';
			var hideEdges = mode === 'xray' && lastMode !== 'xray';
			var unhideEdges = viewportSettings.showEdges && lastMode === 'xray';
			if (lastMode === 'custom') categoryDeactivate();

			objects.forEach(function (obj) {
				if (obj.visible) {
					if (hideObj) {
						if (obj.parent) obj.parent.object.remove(obj.object);
						else scene.remove(obj.object);
					}
					if (unhideObj) {
						if (obj.parent) obj.parent.object.add(obj.object);
						else scene.add(obj.object);
					}
					if (hideEdges && obj.edges)
						scene.remove(obj.edges);
					if (unhideEdges && obj.edges)
						scene.add(obj.edges);
				}

				// TODO: consider opacity
				switch (mode) {
					// case 'color':
					// 	obj.object.material = materials[obj.object.userData.originalMat];
					// 	break;
					case 'grey':
						obj.object.material = materials['defaultDoublesideMat'];
						break;
					case 'transparent':
						obj.object.material = materials['transparentMat'];
						break;
					case 'xray':
						if (selected.indexOf(obj) !== -1)
							obj.object.material = materials['xraySelectionMat'];
						else
							obj.object.material = materials['xrayMat'];
						break;
					default:
						if (Array.isArray(obj.object.userData.originalMat))
							obj.object.material = obj.object.userData.originalMat.map(function (value) {
								return materials[value];
							});
						else
							obj.object.material = materials[obj.object.userData.originalMat];
						break;
				}
			});

			animate();
		}

		// watch for change in shading settings
		scope.$watch(function () {
			return viewportSettings.shading;
		}, function (newVal, oldVal) {
			applyShading(newVal, oldVal);
		});

		function setCameraMode(mode) {
			if (!camera) return;
			// TODO: toOrthogtaphic center set to current selection (already done?)
			switch (mode) {
				case 'perspective':
					camera.toPerspective();
					camera.setZoom(1);
					break;
				case 'top':
					camera.toOrthographic(controls.target);
					camera.toTopView();
					break;
				case 'front':
					camera.toOrthographic(controls.target);
					camera.toFrontView();
					break;
				case 'back':
					camera.toOrthographic(controls.target);
					camera.toBackView();
					break;
				case 'left':
					camera.toOrthographic(controls.target);
					camera.toLeftView();
					break;
				case 'right':
					camera.toOrthographic(controls.target);
					camera.toRightView();
					break;
				default: break;
			}
			animate();
		}

		// watch for change in camera settings
		scope.$watch(function () {
			return viewportSettings.camera;
		}, function (newVal, oldVal) {
			applyShading(newVal, oldVal);
		});


		///// NAVIGATION

		/**
		 * Set navigation mode.
		 * @param [mode] {string} Navigation mode to set. If no mode is provided, navigation will be set to default.
		 */
		function setNavigationMode(mode) {
			if (measureTool) {
				scene.remove(measureTool);
				measureTool.dispose();
				measureTool = null;
			}

			if (pin) {
				scene.remove(pin);
				pin.dispose();
				pin = null;
				isPinning = false;
				highlightObject(null);
			}

			navigation.default = false;
			navigation.rotate = false;
			navigation.pan = false;
			navigation.zoom = false;

			if (mode && mode in navigation)
				navigation[mode] = true;
			else
				navigation.default = true;

			animate();
		}

		function triggerNavigationChange(mode) {
			scope.$broadcast('viewportNavigationChange', mode);
		}

		// listen to viewportNavigationChange event
		scope.$on('viewportNavigationChange', function (event, mode) {
			if (event.stopPropagation)
				event.stopPropagation();
			setNavigationMode(mode);
		});


		///// NAVIGATION MOUSE EVENTS

		/**
		 * Transform mouse coordinates into viewport coordinates.
		 * @param event {Object} Mouse event object
		 * @return {THREE.Vector2} 2-dimensional vector with viewport coordinates
		 */
		function mouseToViewportCoords(event) {
			var mouse = new THREE.Vector2();
			mouse.x = (event.offsetX / SCREEN_WIDTH) * 2 - 1;
			mouse.y = - (event.offsetY / SCREEN_HEIGHT) * 2 + 1;
			return mouse;
		}

		// Transform viewport coordinates into screen coordinates
		function viewportCoordsToScreenXY(coords) {
			var left = SCREEN_WIDTH * (coords.x + 1) / 2;
			var top = SCREEN_HEIGHT * (-coords.y + 1) / 2;
			return new THREE.Vector2(left, top);
		}

		// determine position and dimension of selection rectangle from two mouse coordinates
		function getSelectRectangleCSS(mStart, mEnd) {
			var mStartScreen = viewportCoordsToScreenXY(mStart),
				mEndScreen = viewportCoordsToScreenXY(mEnd),
				css = {};

			if (mEnd.x > mStart.x) {
				css.left = mStartScreen.x;
				css.width = mEndScreen.x - mStartScreen.x;
			}
			else {
				css.left = mEndScreen.x;
				css.width = mStartScreen.x - mEndScreen.x;
			}
			if (mEnd.y < mStart.y) {
				css.top = mStartScreen.y;
				css.height = mEndScreen.y - mStartScreen.y;
			}
			else {
				css.top = mEndScreen.y;
				css.height = mStartScreen.y - mEndScreen.y;
			}

			return css;
		}

		// mousedown event handler
		function mousedown(event) {
			closeContextMenu();
			closeTooltip();
			isMouseDown = event.button;
			mouseDownCoord = mouseToViewportCoords(event);
			mouseDownEvent = event;

			if (dummyCreationMode && event.button === 0) {
				var plane = new THREE.Plane(new THREE.Vector3(0,1,0), -3);
				prepareRaycaster(mouseDownCoord);
				dummyOrigin = raycaster.ray.intersectPlane(plane);
			}

			else if (navigation.default) {
				if (event.button === 0) {
					if (event.shiftKey) {
						var sr = angular.element('<div/>', {
							id: 'select-rectangle',
							'class': 'select-rectangle'
						});
						element.append(sr);
						isSelecting = true;
					}
					else if (camera.inPerspectiveMode) {
						// isRotatingView = true; -> disabled
					}
				}
				else if (event.button === 1) {
					controls.onMouseDown(event.originalEvent, 2);
					canvas.addClass('cursor_pan');
					isPanningView = true;
				}
			}
			else if (navigation.rotate) {
				if (event.button === 0 && camera.inPerspectiveMode) {
					controls.onMouseDown(event.originalEvent, 0);
					isRotatingView = true;
				}
			}
			else if (navigation.pan) {
				if (event.button === 0) {
					controls.onMouseDown(event.originalEvent, 2);
					isPanningView = true;
				}
			}
			else if (navigation.zoom) {
				if (event.button === 0) {
					controls.onMouseDown(event.originalEvent, 1);
					isZoomingView = true;
				}
			}
		}

		// mousemove event handler
		function mousemove(event) {
			event.preventDefault();
			var mouse = mouseToViewportCoords(event);

			//exitHover();
				closeTooltip();

			if (dummyCreationMode && dummyOrigin) {
				var plane = new THREE.Plane(new THREE.Vector3(0,1,0), -3);
				prepareRaycaster(mouse);
				var point2 = raycaster.ray.intersectPlane(plane);
				var dir = new THREE.Vector3().subVectors(point2, dummyOrigin);
				var length = dir.length();
				dummyDir = dir.normalize();

				if (!dummyArrow) {
					dummyArrow = new THREE.ArrowHelper(dir, dummyOrigin, length);
					scene.add(dummyArrow);
				}
				else {
					dummyArrow.setDirection(dir);
					dummyArrow.setLength(length);
				}
				animate();
			}

			else if (isMouseDown !== -1) {

				// navigation
				if (isRotatingView || isPanningView || isZoomingView) {
					controls.onMouseMove(event.originalEvent);
				}
				// area selection
				else if (isSelecting) {
					element.find('#select-rectangle').css(getSelectRectangleCSS(mouseDownCoord, mouse));
				}

				else if (isMouseDown === 0 && camera.inPerspectiveMode && !mouseDownCoord.equals(mouse)) {
					controls.onMouseDown(mouseDownEvent.originalEvent, 0);
					canvas.addClass('cursor_orbit');
					isRotatingView = true;
				}

			}

			// just hovering
			else {
				prepareRaycaster(mouse);

				if (inIsolationMode)
					var testObjects = getRaycastTestObjects('objects');
				else
					testObjects = getRaycastTestObjects('objects', 'spatialImages');

				var intersection = raycast(testObjects, true);
				if (intersection) {
					var entry = intersection.object.entry || intersection.object.parent.entry || intersection.object.parent.cluster;

					// if (entry instanceof DV3D.ImageEntry)
					// 	entry.highlight(true);
					// else
					// 	spatialImages.dehighlight();
					setHighlighted(entry);
					hoverDebounce(entry, new THREE.Vector2(event.offsetX, event.offsetY));
				}
				else {
					// spatialImages.dehighlight();
					setHighlighted();
					hoverDebounce.cancel();

				}
			}

		}

		// mouseup event handler
		function mouseup(event) {
			if (isMouseDown === -1) return;

			isMouseDown = -1;
			var mouse = mouseToViewportCoords(event);

			if (dummyCreationMode && dummyOrigin) {
				if (dummyArrow) {
					scene.remove(dummyArrow);
					dummyArrow.line.geometry.dispose();
					dummyArrow.line.material.dispose();
					dummyArrow.cone.geometry.dispose();
					dummyArrow.cone.material.dispose();
				}

				// create dummy ImagePane
				createDummyImage(dummyOrigin, dummyDir);

				dummyArrow = null;
				dummyOrigin = null;
				dummyDir = null;
				animate();
			}

			else if (navigation.default && event.button !== 2) {
				// complete navigation
				if (isRotatingView) {
					controls.onMouseUp(event.originalEvent);
					canvas.removeClass('cursor_orbit');
					isRotatingView = false;
				}
				else if (isPanningView) {
					controls.onMouseUp(event.originalEvent);
					canvas.removeClass('cursor_pan');
					isPanningView = false;
				}
				else if (isZoomingView) {
					controls.onMouseUp(event.originalEvent);
					canvas.removeClass('cursor_zoom');
					isZoomingView = false;
				}
				// complete area selection
				else if (isSelecting) {
					element.find('#select-rectangle').remove();
					isSelecting = false;

					if (event.button !== 0) return; // abort selection

					var mStart, mEnd;
					if (mouse.x > mouseDownCoord.x && mouse.y < mouseDownCoord.y ||
						mouse.x < mouseDownCoord.x && mouse.y > mouseDownCoord.y) {
						mStart = mouseDownCoord;
						mEnd = mouse;
					}
					else {
						mStart = new THREE.Vector2(mouseDownCoord.x, mouse.y);
						mEnd = new THREE.Vector2(mouse.x, mouseDownCoord.y);
					}

					selectArea(mStart, mEnd, event.ctrlKey);
					animate();
				}
				// click selection
				else if (mouse.equals(mouseDownCoord)) {
					hoverDebounce.cancel();
					selectRay(mouse, event.ctrlKey);
					animate();
				}
			}
			else if (navigation.rotate || navigation.pan || navigation.zoom) {
				// return to default navigation
				if (event.button === 2)
					triggerNavigationChange();
				// complete navigation
				if (isRotatingView || isPanningView || isZoomingView) {
					controls.onMouseUp(event.originalEvent);
					isRotatingView = isPanningView = isZoomingView = false;
				}
			}
			else if (event.button === 2 && mouse.equals(mouseDownCoord)) {
				// custom context menu
				selectRay(mouse);
				if (selected[0]) {
					hoverDebounce.cancel();
					closeTooltip();
					if (selected[0] instanceof DV3D.ImageEntry || selected[0] instanceof DV3D.ObjectEntry) {
						openContextMenu(selected[0], new THREE.Vector2(event.offsetX, event.offsetY));
					}
				}
			}

		}

		// double click event handler
		function dblclick() {
			if (selected[0]) {
				if (selected[0] instanceof DV3D.ImageEntry)
					selected[0].focus();
				else if (selected[0] instanceof DV3D.ObjectEntry)
					selected[0].focus();
			}
		}

		// mouseleave event handler
		function mouseleave(event) {
			isMouseDown = -1;
			closeContextMenu();
			closeTooltip();
			setHighlighted();
			hoverDebounce.cancel();

			if (navigation.default) {
				// complete navigation
				if (isRotatingView) {
					controls.onMouseUp(event.originalEvent);
					canvas.removeClass('cursor_orbit');
					isRotatingView = false;
				}
				else if (isPanningView) {
					controls.onMouseUp(event.originalEvent);
					canvas.removeClass('cursor_pan');
					isPanningView = false;
				}
				else if (isZoomingView) {
					controls.onMouseUp(event.originalEvent);
					canvas.removeClass('cursor_zoom');
					isZoomingView = false;
				}
				// abort area selection
				else if (isSelecting) {
					element.find('#select-rectangle').remove();
					isSelecting = false;
				}
			}
			else if (navigation.rotate || navigation.pan || navigation.zoom) {
				// complete navigation
				if (isRotatingView || isPanningView || isZoomingView) {
					controls.onMouseUp(event.originalEvent);
					isRotatingView = isPanningView = isZoomingView = false;
				}
			}

		}

		function navigationEnd() {
			viewportCache.viewpoint = {
				cameraPosition: camera.position.clone(),
				controlsPosition: controls.target.clone()
			};
			console.log(viewportCache.viewpoint);

			//var camMatrix = camera.matrixWorld.toArray();

			//var json = angular.toJson(camMatrix);
			//console.log(json);
			//var base64 = btoa(json);
			//console.log(base64);
			//var uri = encodeURIComponent(json);
			//console.log(uri);
			//$state.go('.', { camera: uri })
		}

		// mousewheel event handler
		function mousewheel(event) {
			event.preventDefault();

			closeTooltip();

			//if (camera.inPerspectiveMode) {
			controls.onMouseWheel(event.originalEvent);
			// }
			// else {
			// 	// TODO: orthocam zoom mousewheel
			// 	var delta = - event.originalEvent.deltaY || event.originalEvent.wheelDelta || 0;
			// 	//console.log(delta);
			// 	var ar = SCREEN_WIDTH/SCREEN_HEIGHT;
			// 	var zoomSpeed = 0.05;
			// 	var min = 10;
			// 	camera.left += delta*ar*zoomSpeed;
			// 	camera.right -= delta*ar*zoomSpeed;
			// 	camera.top -= delta*zoomSpeed;
			// 	camera.bottom += delta*zoomSpeed;
			// 	if (camera.right < min*ar || camera.top < min) {
			// 		camera.left = -min*ar;
			// 		camera.right = min*ar;
			// 		camera.top = min;
			// 		camera.bottom = -min;
			// 	}
			// 	camera.updateProjectionMatrix();
			// }
		}

		// keydown event handler
		function keydown(event) {
			if (['INPUT', 'TEXTAREA'].indexOf(event.target.tagName) !== -1) return;
			controls.onKeyDown(event.originalEvent);
		}

		// keyup event handler
		function keyup(event) {
			if (['INPUT', 'TEXTAREA'].indexOf(event.target.tagName) !== -1) return;

			switch (event.keyCode) {
				case 70: setCameraMode('front'); break;			// F
				case 76: setCameraMode('left'); break;			// L
				case 80: setCameraMode('perspective'); break;	// P
				case 84: setCameraMode('top'); break;			// T
			}
		}


		///// SNAPSHOT VIEW

		var snapshotElement = null;

		scope.$on('snapshotViewScreen', function (event, screen, pins) {
			if (angular.element(element).find('viewport-snapshot-view').length)
				return;

			var elScope = scope.$new(false);
			elScope.screen = screen;
			elScope.pins = pins;

			snapshotElement = $compile('<viewport-snapshot-view></viewport-snapshot-view>')(elScope);
			$animate.enter(snapshotElement, element);

			angular.element(element).find('viewport-navigation').attr('disabled', true);

			setSnapshotView(screen);
		});

		scope.$on('snapshotViewClose', function () {
			scope.closeSnapshotView();
		});

		scope.closeSnapshotView = function () {
			if (snapshotElement) $animate.leave(snapshotElement);
			snapshotElement = null;
			angular.element(element).find('viewport-navigation').attr('disabled', false);
		};


		///// SNAPSHOT

		// listen to snapshotStart event
		scope.$on('snapshotStart', function () {
			if (angular.element(element).find('viewport-snapshot').length)
				return;

			var elScope = scope.$new(false);
			elScope.size = {
				width: SCREEN_WIDTH,
				height: SCREEN_HEIGHT
			};

			snapshotElement = $compile('<viewport-snapshot></viewport-snapshot>')(elScope);
			$animate.enter(snapshotElement, element);

			angular.element(element).find('viewport-navigation').attr('disabled', true);

			$timeout(function () {
				snapshotScreenshot(getScreenshot());
			});
		});

		// listen to snapshotEnd event
		scope.$on('snapshotEnd', function () {
			if (snapshotElement) $animate.leave(snapshotElement);
			snapshotElement = null;
			angular.element(element).find('viewport-navigation').attr('disabled', false);
			clearMarked();
			animateAsync();
		});

		// in snapshot mode, start pinning/highlighting (called from child scope)
		scope.startPinning = function () {
			triggerNavigationChange();
			pin = new DV3D.Pin(3, 0.5);
			// pin.addEventListener('change', animateThrottle20);
			scene.add(pin);
			isPinning = true;
		};

		// abort pinning (called from child scope)
		scope.abortPinning = function () {
			isPinning = false;
			triggerNavigationChange();
		};

		// mousemove handler on snapshot pin layer (called from child scope)
		scope.mousemovePinLayer = function (event) {
			if (isPinning && pin) {
				var mouse = mouseToViewportCoords(event);
				var testObjects = [];
				objects.forEach(function (obj) {
					if (obj.type === 'object')
						testObjects.push(obj.object);
				}, true);

				prepareRaycaster(mouse);
				var intersection = raycast(testObjects);

				if (intersection) {
					pin.set(intersection);
					highlightObject(intersection.object);
				}
				else {
					pin.set();
					highlightObject();
				}

				animateThrottle20();
			}
		};

		scope.mouseleavePinLayer = function () {
			if (isPinning && pin) {
				pin.set();
				highlightObject();
				animateAsync();
			}
		};

		// mouseup handler on snaphot pin layer (called from child scope)
		scope.mouseupPinLayer = function (event) {
			event.preventDefault();
			if (isPinning && pin && event.button === 0) {
				if (highlighted[0]) {
					var obj = highlighted[0];
					if (marked.indexOf(obj) === -1) {
						markObject(obj);
						snapshotPinSuccess(objects.get(obj.id), pin.matrixWorld.toArray());

						animateThrottle20();
					}
				}
			}
		};

		scope.$on('snapshotPinRemove', function (event, obj) {
			markObject(obj.object, true);
			animateAsync();
		});

		/**
		 * Retrieve viewport image and camera data
		 * @return {{sData: string, cameraMatrix: *, cameraFOV: *, cameraCenter: *, width: *, height: *}}
		 */
		function getScreenshot() {
			return {
				sData: renderer.domElement.toDataURL("image/jpeg"),
				cameraMatrix: camera.matrix.toArray(),
				cameraFOV: camera.fov,
				cameraCenter: controls.target.toArray(),
				width: SCREEN_WIDTH,
				height: SCREEN_HEIGHT
			};
		}

		function snapshotScreenshot(screenshot) {
			$rootScope.$broadcast('snapshotScreenshot', screenshot);
		}

		function snapshotPinSuccess(object, pinMatrix) {
			$rootScope.$broadcast('snapshotPinSuccess', object, pinMatrix);
		}

		scope.$on('snapshotViewStart', function (event, screenData) {
			setSnapshotView(screenData);
		});

		// tween camera to snapshot position
		function setSnapshotView(data) {
			var camPos = new THREE.Vector3(data.cameraMatrix[12], data.cameraMatrix[13], data.cameraMatrix[14]);
			var ctrlPos = new THREE.Vector3().fromArray(data.cameraCenter);

			new TWEEN.Tween(camera.position.clone())
				.to(camPos, 500)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(function () {
					camera.position.copy(this);
				})
				.start();

			new TWEEN.Tween(controls.target.clone())
				.to(ctrlPos, 500)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(function () {
					controls.target.copy(this);
				})
				.start();

			if (camera.fov === data.cameraFOV) {
				new TWEEN.Tween({fov: camera.fov})
					.to({fov: data.cameraFOV}, 500)
					.easing(TWEEN.Easing.Quadratic.InOut)
					.onUpdate(function () {
						camera.fov = this.fov;
						camera.updateProjectionMatrix();
					})
					.start();
			}

			startAnimation();
		}


		///// SPATIALIZE IMAGE

		function startMarking() {
			currentMarker = new DV3D.TorusMarker(0.5);
			currentMarker.addEventListener('change', animate);
			scene.add(currentMarker);
			isMarking = true;
		}

		function clearMarkers() {
			angular.forEach(SpatializeInterface.markers3D, function (marker) {
				scene.remove(marker.object);
				marker.object.dispose();
			});
			SpatializeInterface.markers3D.splice(0, SpatializeInterface.markers3D.length);
			render();
			scope.$applyAsync();
		}


		function createDummyImage(origin, direction) {
			var quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1), direction);
			var matrix = new THREE.Matrix4().compose(origin, quaternion, new THREE.Vector3(1,1,1));

			// add to database
			Image.createDummy({
				matrix: matrix.toArray(),
				offset: [0,0],
				ck: 1 / Math.tan(((Math.random() * (65 - 20) + 20) / 2) * THREE.Math.DEG2RAD) * 0.5,
				width: Math.round(Math.random() * (1200 - 400) + 400),
				height: Math.round(Math.random() * (1200 - 400) + 400)
			}).$promise
				.then(function (result) {
					console.log(result);
					loadSpatialImage(result)
						.then(function (entry) {
							animate();
							linkObjectsInSight(entry);
						});
					$rootScope.$broadcast('imageUpdate', result);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.createDummy', reason);
				});
		}

		function deleteDummyImage(entry) {
			setSelected(null);
			$rootScope.$broadcast('imageUpdate', entry.source, true);
			entry.source.$deleteDummy()
				.then(function (response) {
					console.log(response);
					scene.remove(entry.object);
					octree.remove(entry.object.collisionObject);
					spatialImages.remove(entry);
					entry.dispose();
					console.log(entry);
					animateAsync();
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.$deleteDummy', reason);
				});
		}


		///// HEAT MAP

		// listen to viewportHeatMapUpdate event
		scope.$on('viewportHeatMapUpdate', function (event, options) {
			if (!options) return;

			if (options.typeChange) {
				if (heatMap && (options.type !== 'heatMap' || !options.visible)) {
					scene.remove(heatMap);
					heatMap.dispose();
					heatMap = null;
				}
				if (objHeatMap && (options.type !== 'objectHeatMap' || !options.visible)) {
					// scene.remove(objHeatMap);
					objHeatMap.dispose();
					objHeatMap = null;
				}
				if (vectorField && (options.type !== 'vectorField' || !options.visible)) {
					scene.remove(vectorField);
					vectorField.dispose();
					vectorField = null;
				}
				if (windMap && (options.type !== 'windMap' || !options.visible)) {
					scene.remove(windMap);
					windMap.dispose();
					windMap = null;
					stopAnimation();
				}
				if (radarChart && (options.type !== 'radarChart' || !options.visible)) {
					scene.remove(radarChart);
					radarChart.dispose();
					radarChart = null;
				}
				if (radialFan && (options.type !== 'radialFan' || !options.visible)) {
					scene.remove(radialFan);
					radialFan.dispose();
					radialFan = null;
				}

				if (options.visible) {
					switch (options.type) {
						case 'heatMap':
							heatMap = new DV3D.HeatMap3();
							heatMap.setRadius(options.radius);
							scene.add(heatMap);
							break;
						case 'objectHeatMap':
							objHeatMap = new DV3D.ObjectHeatMap(objects.getByName('d1_HJrdAjjfG_Zwinger').object, camera);
							// objHeatMap = new DV3D.ObjectHeatMap(objects.getByName('d1_HyHLA6jGf_node-schloss_nord').object, camera);
							break;
						case 'vectorField':
							vectorField = new DV3D.VectorField();
							scene.add(vectorField);
							break;
						case 'windMap':
							windMap = new DV3D.WindMap();
							windMap.configure({
								numParticles: 20000
							});
							windMap._useWeight = options.useWeight;
							scene.add(windMap);
							break;
						case 'radarChart':
							radarChart = new DV3D.RadarChart();
							scene.add(radarChart);
							break;
						case 'radialFan':
							// radialFan = new DV3D.RadarChart2();
							radialFan = new DV3D.RadialFan();
							scene.add(radialFan);
							break;
					}

					heatMapRadius = options.radius;
					updateHeatMap();
				}
			}

			if (options.overlayChange) {
				if (heatMap) {
					heatMap.material.depthTest = !options.overlay;
					heatMap.material.depthWrite = !options.overlay;
				}
				if (vectorField) {
					vectorField.setConfig({
						depthTest: !options.overlay,
						transparent: options.overlay
					});
				}
				if (windMap) {
					windMap.material.depthTest = !options.overlay;
					windMap.material.depthWrite = !options.overlay;
				}
			}

			if (options.radiusChange) {
				heatMapRadius = options.radius;
				if (heatMap)
					heatMap.setRadius(options.radius);
				updateHeatMap();
			}

			if (options.settingsChange) {
				if (radialFan) {
					radialFan.setAngleOffset(options.radarChartAngle);
					if (options.radarChartResolution)
						radialFan.setAngleResolution(options.radarChartResolution);
				}
				if (windMap) {
					windMap._useWeight = options.useWeight;
				}

				updateHeatMap();
			}

			animateAsync();
		});

		function updateHeatMap() {
			if (heatMap) {
				heatMap.update(camera, spatialImages.get().map(function (entry) {
					return entry.object;
				}), function (config) {
					scope.$broadcast('viewportHeatMapComplete', config);
				});

				animateAsync();
			}

			if (radarChart) {
				radarChart.update(camera, clusterTree.getActiveClusters());

				animateAsync();
			}

			if (radialFan) {
				// var obj = objects.getByName('d1_HJrdAjjfG_Zwinger').object;
				// var center = obj.geometry.boundingBox.getCenter().applyMatrix4(obj.matrixWorld);

				radialFan.update(camera, clusterTree.getActiveClusters());

				animateAsync();
			}

			if (objHeatMap) {
				objHeatMap.computeUVs();

				openProgressBar();

				objHeatMap.computeMap(function (vpCoord, object) {
					prepareRaycaster(vpCoord);
					var intersection = raycast([object]);
					if (!intersection) return 0;

					var point = intersection.point,
						normal = intersection.face.normal.clone().applyQuaternion(object.quaternion),
						count = 0;

					spatialImages.forEach(function (img) {

						var normalToImage = img.object.position.clone().sub(point).normalize();
						var normalImage = new THREE.Vector3(0,0,-1).applyQuaternion(img.object.quaternion);

						if (normal.dot(normalToImage) > 0 && normalToImage.dot(normalImage) < img.object.fov / 180 - 1) {
							var distance = point.distanceTo(img.object.position);
							raycaster.set(point.clone().add(normal), normalToImage);
							var is = raycast([object]);

							if (!is || is.distance > distance)
								count++;
						}

					}, false);
					// }, true);

					return count;
				}, function (value, total) {
					scope.$broadcast('viewportProgressUpdate', value, total);
				}, function () {
					animateAsync();
				});
			}

			if (vectorField) {
				vectorField.update(camera, function (position) {
					var or = octree.search(position, heatMapRadius);

					var count = 0, disTmp = 0, disMin = heatMapRadius;
					var dir = new THREE.Vector3();
					var items = [];

					or.forEach(function (r) {
						if (r.object.parent.cluster) {
							var c = r.object.parent.cluster;
							var distance = position.clone().sub(c.position).length();
							if (distance < heatMapRadius + c.distance)
								items = items.concat(c.getLeaves());
						}
						else
							items.push(r.object.parent);
					});

					items.forEach(function (item) {
						// var distance = position.clone().sub(r.position).length();
						var distance = position.clone().sub(item.position).length();
						if (distance < heatMapRadius) {
							// dir.add(new THREE.Vector3(0, 0, -1).applyQuaternion(r.object.parent.quaternion));
							dir.add(new THREE.Vector3(0, 0, -1).applyQuaternion(item.quaternion));
							count++;
							disTmp += distance;
							disMin = Math.min(disMin, distance);
						}
					});

					return {
						direction: dir.normalize(),
						count: count,
						disWeight: 1 - disMin / heatMapRadius,
						dirWeight: 1 - (disTmp / heatMapRadius) / count
					};
				}, function (config) {
					scope.$broadcast('viewportHeatMapComplete', config);
				});

				animateAsync();
			}

			if (windMap) {
				windMap.update(camera, function (position) {
					var or = octree.search(position, heatMapRadius);

					var count = 0, disTmp = 0, disMin = heatMapRadius;
					var dir = new THREE.Vector3();

					var items = [];
					or.forEach(function (r) {
						if (r.object.parent.cluster) {
							var c = r.object.parent.cluster;
							var distance = position.clone().sub(c.position).length();
							if (distance < heatMapRadius + c.distance)
								items = items.concat(c.getLeaves());
						}
						else
							items.push(r.object.parent);
					});

					items.forEach(function (item) {
						// var distance = position.clone().sub(r.position).length();
						var distance = position.clone().sub(item.position).length();
						if (distance < heatMapRadius) {
							// dir.add(new THREE.Vector3(0, 0, -1).applyQuaternion(r.object.parent.quaternion));
							dir.add(new THREE.Vector3(0, 0, -1).applyQuaternion(item.quaternion));
							count++;
							disTmp += distance;
							disMin = Math.min(disMin, distance);
						}
					});

					return {
						direction: dir.normalize(),
						count: count,
						disWeight: 1 - disMin / heatMapRadius,
						dirWeight: 1 - (disTmp / heatMapRadius) / count
					};
				}, function (config) {
					scope.$broadcast('viewportHeatMapComplete', config);
				});

				startAnimation();
			}
		}
		var updateHeatMapAsync = $debounce(updateHeatMap, 500);


		///// SPATIAL IMAGES

		// listen to spatialImageLoadStart event
		scope.$on('spatialImageLoadStart', function (event, images) {

			setSelected(null);

			isLoading = true;

			var toBeCreated = [],
				toBeUpdated = [],
				toBeRemoved = [];

			var newImages;
			if (Array.isArray(images))
				newImages = images;
			else
				newImages = [images];

			// look if search results are already part of entries or not
			newImages.forEach(function (img) {
				if (!img.spatial) return;
				var si = spatialImages.getByName(img.spatial.id);
				if (si)
					toBeUpdated.push({
						entry: si,
						resource: img
					});
				else
					toBeCreated.push(img);
			});

			// get all entries that are not part of search results anymore
			spatialImages.forEach(function (entry) {
				if (!newImages.find(function (img) {
					if (!img.spatial) return false;
					return entry.name === img.spatial.id;
				}))
					toBeRemoved.push(entry);
			});

			clusterTree.clean();

			// remove "missing" images
			toBeRemoved.forEach(function (value) {
				// scene.remove(value.object);
				// octree.remove(value.object.collisionObject);
				spatialImages.remove(value);
				value.dispose();
			});

			// update still existing images
			toBeUpdated.forEach(function (value) {
				value.entry.source = value.resource;
				value.entry.object.userData.source = value.resource;
			});

			// load spatial images for new results
			var promises = [];
			toBeCreated.forEach(function (value) {
				promises.push(loadSpatialImage(value));
			});

			// broadcast event when all images have been loaded
			$q.all(promises)
				.then(function () {
					$rootScope.$broadcast('spatialImageLoadSuccess');
					console.log(octree);
					//console.log(rbushTree);
					// addRBushGraph();
					// $timeout(addOctreeGraph, 500);
					// buildCluster();
					clusterTree.bulkInsert(spatialImages.get().map(function (si) {
						return si.object;
					}));
					// clusterTree.drawDebugGraph();

					isLoading = false;

					// clusterTree.update(camera);

					// clusterTree.getObjectsByThreshold(50, function (obj) {
					// 	console.log(obj.count);
					// 	var sphere;
					// 	if (obj instanceof DV3D.ClusterObject)
					// 		sphere = new THREE.Mesh(new THREE.SphereBufferGeometry(5), new THREE.MeshLambertMaterial({color: 0xffff00}));
					// 	else
					// 		sphere = new THREE.Mesh(new THREE.SphereBufferGeometry(3), new THREE.MeshLambertMaterial({color: 0xff0000}));
					// 	sphere.position.copy(obj.position);
					// 	scene.add(sphere);
					// });
					animateAsync();
				})
				.catch(function (reason) {
					Utilities.throwException('Spatial Image Loading Error', 'An error occurred while loading spatial image', reason);
				});

			updateHeatMap();
		});


		/**
		 * Loads spatialized image into the scene.
		 * @param img
		 */
		function loadSpatialImage(img) {
			if (!img.spatial)
				return $q.reject('No spatial information');

			var defer = $q.defer();

			// ImagePane instance
			var imagepane = new DV3D.ImagePane('data/' + img.file.path + img.file.preview, {
				width: img.file.width,
				height: img.file.height,
				ck: img.spatial.ck,
				offset: img.spatial.offset,
				preview: 'data/' + img.file.path + img.file.thumb
			});

			imagepane.onComplete = function () {
				if (viewportSettings.images.opacity !== 1.0)
					entry.setOpacity(viewportSettings.images.opacity);
				entry.setScale(viewportSettings.images.scale);
				animateAsync();
				defer.resolve(entry);
			};

			var matrix = new THREE.Matrix4().fromArray(img.spatial.matrix);
			imagepane.applyMatrix(matrix);


			// scene.add(imagepane);

			defer.promise.then(function () {
				// octree.add(imagepane.collisionObject);
				// updateOctreeAsync();

				// rbushTree.insert({
				// 	x: imagepane.position.x,
				// 	y: imagepane.position.z,
				// 	image: imagepane
				// });
			});

			imagepane.name = img.spatial.id;
			imagepane.userData.source = img;
			imagepane.userData.type = 'image';

			var entry = new DV3D.ImageEntry(imagepane, img.title);
			entry.addEventListener('change', animateAsync);
			entry.addEventListener('toggle', toggleSourceHandler);
			entry.addEventListener('select', selectHandler);
			entry.addEventListener('focus', focusHandler);

			spatialImages.add(entry);
			//$log.debug('ImagePane', imagepane);

			return defer.promise;
		}

		/**
		 * Set camera to position and angle of the image pane object.
		 * @param obj {DV3D.ImagePane} ImagePane object
		 */
		function setImageView(obj) {
			// TODO: update considering clusterTree
			exitIsolation();
			enterIsolation(obj, false);

			// new controls/rotation anchor
			var end =  new THREE.Vector3(0,0,-100);
			end.applyQuaternion(obj.quaternion);
			end.add(obj.position);

			// update near clipping plane
			var imageDistance = Math.abs(obj.image.position.z * obj.scale.z);
			if (camera.cameraP.near > imageDistance * 0.8) {
				camera.cameraP.near = imageDistance * 0.8;
				camera.updateProjectionMatrix();
			}

			new TWEEN.Tween(camera.position.clone())
				.to(obj.position, 500)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(function () { camera.position.copy(this); })
				.onComplete(function () {
					$timeout(function () {
						inIsolationMode = true;
					}, 50);
				})
				.start();
			new TWEEN.Tween(controls.target.clone())
				.to(end, 500)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(function () { controls.target.copy(this); })
				.start();
			new TWEEN.Tween({ fov: camera.fov })
				.to({ fov: obj.fov }, 500)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(function () {
					camera.fov = this.fov;
					camera.updateProjectionMatrix();
				})
				.start();

			startAnimation();
		}

		function enterIsolation(obj, setFlag) {
			spatialImages.forEach(function (item) {
				if (item.object !== obj)
					item.toggle(false);
			}, true);
			if (setFlag !== false)
				inIsolationMode = true;
			scope.$broadcast('viewportIsolationEnter');
		}

		function exitIsolation() {
			if (!inIsolationMode) return;
			// spatialImages.forEach(function (item) {
			// 	item.toggle(true);
			// });
			inIsolationMode = false;
			scope.$broadcast('viewportIsolationExit');
		}

		// if (scope.hud.spatialize) {
		// 	SpatializeInterface.callFunc[cfId].loadSpatializeImage = loadSpatializeImage;
		// 	SpatializeInterface.callFunc[cfId].setImageView = setImageView;
		// 	scope.spatialize = {
		// 		markers: SpatializeInterface.markers3D
		// 	};
		// 	scope.startMarking = startMarking;
		// 	scope.clearMarkers = clearMarkers;
		// }


		///// PLANS

		/**
		 * Load spatialized plan into the scene.
		 * @param obj
		 */
		function load3DPlan(obj) {
			if(plans.getByName(obj.info.content)) return;

			var plan = new DV3D.Plan('data/' + obj.file.path + obj.file.content, 'data/' + obj.info.materialMapPath + obj.info.materialMap, obj.info.scale);
			plan.onComplete = function () {
				animate();
			};
			scene.add(plan);

			plan.name = obj.info.content;
			plan.userData.name = obj.info.materialName;
			plan.userData.source = obj.source;
			plan.userData.type = 'plan';

			var entry = new DV3D.PlanEntry(plan);
			plan.entry = entry;
			plans.add(entry);
			console.log('Plan', plan);
		}

		/**
		 * set camera to orthogonal view to fit plan to viewport
		 * @param obj
		 */
		function viewOrthoPlan(obj) {
			// TODO: revise

			var pgeo = obj.mesh.geometry;
			var matWorld = obj.mesh.matrixWorld;

			//console.log(pgeo);

			var q = new THREE.Quaternion().setFromRotationMatrix(matWorld);
			var normal = new THREE.Vector3(pgeo.attributes.normal.array[0], pgeo.attributes.normal.array[1], pgeo.attributes.normal.array[2]).applyQuaternion(q);

			var boundingBox = pgeo.boundingBox.clone().applyMatrix4(matWorld);

			// Ausmaße im Raum
			var aspect = SCREEN_WIDTH/SCREEN_HEIGHT;
			var pwidth = Math.sqrt( Math.pow(boundingBox.max.x - boundingBox.min.x, 2) + Math.pow(boundingBox.max.z - boundingBox.min.z, 2) ) / 2;
			var pheight = (boundingBox.max.y - boundingBox.min.y) / 2;

			if(normal.y > 0.707 || normal.y < -0.707) {
				pwidth = Math.sqrt( Math.pow(boundingBox.max.x - boundingBox.min.x, 2) + Math.pow(boundingBox.max.y - boundingBox.min.y, 2) ) / 2;
				pheight = (boundingBox.max.z - boundingBox.min.z) / 2;
			}

			if(aspect < pwidth/pheight)
				pheight = 1/aspect * pwidth;

			// Abstand zum Bild (abhängig von Kamerawinkel)
			var h = pheight / Math.tan( camera.fov/2 * Math.PI / 180 );

			var bsCenter = pgeo.boundingSphere.center.clone().applyMatrix4(matWorld);

			var newpos = new THREE.Vector3();
			newpos.addVectors(bsCenter, normal.setLength(h));

			// Kamerafahrt zur Ansicht
			new TWEEN.Tween(camera.position.clone())
				.to(newpos, 500)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(function () { camera.position.copy(this); })
				.start();
			new TWEEN.Tween(controls.target.clone())
				.to(bsCenter, 500)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(function () { controls.target.copy(this); })
				.onComplete(function() {
					camera.toOrthographic(controls.target);
					scope.$apply();
				})
				.start();

			startAnimation();
		}

		// add or remove plan or spatialImage from scene
		function toggleSourceHandler(event) {
			console.log(event);
			var target = event.target;
			// add
			if (event.visible) {
				if (scene.getObjectById(target.object.id))
					return; // already part of scene

				scene.add(target.object);
			}
			// remove
			else {
				scene.remove(target.object);
				setSelected(target, false, true);
			}

			animateAsync();
		}


		/**
		 * attach gizmo to object
		 * @param {THREE.Object3D} [obj] - object to be transformed
		 * @param {string} [type] - type of gizmo ('move'|'rotate')
		 * @param {THREE.Object3D[]} [refs] - references to objects which need to be transformed too
		 */
		function setGizmo(obj, type, refs) {
			if (gizmo)
				gizmo.attachToObject(null);

			switch (type) {
				case 'move': gizmo = gizmoMove; break;
				case 'rotate': gizmo = gizmoRotate; break;
				default: gizmo = null; break;
			}

			if (gizmo)
				gizmo.attachToObject(obj, refs);
		}


		///// LOADING

		// listen to modelQuerySuccess event, start loading objects
		scope.$on('modelQuerySuccess', function (event, entries) {
			resetScene();
			ctmloader.manager.reset();

			viewportLoadProgress('init', 0, 1);

			loadHierarchyObjects(entries)
				.then(function () {
					$log.debug('objects loaded');
				})
				.catch(function (err) {
					Utilities.throwException('Loading Error', 'An error occurred while loading objects. See concole for details.', err);
				});
		});

		function loadHierarchyObjects(nodes) {
			return nodes.reduce(function (promise, node) {
				return promise
					.then(function () {
						return loadObject(node);
					})
					.then(function () {
						return loadHierarchyObjects(node.children);
					});
			}, $q.resolve());
		}

		// load object as ctm file
		function loadObject(entry) {
			var defer = $q.defer();

			// create instance
			var obj;
			switch (entry.obj.type) {
				case 'group':
					obj = new THREE.Group();
					break;
				case 'object':
					obj = new THREE.Mesh(geometries['initGeo'], materials['defaultMat']);
					break;
				default:
					defer.reject('Unsupported type');
					return defer.promise;
			}

			var matrix = new THREE.Matrix4();
			matrix.fromArray(entry.obj.matrix);

			// transformation from z-up-world to y-up-world
			if (entry.obj.up === 'Z' && !entry.parent) {
				var yupMatrix = new THREE.Matrix4();
				yupMatrix.set(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1);
				matrix.multiplyMatrices(yupMatrix, matrix);
			}

			var t = new THREE.Vector3();
			var q = new THREE.Quaternion();
			var s = new THREE.Vector3();
			matrix.decompose(t,q,s);

			var scale = typeof entry.obj.unit === 'number' ? entry.obj.unit : 1.0;
			// apply scale only to translation and scale and if there is no parent
			if (!entry.parent) {
				t.multiplyScalar(scale);
				s.multiplyScalar(scale);
			}

			matrix.compose(t, q, s);
			obj.applyMatrix(matrix);
			obj.matrixAutoUpdate = false;

			// set additional data
			obj.name = entry.obj.id;
			obj.userData.id = entry.obj.id;
			obj.userData.name = entry.obj.name;
			obj.userData.type = entry.obj.type;
			obj.userData.layer = entry.obj.layer;
			// obj.userData.categories = entry.obj.categories;

			// add to scene or parent
			var parent = null;
			if (entry.parent) parent = scene.getObjectByName(entry.parent, true);
			if (parent) parent.add(obj);
			else scene.add(obj);


			// create ObjectEntry and add to collection
			var objentry = new DV3D.ObjectEntry(obj);
			objentry.addEventListener('change', animateAsync);
			objentry.addEventListener('toggle', toggleObjectHandler);
			objentry.addEventListener('focus', focusHandler);
			objentry.addEventListener('select', selectHandler);

			objects.add(objentry);

			// load geometry / ctm file
			if (entry.obj.type === 'object') {
				var geomId = Array.isArray(entry.file.mesh) ?
					entry.file.mesh.reduce(function (acc, next) { return acc + next;	}) :
					entry.file.mesh;

				// if geometry already exists, use this one
				if (geomId in geometries)
					ctmHandler(geometries[geomId].mesh);

				// load multi-material objects
				if (Array.isArray(entry.file.mesh)) {
					var geoParts = [];
					entry.file.mesh.reduce(function (promise, file) {
						return promise.then(function () {
							var deferGeo = $q.defer();

							ctmloader.load('data/' + entry.file.path + file, function (geo) {
								geoParts.push(geo);
								deferGeo.resolve();
							}, { useWorker: false });

							return deferGeo.promise;
						});
					}, $q.resolve())
						.then(function () {
							ctmHandler(geoParts);
						});
				}

				// load normal objects
				else
					ctmloader.load('data/' + entry.file.path + entry.file.mesh, ctmHandler, { useWorker: false });
			}

			defer.resolve();


			function ctmHandler(geometry) {

				// merge geometry parts
				if (Array.isArray(geometry)) {
					var geometryParts = geometry;
					geometry = geometryParts[0];
					geometry.clearGroups();
					geometry.addGroup(0, geometry.index.count, 0);

					for (var i = 1; i < geometryParts.length; i++) {
						geometry.merge(geometryParts[i]);
						var count = geometryParts[i].index.count;
						geometry.addGroup(geometry.index.count - count, count, i);
						geometryParts[i].dispose();
					}

					if (!geometry.name) geometry.name = entry.file.mesh.reduce(function (acc, next) {
						return acc + next;
					});
				}
				else {
					geometry.clearGroups();
					geometry.addGroup(0, geometry.index.count, 0);

					if (!geometry.name) geometry.name = entry.file.mesh;
				}

				// add to geometry list
				if (!(geometry.name in geometries)) {
					geometries[geometry.name] = { mesh: geometry };
				}

				geometry.computeBoundingBox();

				obj.geometry = geometry;

				// set material
				if (entry.materials && Array.isArray(entry.materials)) {
					if (entry.materials.length !== 1) {
						obj.material = entry.materials.map(prepareMaterial);
						obj.userData.originalMat = entry.materials.map(function (m) {
							return m.id;
						});
					}
					else {
						obj.material = prepareMaterial(entry.materials[0]);
						obj.userData.originalMat = entry.materials[0].id;
					}
				}
				else {
					obj.material = materials['defaultDoublesideMat'];
					obj.userData.originalMat = 'defaultDoublesideMat';
				}

				// load edges of normal object
				if (entry.file.edges && !Array.isArray(entry.file.edges)) {
					loadEdges('data/' + entry.file.path + entry.file.edges)
						.then(function (edgesGeo) {
							var edges = new THREE.LineSegments(edgesGeo, materials['edgesMat']);
							edges.matrix = obj.matrixWorld;
							edges.matrixAutoUpdate = false;

							scene.add(edges);
							geometries[geometry.name].edges = edgesGeo;
							// objects[obj.id].edges = edges;
							objentry.addEdges(edges);
							animateThrottle500();
						})
						.catch(function (err) {
							if (err)
								Utilities.throwException('Loading Error', 'Some error occurred while loading objects. See console for details.', err);
						});
				}
				// load edges of multi-material object
				else if (entry.file.edges && Array.isArray(entry.file.edges)) {
					var edgesParts = [];
					entry.file.edges.reduce(function (promise, file) {
						return promise.then(function () {
							return loadEdges('data/' + entry.file.path + file)
								.then(function (edgesGeo) {
									edgesParts.push(edgesGeo);
									return $q.resolve();
								});
						});
					}, $q.resolve())
						.then(function () {
							var edgesGeo = edgesParts[0];
							for (var i = 1; i < edgesParts.length; i++) {
								edgesGeo.merge(edgesParts[i]);
								edgesParts[i].dispose();
							}

							var edges = new THREE.LineSegments(edgesGeo, materials['edgesMat']);
							edges.matrix = obj.matrixWorld;
							edges.matrixAutoUpdate = false;

							scene.add(edges);
							geometries[geometry.name].edges = edgesGeo;
							// objects[obj.id].edges = edges;
							objentry.addEdges(edges);
							animateThrottle500();
						})
						.catch(function (err) {
							if (err)
								Utilities.throwException('Loading Error', 'Some error occurred while loading objects. See console for details.', err);
						});
				}

				animateThrottle500();
			}

			return defer.promise;
		}

		function prepareMaterial(m) {
			// if material with id/name already exists, use existing instance
			if (m.id in materials)
				return materials[m.id];

			// else create new material instance
			var material = new THREE.MeshLambertMaterial();
			material.name = m.id;

			// set diffuse color/map
			if (Array.isArray(m.diffuse)) {
				material.color = new THREE.Color(m.diffuse[0], m.diffuse[1], m.diffuse[2]);
				material.color.convertLinearToGamma();
			}
			else if (typeof m.diffuse === 'string') {
				textureLoader.load('data/' + m.path + m.diffuse, function (map) {
					material.map = map;
					material.needsUpdate = true;
				}, null, function (xhr) {
					$log.warn('Couldn\'t load texture', xhr.path[0].src);
				});
			}

			// set alpha map
			if (m.alpha) {
				textureLoader.load('data/' + m.path + m.alpha, function (map) {
					material.alphaMap = map;
					material.transparent = true;
					material.needsUpdate = true;
				}, null, function (xhr) {
					$log.warn('Couldn\'t load texture', xhr.path[0].src);
				});

			}

			material.side = THREE.DoubleSide;

			// add to materials list
			materials[m.id] = material;

			return material;
		}

		// load edges from zipped json file
		function loadEdges(file) {
			var defer = $q.defer();

			JSZipUtils.getBinaryContent(file, function (err, data) {
				if (err) {
					defer.reject(err);
					return;
				}

				JSZip.loadAsync(data)
					.then(function (zip) {
						var files = zip.file(/.+\.json$/i);
						return files[0].async('text');
					})
					.then(function (json) {
						json = JSON.parse(json);
						var vertices = new Float32Array(json.data.attributes.position.array);
						var geometry = new THREE.BufferGeometry();
						geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
						defer.resolve(geometry);
					})
					.catch(function (err) {
						Utilities.throwException('JSZip Error', 'Failed to load or extract zip file.', err);
						defer.reject();
					});
			});

			return defer.promise;
		}

		// clear scene and dispose geometries and materials
		function resetScene() {
			// remove from scene and collection
			[].concat(objects.list).forEach(function (obj) {
				obj.object.parent.remove(obj.object);
				if (obj.edges) scene.remove(obj.edges);
				objects.remove(obj);
				obj.dispose();
			});

			// dispose geometries
			for (var key in geometries) {
				if (!geometries.hasOwnProperty(key)) continue;
				if (viewportCache.standardGeometries.indexOf(key) !== -1) continue;
				if (geometries[key].mesh) geometries[key].mesh.dispose();
				if (geometries[key].edges) geometries[key].edges.dispose();
				delete geometries[key];
			}

			// dispose materials
			for (key in materials) {
				if (!materials.hasOwnProperty(key)) continue;
				if (viewportCache.standardMaterials.indexOf(key) !== -1) continue;
				if (materials[key].map) materials[key].map.dispose();
				if (materials[key].alphaMap) materials[key].alphaMap.dispose();
				materials[key].dispose();
				delete materials[key];
			}

			animate();
		}


		///// OBJECT EVENTS

		// add or remove mesh and edges from parent or scene
		function toggleObjectHandler(event) {
			var target = event.target;
			var parent = target.parent ? target.parent.object : scene;

			// toggle parent if hidden
			if (event.visible && target.parent && !target.parent.visible) {
				target.parent.visible = true;
				toggleObjectHandler({ target: target.parent, visible: true });
			}

			// add
			if (event.visible) {
				if (parent.getObjectById(target.object.id))
					return; // already part of parent

				parent.add(target.object);
				if (viewportSettings.showEdges && target.edges)
					scene.add(target.edges);
			}
			// remove
			else {
				parent.remove(target.object);
				if (viewportSettings.showEdges && target.edges)
					scene.remove(target.edges);
				setSelected(target, false, true);
			}

			animateAsync();
		}

		// focus event handler
		function focusHandler(event) {
			if (event.target.object) {
				var obj = event.target.object;
				if (obj instanceof DV3D.ImagePane)
					setImageView(obj);
				else if (obj instanceof DV3D.Plan)
					viewOrthoPlan(obj);
				else
					focusSelection([event.target]);
			}
		}

		// select event handler
		function selectHandler(event) {
			setSelected(event.target, event.originalEvent.ctrlKey);
		}

		function addChildren(children) {
			for(var i=0; i<children.length; i++) {
				var cid = children[i].id;
				scene.add(objects[cid].edges);
				objects[cid].visible = true;
				addChildren(children[i].children);
			}
		}

		function removeChildren(children) {
			for(var i=0; i<children.length; i++) {
				var cid = children[i].id;
				scene.remove(objects[cid].edges);
				objects[cid].visible = false;
				removeChildren(children[i].children);
			}
		}


		///// FOCUS OBJECTS

		// listen to viewportFocusStart event
		scope.$on('viewportFocusStart', function (event, mode) {
			if (camera.inOrthographicMode) return;
			switch (mode) {
				case 'selected': focusSelection(selected); break;
				default: focusAll();
			}
		});

		// focus selected objects
		function focusSelection(array) {
			if (array.length < 1) return;

			if (array.length === 1 && array[0] instanceof DV3D.ImageEntry) {

				setImageView(array[0].object);
				return;
			}

			var cc = [];
			function collectChildren(children) {
				for (var i = 0; i < children.length; i++) {
					collectChildren(children[i].children);
					// TODO: include pictures
					if (children[i].type === 'object' || children[i].type === 'plan')
						cc.push(children[i].object);
				}
			}
			collectChildren(array);
			focusObjects(cc);
		}

		// focus all objects
		function focusAll() {
			var cc = [];
			objects.forEach(function (obj) {
				if (obj.type === 'object')
					cc.push(obj.object);
			}, true);
			if (cc.length < 1) return;
			focusObjects(cc);
		}

		// focus given objects
		function focusObjects(objs) {
			// determine maximum bounding box/sphere
			var boundingBox = new THREE.Box3();
			objs.forEach(function (obj) {
				boundingBox.expandByObject(obj);
			});
			var boundingSphere = boundingBox.getBoundingSphere();

			// calculate new camera.position and controls.target
			var s = new THREE.Vector3().subVectors(camera.position, controls.target);
			var h = boundingSphere.radius / Math.tan( camera.fov / 2 * THREE.Math.DEG2RAD );
			var newpos = new THREE.Vector3().addVectors(boundingSphere.center, s.setLength(h));

			// adjust camera frustum (near, far)
			camera.cameraP.near = boundingSphere.radius / 100;
			camera.cameraP.far = Math.max(boundingSphere.radius * 100, viewportSettings.defaults.FAR);
			camera.updateProjectionMatrix();

			// animate camera.position and controls.target
			new TWEEN.Tween(camera.position.clone())
				.to(newpos, 500)
				.easing(TWEEN.Easing.Cubic.InOut)
				.onUpdate(function () { camera.position.copy(this); })
				.start();

			new TWEEN.Tween(controls.target.clone())
				.to(boundingSphere.center, 500)
				.easing(TWEEN.Easing.Cubic.InOut)
				.onUpdate(function () { controls.target.copy(this); })
				.start();

			startAnimation();

			// TODO: focus in orthographic view
			// if (scope.viewportSettings.camera === 'top')
			// 	orthocam.position.set(M.x, 50, M.z);
			// else if (scope.camera === 'front')
			// 	orthocam.position.set(M.x, M.y, 50);
			// else if (scope.camera === 'left')
			// 	orthocam.position.set(-50, M.y, M.z);
		}

		// tween camera facing north
		function faceNorth() {
			var offset = new THREE.Vector3(camera.position.x, controls.target.y, camera.position.z).sub(controls.target),
				radius = offset.length();

			// angle from z-axis around y-axis
			var theta = Math.atan2( offset.x, offset.z );

			// tween theta to `0` and apply new angle to camera
			new TWEEN.Tween({theta: theta})
				.to({theta: 0}, 1000)
				.easing(TWEEN.Easing.Cubic.InOut)
				.onUpdate(function () {
					offset.x = radius * Math.sin( this.theta );
					offset.y = camera.position.y;
					offset.z = radius * Math.cos( this.theta );

					camera.position.copy(new THREE.Vector3(controls.target.x, 0, controls.target.z)).add(offset);
				})
				.start();

			startAnimation();
		}

		// resize viewport
		function resizeViewport() {
			SCREEN_WIDTH = element.width();
			SCREEN_HEIGHT = element.height();
			$log.debug('resize called', SCREEN_WIDTH, SCREEN_HEIGHT);

			camera.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
			camera.cameraP.updateProjectionMatrix();

			renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);

			animate();
		}


		///// DESTROY

		scope.$on('$destroy', function() {
			setSelected(null, false, true);
			spatialImages.dehighlight();
			clearMarked();
			exitIsolation();
			//if (scope.snapshot.active) scope.abortSnapshot();

			if (scope.spatialize)
				clearMarkers();

			if (heatMap) {
				scene.remove(heatMap);
				heatMap.dispose();
			}

			// unbind functions from callFunc
			delete SpatializeInterface.callFunc[cfId];

			// save camera and controls position
			if (!viewportCache.viewpoint) viewportCache.viewpoint = {
				cameraPosition: new THREE.Vector3(),
				controlsTarget: new THREE.Vector3()
			};
			viewportCache.viewpoint.cameraPosition.copy(camera.position);
			viewportCache.viewpoint.controlsTarget.copy(controls.target);

			controls.dispose();

			renderer.forceContextLoss();
			renderer.dispose();

			// unbind event listeners
			var windowElement = angular.element($window);
			windowElement.off('keydown', keydown);
			windowElement.off('keyup', keyup);
			windowElement.off('resize', resizeViewport);

			// remove event listeners from entries
			objects.forEach(function (entry) {
				entry.removeEventListener('change', animateAsync);
				entry.removeEventListener('toggle', toggleObjectHandler);
				entry.removeEventListener('focus', focusHandler);
				entry.removeEventListener('select', selectHandler);
			});

			spatialImages.forEach(function (entry) {
				entry.removeEventListener('change', animateAsync);
				entry.removeEventListener('toggle', toggleSourceHandler);
				entry.removeEventListener('focus', focusHandler);
				entry.removeEventListener('select', selectHandler);
			});

			$log.debug('destroy viewport directive');
		});

	}]

});

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
 * @param spatializeManual {boolean} Enable image spatialization functionality
 */
.directive('viewport', ['$state', '$window', '$timeout', 'viewportCache', 'viewportSettings', '$rootScope', '$q', 'Utilities', '$debounce', '$throttle', 'SpatializeInterface', '$log', '$compile', '$animate',
	function($state, $window, $timeout, viewportCache, viewportSettings, $rootScope, $q, Utilities, $debounce, $throttle, SpatializeInterface, $log, $compile, $animate) {

		function link(scope, element, attrs) {

			console.log(scope, attrs);

			var cfId = attrs.id || 0;
			SpatializeInterface.callFunc[cfId] = {};

			// activate features and huds
			scope.hud = {
				navigation: 'navToolbar' in attrs,
				axis: 'axis' in attrs,
				focus: false,
				move: false,
				shading: false,
				camera: false,
				options: 'optionToolbar' in attrs,
				spatialize: 'spatialize' in attrs
			};

			angular.forEach(scope.navToolbar, function (value) {
				scope.hud[value] = true;
			});

			//scope.spatialize = 'spatialize' in attrs;
			var enableSpatializeManual = 'spatializeManual' in attrs;

			var contextMenuElement = null;

			// constants frustum clipping
			var NEAR = viewportSettings.defaults.NEAR;
			var FAR = viewportSettings.defaults.FAR;

			// global variables
			// general
			var SCREEN_WIDTH, SCREEN_HEIGHT;
			var canvas;
			var renderer, scene, controls;
			var camera;
			var raycaster = new THREE.Raycaster();
			var dlight;
			var octree, kdtree;

			//var postprocessing = {};

			var selected = [], highlighted = [], marked = [];
			var pins = [];
			var highlightedImages = [];

			var ctmloader, textureLoader;

			// Gizmo, Slice, Messen
			var gizmo, gizmoMove, gizmoRotate;

			var measureTool, pin, heatMap, vectorField, olic, windMap;
			var heatMapRadius = 0;

			// Shading-Konstanten
			// var shading = {
			// 	COLOR_EDGE: 'color+edges',
			// 	GREY_EDGE: 'grey+edges',
			// 	COLOR: 'color-edges',
			// 	EDGE: 'edges',
			// 	TRANSPARENT_EDGE: 'transparent+edges',
			// 	COLOR_WIRE: 'color+wireframe',
			// 	WIRE: 'wireframe',
			// 	XRAY: 'xray'
			// };

			// var pcConfig = {
			// 	clipMode: Potree.ClipMode.HIGHLIGHT_INSIDE,
			// 	isFlipYZ: false,
			// 	useDEMCollisions: false,
			// 	generateDEM: false,
			// 	minNodeSize: 100,
			// 	// pointBudget: 1000000,
			// 	edlStrength: 1.0,
			// 	edlRadius: 1.4,
			// 	useEDL: false,
			// 	classifications: {
			// 		0: { visible: true, name: 'never classified' },
			// 		1: { visible: true, name: 'unclassified' },
			// 		2: { visible: true, name: 'ground' },
			// 		3: { visible: true, name: 'low vegetation' },
			// 		4: { visible: true, name: 'medium vegetation' },
			// 		5: { visible: true, name: 'high vegetation' },
			// 		6: { visible: true, name: 'building' },
			// 		7: { visible: true, name: 'low point(noise)' },
			// 		8: { visible: true, name: 'key-point' },
			// 		9: { visible: true, name: 'water' },
			// 		12: { visible: true, name: 'overlap' }
			// 	}
			// };
			// Potree.pointBudget = 500000;

			var isAnimating = false;

			// navigation flags
			var mouseDownCoord = new THREE.Vector2(),
				mouseDownEvent = null;
			var isMouseDown = -1,
				isRotatingView = false,
				isZoomingView = false,
				isPanningView = false;
			scope.navigation = {'default': true, rotate: false, pan: false, zoom: false};
			var navigation = scope.navigation;

			var isSelecting = false,
				isPinning = false,
				isMarking = false;

			var currentMarker;


			// Übernahme aus viewportCache
			var objects = viewportCache.objects;
			var pointclouds = [];
			var plans = viewportCache.plans;
			var spatialImages = viewportCache.spatialImages;
			var geometries = viewportCache.geometries;
			var materials = viewportCache.materials;

			// Initialisierung des Ganzen
			$timeout(function () {
				init();
			});
			function init() {

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
				// if (viewportCache.viewpoint) controls.center = viewportCache.viewpoint.controlsPosition.clone();
				if (viewportCache.viewpoint) controls.center.copy(viewportCache.viewpoint.controlsCenter);
				camera.target = controls.center;
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


				// octree
				octree = new THREE.Octree({
					//scene: scene
					//depthMax: 16,
					//objectsThreshold: 8
					//undeferred: true
				});


				// sky
				var skyGeo = new THREE.SphereBufferGeometry(4000, 32, 15);
				/// noinspection JSAnnotator
				var skyMat = new THREE.ShaderMaterial({
					vertexShader: '\
						varying vec3 vWorldPosition;\
						\
						void main() {\
							vec4 worldPosition = modelMatrix * vec4(position, 1.0);\
							vWorldPosition = worldPosition.xyz;\
							gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\
						}',
					fragmentShader: '\
						uniform vec3 topColor;\
						uniform vec3 horizonColor;\
						uniform vec3 bottomColor;\
						uniform float offset;\
						uniform float topExponent;\
						uniform float bottomExponent;\
						varying vec3 vWorldPosition;\
						\
						void main() {\
							float h = normalize(vWorldPosition + offset).y;\
							if (h > 0.0)\
								gl_FragColor = vec4( mix( horizonColor, topColor, max( pow( h, topExponent ), 0.0 ) ), 1.0);\
							else\
								gl_FragColor = vec4( mix( horizonColor, bottomColor, max( pow( abs(h), bottomExponent ), 0.0 ) ), 1.0);\
						}',
					uniforms: {
						topColor: { value: new THREE.Color().setHSL(0.6, 1, 0.6) },
						horizonColor: { value: new THREE.Color(0xffffff) },
						bottomColor: { value: new THREE.Color(0x666666) },
						offset: { value: 33 },
						topExponent: { value: 0.6 },
						bottomExponent: { value: 0.3 }
					},
					side: THREE.BackSide
				});
				var sky = new THREE.Mesh(skyGeo, skyMat);
				scene.add(sky);

				// var ground = new THREE.Mesh(new THREE.PlaneBufferGeometry(10000, 10000), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
				// ground.rotation.x = -Math.PI / 2;
				// scene.add(ground);

				// Postprocessing
				//postprocessing.sampleRatio = 2;
				//var sampleRatio = 2;
				//var renderTarget = new THREE.WebGLRenderTarget(SCREEN_WIDTH, SCREEN_HEIGHT, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat});
				//var composer = new THREE.EffectComposer(renderer, renderTarget);
				//composer.setSize(SCREEN_WIDTH * sampleRatio, SCREEN_HEIGHT * sampleRatio);
				//composer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
				//var renderPass = new THREE.RenderPass(scene, camera);
				//composer.addPass(renderPass);

				// var depthShader = THREE.ShaderLib['depthRGBA'];
				// var depthUniforms = THREE.UniformsUtils.clone(depthShader.uniforms);
				//
				// postprocessing.depthMaterial = new THREE.ShaderMaterial({ fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms });
				// postprocessing.depthMaterial.blending = THREE.NoBlending;

				//postprocessing.depthTarget = new THREE.WebGLRenderTarget(SCREEN_WIDTH * sampleRatio, SCREEN_HEIGHT * sampleRatio, {minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat});
				// postprocessing.depthTarget = new THREE.WebGLRenderTarget(SCREEN_WIDTH * sampleRatio, SCREEN_HEIGHT * sampleRatio, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat});
				//
				// var ssaoPass = new THREE.ShaderPass(THREE.SSAOShader);
				// ssaoPass.uniforms['tDepth'].value = postprocessing.depthTarget;
				// ssaoPass.uniforms['size'].value.set(SCREEN_WIDTH * sampleRatio, SCREEN_HEIGHT * sampleRatio);
				// ssaoPass.uniforms['cameraNear'].value = camera.near;
				// ssaoPass.uniforms['cameraFar'].value = camera.far;
				//ssaoPass.renderToScreen = true;
				// composer.addPass(ssaoPass);


				// var fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
				// fxaaPass.uniforms['resolution'].value.set(1/SCREEN_WIDTH, 1/SCREEN_HEIGHT);
				// //fxaaPass.renderToScreen = true;
				// fxaaPass.enabled = true;
				// //composer.addPass(fxaaPass);
				//
				//
				// var copyPass = new THREE.ShaderPass(THREE.CopyShader);
				// copyPass.renderToScreen = true;
				// composer.addPass(copyPass);

				//postprocessing.composer = composer;
				//console.log(composer);

				// neu
				//var renderTarget = new THREE.WebGLRenderTarget(SCREEN_WIDTH, SCREEN_HEIGHT, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat});
				// var composer = new THREE.EffectComposer(renderer);
				// composer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
				// var renderPass = new THREE.RenderPass(scene, camera);
				// composer.addPass(renderPass);

				// var maskPass = new THREE.MaskPass(scene, camera);
				// composer.addPass(maskPass);

				// var sobelPass = new THREE.ShaderPass(THREE.EdgeShader2);
				// sobelPass.uniforms['aspect'].value.set(SCREEN_WIDTH, SCREEN_HEIGHT);
				// composer.addPass(sobelPass);

				// var copyPass = new THREE.ShaderPass(THREE.CopyShader);
				// copyPass.renderToScreen = true;
				// composer.addPass(copyPass);
				//
				// postprocessing.composer = composer;
				// console.log(composer);

				/*objloader.load('data/steinmetzzeichen/Steinmetzzeichen_auswahl.obj', 'data/steinmetzzeichen/Steinmetzzeichen_auswahl.mtl', loadMasonMarkHandler);
			*/

				// Gizmo
				gizmoMove = new DV3D.GizmoMove(10, 2.5, 1.2);
				gizmoMove.addEventListener('change', animate);
				gizmoRotate = new DV3D.GizmoRotate(10);
				gizmoRotate.addEventListener('change', animate);
				//console.log(gizmo);

				// Schnittebene
				// var planegeo = new THREE.PlaneGeometry(50, 50);
				// var planemat = new THREE.MeshBasicMaterial( {color: 0xffff00, opacity: 0.25, transparent: true, side: THREE.DoubleSide, depthTest: true, depthWrite: false});
				// plane = new THREE.Mesh(planegeo, planemat);

				//var pedges = new THREE.EdgesHelper(plane.clone(), '#dd8888');

				//plane.add(pedges);

				//plane.position.set(-20, 10, -99);
				//plane.position.set(-20, 10, -20);
				//plane.position.set(20, 11, -38);
				//plane.translateZ(-20);
				//plane.rotateOnAxis(new THREE.Vector3(0,1,0), 1 * Math.PI);
				//plane.rotateOnAxis(new THREE.Vector3(0,1,0), 0.7 * Math.PI);
				//plane.rotateOnAxis(new THREE.Vector3(1,0,0), 0.5 * Math.PI);
				//plane.geometry.computeBoundingBox();
				//plane.add(pedges);
				//scene.add(plane);
				//console.log(plane);

				//setGizmo(plane, 'move');


				// pointcloud test
				// loadPointCloud('data/pointclouds/georgentor/cloud.js', 'potree-test', function (e) {
				// 	console.info(e);
				// 	var pc = e.pointcloud;
				// 	pointclouds.push(pc);
				// 	scene.add(pc);
				// 	pc.material.pointColorType = Potree.PointColorType.RGB;
				// 	pc.material.size = 2;
				// 	pc.material.pointSizeType = Potree.PointSizeType.FIXED;
				// 	pc.material.shape = Potree.PointShape.SQUARE;
				// 	pc.rotateOnAxis(new THREE.Vector3(1,0,0),- Math.PI / 2);
				// 	// var q = new THREE.Quaternion();
				// 	// q.setFromAxisAngle(new THREE.Vector3(1,0,0), - Math.PI / 2);
				// 	// pc.quaternion.premultiply(q);
				// 	var rotMatrix = new THREE.Matrix4();
				// 	rotMatrix.makeRotationAxis(new THREE.Vector3(1,0,0), - Math.PI / 2);
				// 	var currentPos = new THREE.Vector4(pc.position.x, pc.position.y, pc.position.z, 1);
				// 	var newPos = currentPos.applyMatrix4(rotMatrix);
				// 	pc.position.set(newPos.x, newPos.y, newPos.z);
				// });

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
				});

				animate();
				viewportCameraMove(camera);
			}

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


			function updatePointClouds() {
				var pointLoadLimit = 2000000;
				var visibleNodes = 0,
					visiblePoints = 0,
					progress = 0;

				for (var i=0; i<pointclouds.length; i++) {
					var pc = pointclouds[i];
					var bbWorld = Potree.utils.computeTransformedBoundingBox(pc.boundingBox, pc.matrixWorld);

					if (!pc.material._defaultIntensityRangeChanged) {
						var root = pc.pcoGeometry.root;
						if (root !== null && root.loaded) {
							var attributes = pc.pcoGeometry.root.geometry.attributes;
							if (attributes.intensity) {
								var array = attributes.intensity.array;

								var ordered = [];
								for (var j=0; j<array.length; j++) {
									ordered.push(array[j]);
								}
								ordered.sort();
								var capIndex = parseInt((ordered.length - 1) * 0.75);
								var cap = ordered[capIndex];

								if (cap <= 1)
									pc.material.intensityRange = [0, 1];
								else if (cap <= 256)
									pc.material.intensityRange = [0, 255];
								else
									pc.material.intensityRange = [0, cap];

							}
						}
					}

					pc.material.clipMode = pcConfig.clipMode;
					pc.generateDEM = pcConfig.generateDEM;
					pc.minimumNodePixelSize = pcConfig.minNodeSize;

					visibleNodes += pc.numVisibleNodes;
					visiblePoints += pc.numVisiblePoints;

					progress += pc.progress;

					var classification = pc.material.classification;
					var somethingChanged = false;
					for (var key in pcConfig.classifications) {
						var w = pcConfig.classifications[key].visible ? 1 : 0;
						if (classification[key]) {
							if (classification[key].w !== w) {
								classification[key].w = w;
								somethingChanged = true;
							}
						}
						else if (classification.DEFAULT) {
							classification[key] = classification.DEFAULT;
							somethingChanged = true;
						}
						else {
							classification[key] = new THREE.Vector4(0.3, 0.6, 0.6, 0.5);
							somethingChanged = true;
						}
						if (somethingChanged)
							pc.material.recomputeClassification();
					}
				}

				var result = Potree.updatePointClouds(pointclouds, camera, renderer);
				visibleNodes = result.visibleNodes.length;
				visiblePoints = result.numVisiblePoints;

			}
			var updatePointCloudsThrottle = $throttle(updatePointClouds, 500, false, true);

			function loadPointCloud(path, name, callback) {
				if (!path) return;
				if (path.indexOf('cloud.js') > 0) {
					Potree.POCLoader.load(path, function (geometry) {
						if (!geometry)
							callback({ type: 'loading_failed' });
						else {
							var pc = new Potree.PointCloudOctree(geometry);
							pc.name = name;
							callback({ type: 'pointcloud_loaded', pointcloud: pc });
						}
					})
				}
			}

			function updateOctree() {
				if (renderer) renderer.render(scene, camera);
				octree.update();
			}
			var updateOctreeAsync = $debounce(updateOctree, 100);

			function onControlsChange() {
				animateThrottle20();
				viewportCameraMove(camera);
			}


			///// ANIMATION LOOP / RENDER

			/**
			 * starts animation loop
			 * @deprecated
			 */
			function enableAnimationRequest() {
				if (!isAnimating) {
					controls.removeEventListener('change', onControlsChange);
					isAnimating = true;
					animate();
				}
			}

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
					spatialImages.forEach(function (img) {
						img.updateTextureByDistance(camera.position, 30);
					}, true);
				}

				if (controls) controls.update();

				if (windMap) windMap.draw();

				//updatePointCloudsThrottle();

				// position light depending on camera
				if (dlight) {
					dlight.position.set(4, 4, 4);
					var lightMatrix = new THREE.Matrix4().makeRotationFromQuaternion(camera.quaternion);
					dlight.position.applyMatrix4(lightMatrix);
				}

				// update markers lookAt
				if (scope.hud.spatialize && SpatializeInterface.markers3D.length) {
					for (var i=0, l=SpatializeInterface.markers3D.length; i<l; i++) {
						SpatializeInterface.markers3D[i].object.lookAt(camera.position);
					}
				}

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
			 * Selection by a simple click.
			 * @param mouse {THREE.Vector2} mouse position (in viewport coordinates)
			 * @param ctrlKey {boolean=false} if ctrlKey is pressed
			 */
			function selectRay(mouse, ctrlKey) {
				prepareRaycaster(mouse);
				var testObjects = [];

				// collect test objects
				objects.forEach(function (obj) {
					if (obj.type === 'object')
						testObjects.push(obj.object);
				}, true);

				plans.forEach(function (plan) {
					testObjects.push(plan.object.mesh);
				}, true);

				// spatialImages in octree
				octree.search(raycaster.ray.origin, 0, true, raycaster.ray.direction)
					.forEach(function (item) {
						testObjects.push(item.object);
					});

				// raycast
				var intersection = raycast(testObjects, true);

				if (intersection) {
					$log.debug(intersection);

					if (intersection.object.entry instanceof DV3D.Entry)
						setSelected(intersection.object.entry, ctrlKey);
					else if (intersection.object.parent.entry instanceof DV3D.Entry)
						setSelected(intersection.object.parent.entry, ctrlKey);
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

				$rootScope.$applyAsync();
				animateAsync();
			}

			/**
			 * Event that gets fired, when an object has been selected or deselected.
			 * @ngdoc event
			 * @name viewport#viewportSelectionChange
			 * @eventType broadcast on $rootScope
			 */
			function viewportSelectionChange() {
				$rootScope.$broadcast('viewportSelectionChange', selected);
			}

			// apply selection material/color to entry's object and activate entry
			function selectEntry(entry) {
				if (entry instanceof DV3D.ObjectEntry) {
					assignSelectionMaterial(entry);
					entry.children.forEach(function (child) {
						selectEntry(child);
					});
				}
				else if (entry instanceof DV3D.PlanEntry) {
					entry.object.select();
				}
				else if (entry instanceof DV3D.ImageEntry) {
					entry.object.select();
				}
				entry.select(null, true);
			}

			// apply original material/color to entry's object and deactivate entry
			function deselectEntry(entry) {
				if (entry instanceof DV3D.ObjectEntry) {
					rejectSelectionMaterial(entry);
					entry.children.forEach(function (child) {
						deselectEntry(child);
					});
				}
				else if (entry instanceof DV3D.PlanEntry) {
					entry.object.deselect();
				}
				else if (entry instanceof DV3D.ImageEntry) {
					entry.object.deselect();
				}
				entry.select(null, false);
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
				obj.material = obj.material.clone();
				var hcolor = new THREE.Color(0xffff00); //materials['highlightMat'].color.clone();
				obj.material.color.lerp(hcolor, 0.5);
				obj.material.name += '_highlight';
			}

			function rejectHighlightMat(obj) {
				// be sure not to dispose standard or original material
				if (obj.material === materials[obj.userData.originalMat] ||
					viewportCache.standardMaterials.indexOf(obj.material.name) !== -1)
					return;

				obj.material.dispose();
				switch (viewportSettings.shading) {
					case 'grey':
						obj.material = materials['defaultDoublesideMat'];
						break;
					case 'transparent':
						obj.material = materials['transparentMat'];
						break;
					default:
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

			// watch für die Einstellungen für Unsicheres Wissen

			// scope.setUnsafe = function(value) {
			// 	//console.log('watch unsafe', value);
			// 	//if(/^-?[\d.]+(?:e-?\d+)?$/.test(value))
			// 	if(typeof materials['defaultUnsafeMat'] == 'undefined') return;
			// 	materials['defaultUnsafeMat'].opacity = value.opacity/100;
			// 	for(var key in objects) {
			// 		if(objects[key].mesh.userData.unsafe) {
			// 			objects[key].mesh.material.opacity = value.opacity/100;
			// 			if(objects[key].visible) {
			// 				if(value.edges && scope.shading != shading.COLOR) {
			// 					if(!scene.getObjectById(objects[key].edges.id))
			// 						scene.add(objects[key].edges);
			// 				}
			// 				else {
			// 					scene.remove(objects[key].edges);
			// 				}
			// 			}
			// 		}
			// 	}
			// 	animate();
			// };

			// set edges settings
			// scope.toggleEdges = function(value) {
			// 	for(var key in objects) {
			// 		var obj = objects[key];
			// 		if(obj.visible && obj.edges) {
			// 			if(value) scene.add(obj.edges);
			// 			else scene.remove(obj.edges);
			// 		}
			// 	}
			// 	animate();
			// };
			// scope.setEdgesOpacity = function(value) {
			// 	//scope.$watch('vizSettings.edgesOpacity', function (value) {
			//
			// 	console.log(value);
			// 	if(!materials['edges']) return;
			// 	if(value === 100) {
			// 		materials['edgesMat'].transparent = false;
			// 		materials['edgesSelectionMat'].transparent = false;
			// 	}
			// 	else {
			// 		materials['edgesMat'].transparent = true;
			// 		materials['edgesMat'].opacity = value/100;
			// 		materials['edgesSelectionMat'].transparent = true;
			// 		materials['edgesSelectionMat'].opacity = value/100;
			// 	}
			// 	animate();
			// };

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
						case 'color':
							obj.object.material = materials[obj.object.userData.originalMat];
							break;
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
							obj.object.material = materials[obj.object.userData.originalMat];
							break;
					}
				});

				animate();
			}

			// listen to viewportShadingChange event
			scope.$on('viewportShadingChange', function (event, mode, lastMode) {
				event.stopPropagation();
				applyShading(mode, lastMode);
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
						camera.toOrthographic(controls.center);
						camera.toTopView();
						break;
					case 'front':
						camera.toOrthographic(controls.center);
						camera.toFrontView();
						break;
					case 'back':
						camera.toOrthographic(controls.center);
						camera.toBackView();
						break;
					case 'left':
						camera.toOrthographic(controls.center);
						camera.toLeftView();
						break;
					case 'right':
						camera.toOrthographic(controls.center);
						camera.toRightView();
						break;
					default: break;
				}
				animate();
			}

			// listen to viewportCameraChange event
			scope.$on('viewportCameraChange', function (event, mode) {
				event.stopPropagation();
				setCameraMode(mode);
			});


			///// NAVIGATION

			/**
			 * Set navigation mode.
			 * @param [mode] {string} Navigation mode to set. If no mode is provided, navigation will be set to default.
			 * @param [triggerEvent=true] {boolean} If true, trigger the `viewportNavigationChange` event.
			 */
			function setNavigationMode(mode, triggerEvent) {
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

				if (triggerEvent !== false)
					viewportNavigationChange(mode);

				animate();
			}

			/**
			 * Event that gets fired, when navigation mode has changed.
			 * @ngdoc event
			 * @name viewport#viewportNavigationChange
			 * @eventType broadcast on viewport
			 * @param mode {string=} New mode
			 */
			function viewportNavigationChange(mode) {
				scope.$broadcast('viewportNavigationChange', mode);
			}

			// listen to viewportNavigationChange event
			scope.$on('viewportNavigationChange', function (event, mode) {
				if (event.targetScope === scope) return;
				event.stopPropagation();
				setNavigationMode(mode, false);
			});

			/**
			 * set opacity
			 * @param {THREE.Mesh} mesh - reference to mesh
			 * @param {THREE.Line} edges - reference to edges
			 * @param {number} value - opacity value
			 */
			function setOpacity(mesh, edges, value) {
				if(value === 1.0) {
					// TODO: consider opacity
					if(selected.indexOf(mesh) === -1) {
						mesh.material = materials[mesh.userData.originalMat];
						if(edges) edges.material = materials['edgesMat'] ;
					}
					else {
						mesh.material = materials['selectionMat'];
						if(edges) edges.material = materials['edgesSelectionMat'] ;
					}
					mesh.userData.modifiedMat = false;
				}
				else if(!mesh.userData.modifiedMat) {
					mesh.material = mesh.material.clone();
					mesh.material.transparent = true;
					mesh.material.depthWrite = false;
					mesh.material.needsUpdate = true;
					if(edges) {
						edges.material = edges.material.clone();
						edges.material.transparent = true;
						edges.material.depthWrite = false;
						edges.material.needsUpdate = true;
					}
					mesh.userData.modifiedMat = true;
				}
				mesh.material.opacity = value;
				if(edges) edges.material.opacity = value;
			}

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
				scope.closeContextMenu();
				isMouseDown = event.button;
				mouseDownCoord = mouseToViewportCoords(event);
				mouseDownEvent = event;

				if (navigation.default) {
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

				// if(scope.navigation.select || isPinning) {
				//
				// 	if(event.button === 0 && event.altKey && !isPanningView && camera.inPerspectiveMode) {
				// 		if(activeGizmo) activeGizmo = false;
				// 		canvas.addClass('cursor_orbit');
				// 		//setTemporalNavigationMode('rotate');
				// 		//scope.$apply();
				// 		isRotatingView = true;
				// 		controls.onMouseDown(event.originalEvent);
				// 	}
				// 	// else if(event.button === 1 && event.altKey && !isRotatingView && !isPanningView) {
				// 	// $('#webglViewport').addClass('cursor_zoom');
				// 	// isZoomingView = true;
				// 	// controls.onMouseDown(event.originalEvent);
				// 	// }
				// 	else if(event.button === 1 && !isRotatingView) {
				// 		canvas.addClass('cursor_pan');
				// 		isPanningView = true;
				// 		controls.onMouseDown(event.originalEvent);
				// 	}
				//

			}

			// mousemove event handler
			function mousemove(event) {
				event.preventDefault();
				var mouse = mouseToViewportCoords(event);

				if (isMouseDown !== -1) {
					// var move = new THREE.Vector2(
					// 	event.originalEvent.movementX || event.originalEvent.mozMovementX || event.originalEvent.webkitMovementX || 0,
					// 	event.originalEvent.movementY || event.originalEvent.mozMovementY || event.originalEvent.webkitMovementY || 0);

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
					var ocResults = octree.search(raycaster.ray.origin, 0, true, raycaster.ray.direction);
					var intersections = raycaster.intersectOctreeObjects(ocResults);
					if (intersections[0]) {
						// console.log(intersections[0]);
						if (intersections[0].object.parent.entry instanceof DV3D.Entry)
							intersections[0].object.parent.entry.highlight(true);
						// animateThrottle20();
					}
					else {
						spatialImages.dehighlight();
					}
				}

				// if(isMouseDown) {
				// 	// transform gizmo
				// 	if(activeGizmo && event.button === 0) {
				//
				// 		if(gizmo instanceof DV3D.GizmoMove) {
				// 			var movementX = event.originalEvent.movementX || event.originalEvent.mozMovementX || event.originalEvent.webkitMovementX || 0;
				// 			var movementY = event.originalEvent.movementY || event.originalEvent.mozMovementY || event.originalEvent.webkitMovementY || 0;
				//
				// 			var mv = new THREE.Vector3(movementX*0.1, -movementY*0.1, 0);
				// 			gizmo.transformObject(mv, camera);
				// 			//setGizmoCoords('move', true);
				// 		}
				// 		else if(gizmo instanceof DV3D.GizmoRotate) {
				// 			//var mouse = mouseInputToViewport(event);
				// 			gizmo.transformObject(mouse, camera);
				// 			//setGizmoCoords('rotate', true);
				// 		}
				// 		isSliceMoving = true;
				// 	}
				// 	// transform view
				// 	else if(isRotatingView || isPanningView || isZoomingView) {
				// 		if(scope.navigation.select) {
				// 			if(camPerspective) {
				// 				controls.onMouseMove(event.originalEvent);
				// 			}
				// 			else {
				// 				var movementX = event.originalEvent.movementX || event.originalEvent.mozMovementX || event.originalEvent.webkitMovementX || 0;
				// 				var movementY = event.originalEvent.movementY || event.originalEvent.mozMovementY || event.originalEvent.webkitMovementY || 0;
				// 				//console.log('mouse move', movementX, movementY);
				// 				orthocam.translateX(-movementX*0.1);
				// 				orthocam.translateY(movementY*0.1);
				// 			}
				// 		}
				// 		else {
				// 			controls.onMouseMove(event.originalEvent);
				// 		}
				// 	}

				//
				// // just hovering
				// else {
				// 	// check if mouse hits gizmo
				// 	if(gizmo) {
				// 		//var mouse = mouseInputToViewport(event);
				// 		//var mouse = mouseOffsetToViewport(event);
				// 		activeGizmo = gizmo.checkMouseHit(mouse.x, mouse.y, camera);
				// 	}
				// 	// measureTool routine
				// 	else if(measureTool) {
				// 		//var mouse = mouseInputToViewport(event);
				//
				// 		var testObjects = [];
				// 		for(var key in objects) {
				// 			if(objects[key].visible)
				// 				testObjects.push(objects[key].mesh);
				// 		}
				//
				// 		measureTool.checkMouseHit(mouse.x, mouse.y, camera, testObjects);
				// 	}
				// 	// pinning
				// 	else if(isPinning && pin) {
				// 		//var mouse = mouseInputToViewport(event);
				// 		var testObjects = [];
				// 		for(var key in objects) {
				// 			if(objects[key].visible)
				// 				testObjects.push(objects[key].mesh);
				// 		}
				// 		var obj = pin.mousehit(mouse.x, mouse.y, camera, testObjects);
				// 		highlightObject(obj);
				// 	}
				// 	// marking
				// 	else if(isMarking) {
				// 		//var mouse = mouseInputToViewportCoords(event);
				// 		var testObjects = [];
				// 		for(var key in objects) {
				// 			if(objects[key].visible)
				// 				testObjects.push(objects[key].mesh);
				// 		}
				// 		var intersection = raycast(mouse, testObjects);
				// 		if(intersection) currentMarker.position.copy(intersection.point);
				// 		currentMarker.lookAt(camera.position);
				// 		animate();
				// 	}
				// }

			}

			// mouseup event handler
			function mouseup(event) {
				if (isMouseDown === -1) return;

				isMouseDown = -1;
				var mouse = mouseToViewportCoords(event);

				if (navigation.default && event.button !== 2) {
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
						selectRay(mouse, event.ctrlKey);
						animate();
					}
				}
				else if (navigation.rotate || navigation.pan || navigation.zoom) {
					// return to default navigation
					if (event.button === 2)
						setNavigationMode();
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
						if (selected[0] instanceof DV3D.ImageEntry) {
							console.log('open context menu');
							// title, add to collection, focus, open details
							var elScope = scope.$new(false);
							elScope.position = new THREE.Vector2(event.offsetX, event.offsetY);
							elScope.entry = selected[0];
							// elScope.contextMenu = scope.contextMenu;

							contextMenuElement = $compile('<viewport-context-menu no-context-menu></viewport-context-menu>')(elScope);
							// contextMenuElement = $compile('<viewport-context-menu position="contextMenu.position" entry="contextMenu.entry"></viewport-context-menu>')(elScope);
							// contextMenuElement = angular.element('<viewport-context-menu position="contextMenu.position" entry="contextMenu.entry"></viewport-context-menu>');

							// snapshotElement = $compile('<viewport-snapshot-view></viewport-snapshot-view>')(elScope);
							$animate.enter(contextMenuElement, element);
						}
					}
				}


				//if(!mouseDownCoord.equals(new THREE.Vector2(event.clientX, event.clientY))) return;

				// 	//if(!mouseDownCoord.equals(new THREE.Vector2(event.clientX, event.clientY))) return;
				// 	// if(!mouseDownCoord.equals(new THREE.Vector2(event.offsetX, event.offsetY))) return;
				// 	if(!mouseDownCoord.equals(mouse)) return;
				//
				// 	if(measureTool) {
				// 		//var mouse = mouseInputToViewport(event);
				//
				// 		var testObjects = [];
				// 		for(var key in objects) {
				// 			if(objects[key].visible)
				// 				testObjects.push(objects[key].mesh);
				// 		}
				//
				// 		measureTool.setTarget(mouse.x, mouse.y, camera, testObjects);
				// 	}
				// 	else if(isPinning && pin) {
				// 		// make screenshot
				// 		var sData = getScreenshot();
				// 		sData.pinMatrix = pin.matrixWorld.toArray();
				// 		sData.pinObject = highlighted[0].userData.eid;
				// 		scope.screenshotCallback(sData);
				//
				// 		highlightObject(null);
				// 		scene.remove(pin);
				// 		pin.dispose();
				// 		pin = null;
				// 		isPinning = false;
				// 		scope.setNavigationMode('select');
				// 		scope.$applyAsync();
				// 	}
				// 	else if(isMarking) {
				// 		currentMarker.setNumber(SpatializeInterface.markers3D.length + 1);
				// 		SpatializeInterface.markers3D.push({
				// 			object: currentMarker,
				// 			x: currentMarker.position.x,
				// 			y: currentMarker.position.y,
				// 			z: currentMarker.position.z
				// 		});
				// 		isMarking = false;
				// 		currentMarker = null;
				// 		scope.$applyAsync();
				// 	}
				// 	// selection
				// 	else {
				// 		//var mouse = mouseOffsetToViewport(event.offsetX, event.offsetY);
				// 		selectRay(mouse, event.ctrlKey);
				// 		animate();
				// 	}
				//}

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
				scope.closeContextMenu();

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

			scope.closeContextMenu = function () {
				if (!contextMenuElement) return;
				$animate.leave(contextMenuElement);
				contextMenuElement = null;
				scope.$applyAsync();
			};

			function navigationEnd() {
				viewportCache.viewpoint = {
					cameraPosition: camera.position.clone(),
					controlsPosition: controls.center.clone()
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



			scope.startMeasuring = function () {
				scope.setNavigationMode();
				measureTool = new DV3D.Measure(2);
				measureTool.addEventListener('change', animate);
				scene.add(measureTool);
				measureTool.onComplete = function (distance) {
					scope.measureDistance = distance;
					scope.$applyAsync();
				};
			};


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
				setNavigationMode();
				pin = new DV3D.Pin(3, 0.5);
				// pin.addEventListener('change', animateThrottle20);
				scene.add(pin);
				isPinning = true;
			};

			// abort pinning (called from child scope)
			scope.abortPinning = function () {
				isPinning = false;
				setNavigationMode();
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
					cameraCenter: controls.center.toArray(),
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

				new TWEEN.Tween(controls.center.clone())
					.to(ctrlPos, 500)
					.easing(TWEEN.Easing.Quadratic.InOut)
					.onUpdate(function () {
						controls.center.copy(this);
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


			// add viewportSpatializeManual directive depending on spatializeManual attribute
			if (enableSpatializeManual) {
				var spatializeManualElement = null;

				// listen to spatializeManualStart event
				scope.$on('spatializeManualStart', function (event, src) {
					if (angular.element(element).find('viewport-spatialize-manual').length)
						return;

					var elScope = scope.$new(false);
					elScope.source = src;
					elScope.camera = camera;
					elScope.controls = controls;
					elScope.animate = animateThrottle20;

					spatializeManualElement = $compile('<viewport-spatialize-manual></viewport-spatialize-manual>')(elScope);
					$animate.enter(spatializeManualElement, element);

					element.find('viewport-selection-display, viewport-analysis-tools').hide();
				});

				scope.closeSpatializeManual = function () {
					$animate.leave(spatializeManualElement);
					spatializeManualElement = null;
					element.find('viewport-selection-display, viewport-analysis-tools').show();
				};
			}

			/**
			 * Set field of view of camera.
			 * @param [value] {number} New fov value
			 * @return {THREE.CombinedCamera} Effected camera.
			 */
			scope.setCameraFOV = function (value) {
				if (value) {
					camera.fov = value;
					camera.updateProjectionMatrix();
					animateThrottle20();
				}
				return camera;
			};


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

					if (options.visible) {
						switch (options.type) {
							case 'heatMap':
								heatMap = new DV3D.HeatMap3();
								scene.add(heatMap);
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
						vectorField.arrows.forEach(function (a) {
							a.cone.material.depthTest = !options.overlay;
							a.line.material.depthTest = !options.overlay;
							a.cone.material.transparent = options.overlay;
							a.line.material.transparent = options.overlay;
						})
					}
					if (windMap) {
						windMap.material.depthTest = !options.overlay;
						windMap.material.depthWrite = !options.overlay;
					}
				}

				if (options.radiusChange) {
					heatMapRadius = options.radius;
					updateHeatMap();
				}

				if (options.settingsChange) {
					if (windMap) {
						windMap._useWeight = options.useWeight;
					}

					updateHeatMap();
				}

				animateAsync();
			});

			function updateHeatMap() {
				if (heatMap) {
					heatMap.update(camera, function (position) {
						var or = octree.search(position, heatMapRadius);

						var count = 0;
						or.forEach(function (r) {
							if (position.clone().sub(r.position).length() < heatMapRadius)
								count++;
						});

						return count;
					});
				}

				if (vectorField) {
					vectorField.update(camera, function (position) {
						var or = octree.search(position, heatMapRadius);

						var count = 0, disTmp = 0, disMin = heatMapRadius;
						var dir = new THREE.Vector3();
						or.forEach(function (r) {
							var distance = position.clone().sub(r.position).length();
							if (distance < heatMapRadius) {
								dir.add(new THREE.Vector3(0, 0, -1).applyQuaternion(r.object.parent.quaternion));
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
					});

					animateAsync();
				}

				if (windMap) {
					windMap.update(camera, function (position) {
						var or = octree.search(position, heatMapRadius);

						var count = 0, disTmp = 0, disMin = heatMapRadius;
						var dir = new THREE.Vector3();
						or.forEach(function (r) {
							var distance = position.clone().sub(r.position).length();
							if (distance < heatMapRadius) {
								dir.add(new THREE.Vector3(0, 0, -1).applyQuaternion(r.object.parent.quaternion));
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
					});

					startAnimation();
				}
			}
			var updateHeatMapAsync = $debounce(updateHeatMap, 500);

			///// SPATIAL IMAGES

			// listen to spatialImageLoad event
			scope.$on('spatialImageLoad', function (event, images, reset) {
				if (reset === true) {
					setSelected(null);
					[].concat(spatialImages.list).forEach(function (image) {
						scene.remove(image.object);
						octree.remove(image.object.collisionObject);
						spatialImages.remove(image);
						image.dispose();
					});
				}
				if (Array.isArray(images)) {
					images.forEach(function (img) {
						loadSpatialImage(img);
					});
				}
				else
					loadSpatialImage(images);

				updateHeatMap();
			});

			/**
			 * Loads spatialized image into the scene.
			 * @param img
			 * @param [replace=false] {boolean} If true and the image exists, image will be reloaded. If false, loading will be skipped.
			 */
			function loadSpatialImage(img, replace) {
				if (!img.spatial)
					return $q.reject('No spatial information');

				var oldImg = spatialImages.getByName(img.content);

				if (oldImg && replace) {
					// remove existing one
					spatialImages.remove(oldImg);
					scene.remove(oldImg.object);
					oldImg.dispose();
				}
				else if(oldImg && !replace)
					return $q.reject('Already loaded');

				//$log.debug(img);

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


				scene.add(imagepane);

				defer.promise.then(function () {
					octree.add(imagepane.collisionObject);
					updateOctreeAsync();
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
				enterIsolation(obj);

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
					.start();
				new TWEEN.Tween(controls.center.clone())
					.to(end, 500)
					.easing(TWEEN.Easing.Quadratic.InOut)
					.onUpdate(function () { controls.center.copy(this); })
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

			function enterIsolation(obj) {
				spatialImages.forEach(function (item) {
					if (item.object !== obj)
						item.toggle(false);
				}, true);
				scope.$broadcast('viewportIsolationEnter');
			}

			function exitIsolation() {
				console.log('exit isolation');
				spatialImages.forEach(function (item) {
					item.toggle(true);
				});
				scope.$broadcast('viewportIsolationExit');
			}
			scope.exitIsolation = exitIsolation;

			if (scope.hud.spatialize) {
				SpatializeInterface.callFunc[cfId].loadSpatializeImage = loadSpatializeImage;
				SpatializeInterface.callFunc[cfId].setImageView = setImageView;
				scope.spatialize = {
					markers: SpatializeInterface.markers3D
				};
				scope.startMarking = startMarking;
				scope.clearMarkers = clearMarkers;
			}


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
			};

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
				new TWEEN.Tween(controls.center.clone())
					.to(bsCenter, 500)
					.easing(TWEEN.Easing.Quadratic.InOut)
					.onUpdate(function () { controls.center.copy(this); })
					.onComplete(function() {
						camera.toOrthographic(controls.center);
						scope.$apply();
					})
					.start();

				enableAnimationRequest();
			}

			// add or remove plan or spatialImage from scene
			function toggleSourceHandler(event) {
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


			// Funktionen, die auch von außen aufgerufen werden können
			scope.internalCallFunc = scope.callFunc || {};


			///// LOADING

			// listen to modelQuerySuccess event, start loading objects
			scope.$on('modelQuerySuccess', function (event, entries) {
				resetScene();
				ctmloader.manager.reset();

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
				// determine maximum bounding box
				var xmin = 0, xmax = 0, ymin = 0, ymax = 0, zmin = 0, zmax = 0;

				objs.forEach(function (obj, index) {
					if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
					var bbmin = obj.geometry.boundingBox.min.clone().applyMatrix4(obj.matrixWorld);
					var bbmax = obj.geometry.boundingBox.max.clone().applyMatrix4(obj.matrixWorld);

					if (index === 0) {
						xmin = bbmin.x; ymin = bbmin.y; zmin = bbmin.z;
						xmax = bbmax.x; ymax = bbmax.y; zmax = bbmax.z;
						return;
					}

					if (bbmin.x < xmin) xmin = bbmin.x;
					if (bbmin.y < ymin) ymin = bbmin.y;
					if (bbmin.z < zmin) zmin = bbmin.z;
					if (bbmax.x > xmax) xmax = bbmax.x;
					if (bbmax.y > ymax) ymax = bbmax.y;
					if (bbmax.z > zmax) zmax = bbmax.z;
				});

				// determine bounding sphere
				var geo = new THREE.Geometry();
				geo.vertices.push(new THREE.Vector3(xmin, ymin, zmin));
				geo.vertices.push(new THREE.Vector3(xmax, ymax, zmax));
				geo.computeBoundingSphere();

				// calculate new camera.position and controls.center
				var s = new THREE.Vector3().subVectors(camera.position, controls.center);
				var h = geo.boundingSphere.radius / Math.tan( camera.fov / 2 * THREE.Math.DEG2RAD );
				var newpos = new THREE.Vector3().addVectors(geo.boundingSphere.center, s.setLength(h));

				// adjust camera frustum (near, far)
				camera.cameraP.near = geo.boundingSphere.radius / 100;
				camera.cameraP.far = Math.max(geo.boundingSphere.radius * 100, 200);
				camera.updateProjectionMatrix();

				// animate camera.position and controls.center
				new TWEEN.Tween(camera.position.clone())
					.to(newpos, 500)
					.easing(TWEEN.Easing.Quadratic.InOut)
					.onUpdate(function () { camera.position.copy(this); })
					.start();

				new TWEEN.Tween(controls.center.clone())
					.to(geo.boundingSphere.center, 500)
					.easing(TWEEN.Easing.Quadratic.InOut)
					.onUpdate(function () { controls.center.copy(this); })
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
					controlsCenter: new THREE.Vector3()
				};
				viewportCache.viewpoint.cameraPosition.copy(camera.position);
				viewportCache.viewpoint.controlsCenter.copy(controls.center);

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
		}

		return {
			restrict: 'E',
			replace: false,
			transclude: true,
			template: '<canvas ng-class="{\'cursor_orbit\': navigation.rotate, \'cursor_pan\': navigation.pan, \'cursor_zoom\': navigation.zoom}"></canvas>\n<div class="viewport-extras" ng-transclude></div>',
			scope: {
				callFunc: '=',
				screenshotCallback: '='
			},
			link: link
		};
	}]);

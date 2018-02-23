angular.module('dokuvis.imageViewer', [])
/**
 * A viewer to inspect an image in detail. The user is able to zoom and pan. It builds on three.js with a `WebGLRenderer`.
 * An optional feature is to set markers on the image.
 * @ngdoc directive
 * @module dokuvisApp
 * @name imageViewer
 * @requires https://code.angularjs.org/1.4.6/docs/api/ng/service/$document $document
 * @requires https://code.angularjs.org/1.4.6/docs/api/ng/service/$window $window
 * @requires https://code.angularjs.org/1.4.6/docs/api/ng/service/$timeout $timeout
 * @requires SpatializeInterface
 * @requires $debounce
 * @requires https://code.angularjs.org/1.4.6/docs/api/ng/service/$log $log
 * @restrict E
 * @scope
 * @param src {string} Path/url to the image
 * @param options {Object=} Force resolution/aspect ratio with `width` and `height` property
 * @param spatialize {boolean=} Activate spatialize feature, e.g. setting markers on image
 * @param grid {boolean=} Activate grid feature
 */
.directive('imageViewer', ['$document', '$window', '$timeout', 'SpatializeInterface', '$debounce', '$log',
	function ($document, $window, $timeout, SpatializeInterface, $debounce, $log) {

		return {
			restrict: 'E',
			// templateUrl: 'app/directives/imageViewer/imageViewer.html',
			template: '<div class="ctrl-container ctrl-bottom-left" ng-if="grid">\n' +
			'\t<div>\n\t\t<div class="ctrl-group">\n\t\t\t<input type="checkbox" ng-model="grid.visible" ng-change="grid.onVisibilityChange()"/> Show grid\n\t\t</div>\n\t\t<div class="ctrl-group" ng-show="grid.visible">\n\t\t\t<div class="ctrl-slider">\n\t\t\t<span>Size</span>\n\t\t\t<input class="dvSlider" type="range" min="0" max="100" step="1" ng-model="grid.size" ng-change="grid.onSizeChange()"/>\n\t\t</div>\n\t</div>\n\t</div>\n</div>',
			scope: {
				source: '=src',
				options: '=options'
			},
			link: function (scope, element, attrs) {

				angular.element(element).css('overflow', 'hidden');


				var readyViewer = false,
					readyTexture = false,
					readyAll = false;

				var isPanning = false,
					isMarking = false,
					panSpeed = 0.0015,
					zoomSpeed = 0.1,
					maxZoomIn = -0.05,
					maxZoomOut = -1;

				var SCREEN_WIDTH, SCREEN_HEIGHT;
				var imageAspect, canvasAspect;
				var angleX, angleY;
				var scene, renderer, camera, canvas;
				var loader = new THREE.TextureLoader();
				var plane, currentMarker, currentUV, grid;

				// bind event listeners
				$document.on('mouseup', mouseup);
				angular.element($window).on('resize', resizeHandler);

				function resizeHandler() {
					// invoke digest on window resize
					scope.$applyAsync();
				}

				// call resizeViewer after element dimensions have been changed by last digest call
				var resizeDebounce = $debounce(function () {
					resizeViewer();
				}, 200, false, false);

				scope.$watch(function () {
					resizeDebounce();
				});

				// load new image, if url has changed
				scope.$watch('source', loadTexture);

				// init
				$timeout(function () {
					resizeViewer();
					init();
					if (readyTexture) loadTexture(scope.source);
				});

				function init() {
					scene = new THREE.Scene();

					renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
					renderer.setClearColor(0xffffff, 0.0);
					renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
					element.append(renderer.domElement);

					camera = new THREE.PerspectiveCamera(2 * angleY * 180 / Math.PI, canvasAspect, 0.01, 500);
					camera.lookAt(new THREE.Vector3(0,0,-1));

					var pGeo = new THREE.PlaneBufferGeometry(1, 1, 1, 1);
					var pMat = new THREE.MeshBasicMaterial();
					plane = new THREE.Mesh(pGeo, pMat);
					plane.position.set(0, 0, -1);

					// bind event listeners
					canvas = angular.element(renderer.domElement);
					canvas.on('mousedown', mousedown);
					canvas.on('mousemove', mousemove);
					canvas.on('wheel', zoom);
					canvas.on('contextmenu', function (event) {
						event.preventDefault();
					});

					readyViewer = true;

					render();
				}

				function loadTexture(url) {

					if (['jpg','png'].indexOf(url.split('.').pop()) === -1) return;

					readyTexture = true;
					console.log('source:', url);
					if (!readyViewer) return;

					// to prevent seeing a white plane, the plane is only added, when texture is loaded
					if (!readyAll) {
						scene.add(plane);
						readyAll = true;
					}

					loader.load(url, function (texture) {

						if (scope.options && scope.options.width && scope.options.height)
							imageAspect = scope.options.width / scope.options.height;
						else
							imageAspect = texture.image.width / texture.image.height;

						if (scope.spatialize) {
							SpatializeInterface.imageWidth = scope.options.width || texture.image.width;
							SpatializeInterface.imageHeight = scope.options.height || texture.image.height;
						}

						plane.geometry.dispose();
						plane.geometry = new THREE.PlaneBufferGeometry(imageAspect, 1, 1, 1);

						if (plane.material.map) plane.material.map.dispose();
						plane.material.map = texture;
						plane.material.needsUpdate = true;

						resetView();

					}, null, function () {
						console.error('ImageViewer: Couldn\'t load texture!');
					});
				}

				function render() {
					renderer.render(scene, camera);
				}

				// mousedown event
				function mousedown(event) {
					event.preventDefault();
					//console.log(event);
					if ((event.button === 0 && !isMarking) || event.button === 1)
						isPanning = true;
				}

				// mouseup event
				function mouseup(event) {
					if (isPanning && (event.button === 0 || event.button === 1)) {
						isPanning = false;
					}
					else if (event.button === 0 && isMarking) {
						var uv = currentUV;

						currentMarker.setNumber(SpatializeInterface.markers2D.length + 1);

						SpatializeInterface.markers2D.push({
							object: currentMarker,
							u: uv.x,
							v: uv.y,
							x: (uv.x - 0.5) * imageAspect,
							y: uv.y - 0.5
						});

						isMarking = false;
						currentMarker = null;
						render();
						scope.$applyAsync();
					}
				}

				// mousemove event
				function mousemove(event) {
					event.preventDefault();
					if (isPanning) {
						plane.translateX(event.originalEvent.movementX * panSpeed * -plane.position.z);
						plane.translateY(event.originalEvent.movementY * panSpeed * plane.position.z);
						fitToBorders();
						render();
					}
					else if (isMarking) {
						var mouse = new THREE.Vector2();
						mouse.x = (event.offsetX / SCREEN_WIDTH) * 2 - 1;
						mouse.y = -(event.offsetY / SCREEN_HEIGHT) * 2 + 1;
						setMarker(mouse);
						render();
					}
				}

				// scroll event
				function zoom(event) {
					if (event.originalEvent.deltaY < 0) {
						// scroll up -> zoom in
						var delta = -zoomSpeed * plane.position.z;
						if (plane.position.z + delta > maxZoomIn) return;
						plane.translateZ(delta);
						fitToBorders();
						render();
					}
					else if (event.originalEvent.deltaY > 0) {
						// scroll down -> zoom out
						delta = zoomSpeed * plane.position.z;
						if (plane.position.z + delta <= maxZoomOut) delta = maxZoomOut - plane.position.z;
						plane.translateZ(delta);
						fitToBorders();
						render();
					}
				}

				// keep image plane within the camera view
				function fitToBorders() {
					var xa = Math.abs(plane.position.z) * Math.tan(angleX),
						ya = Math.abs(plane.position.z) * Math.tan(angleY);

					var cWidth = 2 * xa,
						cHeight = 2 * ya;
					var iWidth = Math.abs(plane.position.x - imageAspect / 2) + Math.abs(plane.position.x + imageAspect / 2),
						iHeight = Math.abs(plane.position.y - 0.5) + Math.abs(plane.position.y + 0.5);


					if (imageAspect < canvasAspect && cWidth > iWidth) {
						if (xa < plane.position.x + imageAspect / 2)
							plane.translateX(xa - (plane.position.x + imageAspect / 2));
						if (-xa > plane.position.x - imageAspect / 2)
							plane.translateX(-xa - (plane.position.x - imageAspect / 2));
					}
					else {
						if (xa > plane.position.x + imageAspect / 2)
							plane.translateX(xa - (plane.position.x + imageAspect / 2));
						if (-xa < plane.position.x - imageAspect / 2)
							plane.translateX(-xa - (plane.position.x - imageAspect / 2));
					}

					if (imageAspect > canvasAspect && cHeight > iHeight) {
						if (ya < plane.position.y + 0.5)
							plane.translateY(ya - (plane.position.y + 0.5));
						if (-ya > plane.position.y - 0.5)
							plane.translateY(-ya - (plane.position.y - 0.5));
					}
					else {
						if (ya > plane.position.y + 0.5)
							plane.translateY(ya - (plane.position.y + 0.5));
						if (-ya < plane.position.y - 0.5)
							plane.translateY(-ya - (plane.position.y - 0.5));
					}

				}

				// set initial view/position of image plane and set maxZoomOut
				function resetView() {
					if (imageAspect < canvasAspect) {
						plane.position.set(0, 0, -1);
						maxZoomOut = -1;
					}
					else {
						var z = (imageAspect / 2) / Math.tan(angleX);
						plane.position.set(0, 0, -z);
						maxZoomOut = -z;
					}
					render();
				}

				function startMarking() {
					currentMarker = new DV3D.TorusMarker(0.008);
					currentMarker.addEventListener('change', render);
					plane.add(currentMarker);
					isMarking = true;
				}

				function setMarker(mouse) {
					var vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
					var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());

					var intersects = raycaster.intersectObject(plane);

					if (intersects[0]) {
						var uv = intersects[0].uv;
						currentUV = uv;

						currentMarker.position.set(uv.x * imageAspect - imageAspect/2, uv.y - 0.5, 0);
					}
				}

				function clearMarkers() {
					angular.forEach(SpatializeInterface.markers2D, function (marker) {
						plane.remove(marker.object);
						marker.object.dispose();
					});
					SpatializeInterface.markers2D.splice(0, SpatializeInterface.markers2D.length);
					render();
					scope.$applyAsync();
				}

				// update aspect ratios, camera, and renderer on resize
				function resizeViewer(width, height) {
					SCREEN_WIDTH = width || element.width();
					SCREEN_HEIGHT = height || element.height();

					canvasAspect = SCREEN_WIDTH / SCREEN_HEIGHT;
					angleX = Math.atan(0.5 * canvasAspect);
					angleY = Math.atan(0.5);

					var doResetView = plane && plane.position.z === maxZoomOut;

					if (imageAspect && imageAspect > canvasAspect)
						maxZoomOut = -(imageAspect / 2) / Math.tan(angleX);
					else
						maxZoomOut = -1;

					if (camera) {
						// camera.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
						camera.aspect = canvasAspect;
						camera.updateProjectionMatrix();
					}

					if (renderer) {
						renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
						if (plane && doResetView) resetView();
						else render();
					}
				}

				// activate spatialize feature
				if ('spatialize' in attrs)
					scope.spatialize = {
						markers: SpatializeInterface.markers2D
					};

				// bind functions to scope
				if (scope.spatialize) {
					scope.startMarking = startMarking;
					scope.clearMarkers = clearMarkers;
				}

				// activate grid feature
				if ('grid' in attrs) {
					scope.grid = {
						visible: false,
						size: 50,
						onSizeChange: function () {
							var size = logslider(this.size);
							grid.scale.set(size, size, size);
							render();
						},
						onVisibilityChange: function () {
							if (this.visible && (!grid || !plane.getObjectById(grid.id))) {
								if (!grid) {
									grid = new THREE.GridHelper(20, 200, 0x00ff00, 0xffff00);
									grid.material.transparent = true;
									grid.material.opacity = 0.5;
									grid.rotateX(Math.PI / 2);
									grid.position.set(0, 0, 0.01);
									var size = logslider(this.size);
									grid.scale.set(size, size, size);
								}
								plane.add(grid);
							}
							else
								plane.remove(grid);
							render();
						}
					};
				}

				function logslider(position) {
					var minp = 0, maxp = 100;
					var minv = Math.log(0.1),
						maxv = Math.log(2);

					var scale = (maxv - minv) / (maxp - minp);
					return Math.exp(minv + scale * (position - minp));
				}

				// destroy elements / cleanup
				scope.$on('$destroy', function () {
					// dispose geometry and materials
					if (plane) {
						plane.geometry.dispose();
						if (plane.material.map) plane.material.map.dispose();
						plane.material.dispose();
					}
					if (grid) {
						plane.geometry.dispose();
						plane.material.dispose();
					}

					if (renderer)
						renderer.dispose();

					if (scope.spatialize)
						clearMarkers();

					// unbind event listeners
					$document.off('mouseup', mouseup);
					angular.element($window).off('resize', resizeHandler);

					$log.debug('destroy imageViewer directive');
				});
			}
		};

	}]);

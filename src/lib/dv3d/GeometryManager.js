(function () {

var ctmLoader,
	config;

DV3D.GeometryManager = function (loadingManager, configParam) {

	ctmLoader = new THREE.CTMLoader(loadingManager);

	config = Object.assign({
		pathPrefix: ''
	}, configParam || {});

	this.geometries = {};

	// set standard geometries
	var initGeo = new THREE.BufferGeometry();
	initGeo.name = 'initGeo';
	initGeo.userData = {
		mCount: 0,
		mPersistent: true
	};
	this.geometries[initGeo.name] = initGeo;

};

DV3D.GeometryManager.prototype = {

	/**
	 * Get geometry by id/name
	 * @param key {string}
	 * @return {THREE.BufferGeometry}
	 */
	get: function (key) {
		return this.geometries[key];
	},

	/**
	 * Add to manager and if not already done set mCount=0 in userData
	 * @param geometry {THREE.BufferGeometry}
	 * @return {THREE.BufferGeometry|undefined}
	 */
	add: function (geometry) {
		if (!(geometry instanceof THREE.BufferGeometry)) {
			console.warn('Geometry type not supported! Use THREE.BufferGeometry.');
			return;
		}

		if (!geometry.name) {
			console.warn('Geometry must have a name!');
			return;
		}

		if (this.geometries[geometry.name]) {
			// console.warn('Geometry has been already added!');
			return geometry;
		}

		geometry.userData = {
			mCount: 0
		};

		this.geometries[geometry.name] = geometry;

		return geometry;
	},

	/**
	 * Add to manager if not already done and increment mCount
	 * @param key {THREE.BufferGeometry|string}
	 * @return {THREE.BufferGeometry|undefined}
	 */
	assign: function (key) {
		var geo;
		if (key instanceof THREE.BufferGeometry)
			geo = this.add(key);
		else
			geo = this.get(key);

		if (!geo) {
			console.warn('Geometry not found!');
			return;
		}

		geo.userData.mCount++;
		return geo;
	},

	/**
	 * Remove and dispose or decrement mCount
	 * @param geometry {THREE.BufferGeometry}
	 */
	remove: function (geometry) {
		var geo = this.geometries[geometry.name];
		if (geo) {
			if (geo.userData.mCount > 1) {
				geo.userData.mCount--;
			}
			else if (!geo.userData.mPersistent) {
				delete this.geometries[geo.name];
				geo.dispose();
			}
		}
		// TODO: set timeout, so geometries are not instantly deleted
	},

	/**
	 * Load geometry from ctm files
	 * @param path {string|Array<string>}
	 * @return {Promise<THREE.BufferGeometry>}
	 */
	loadCTMGeometry: function (path) {

		var scope = this;

		return new Promise(function (resolve, reject) {

			// load multi-part geometries
			if (Array.isArray(path)) {
				// check if already loaded
				var geo = scope.get(path.join('_'));
				if (geo) {
					geo.userData.mCount++;
					resolve(geo);
				}
				else
					// : TODO: check Promise.mapSeries issue
					Promise.mapSeries(path, function (file) {
						return new Promise(function (resolve, reject) {
							ctmLoader.load(config.pathPrefix + file, function (geometry) {
								resolve(geometry);
							}, { useWorker: false });
						});
					}).then(function (geometries) {
						// prepare
						var geometry = geometries[0];
						geometry.clearGroups();
						geometry.addGroup(0, geometry.index.count, 0);

						for (var i = 1; i < geometries.length; i++) {
							geometry.merge(geometries[i]);
							var count = geometries[i].index.count;
							geometry.addGroup(geometry.index.count - count, count, i);
							geometries[i].dispose();
						}

						geometry.computeBoundingBox();

						// add geometry to manager
						geometry.name = path.join('_');
						scope.assign(geometry);

						resolve(geometry);
					});
			}

			// load geometry normal objects
			else {
				// check if already loaded
				geo = scope.get(path);
				if (geo) {
					geo.userData.mCount++;
					resolve(geo);
				}
				else
					ctmLoader.load(config.pathPrefix + path, function (geometry) {
						// prepare
						geometry.clearGroups();
						geometry.addGroup(0, geometry.index.count, 0);

						geometry.computeBoundingBox();

						// add geometry to manager
						geometry.name = path;
						scope.assign(geometry);

						resolve(geometry);

					}, { useWorker: false });
			}

		});
	},

	/**
	 * Load geometries from zipped json files
	 * @param path {string|Array<string>}
	 * @return {Promise<THREE.BufferGeometry>}
	 */
	loadEdgesGeometry: function (path) {

		var scope = this;

		return new Promise(function (resolve, reject) {

			// load multi-part edges
			if (Array.isArray(path)) {
				// check if already loaded
				var geo = scope.get(path.join('_'));
				if (geo) {
					geo.userData.mCount++;
					resolve(geo);
				}
				else {
					Promise.mapSeries(path, function (file) {
						return loadEdges(file);
					})
						.then(function (geometries) {
							// merge multiple geometry parts
							var geometry = geometries[0];
							for (var i = 1; i < geometries.length; i++) {
								geometry.merge(geometries[i]);
								geometries[i].dispose();
							}

							// add geometry to manager
							geometry.name = path.join('_');
							scope.assign(geometry);

							resolve(geometry);
						})
						.catch(function (reason) {
							reject(reason);
						});
				}
			}

			// load single edges
			else {
				// check if already loaded
				geo = scope.get(path);
				if (geo) {
					geo.userData.mCount++;
					resolve(geo);
				}
				else
					loadEdges(path)
						.then(function (geometry) {
							// add geometry to manager
							geometry.name = path;
							scope.assign(geometry);

							resolve(geometry);
						})
						.catch(function (reason) {
							reject(reason);
						});
			}

		});
	}

};

function loadEdges(file) {
	return new Promise(function (resolve, reject) {

		JSZipUtils.getBinaryContent(config.pathPrefix + file, function (err, data) {
			if (err) {
				reject(err);
				return;
			}

			JSZip.loadAsync(data)
				.then(function (zip) {
					var files = zip.file(/.+\.json$/i);
					return files[0].async('text');
				})
				.then(function (json) {
					json = JSON.parse(json);
					var geometry = new THREE.BufferGeometry();
					geometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(json.data.attributes.position.array), 3));
					resolve(geometry);
				})
				.catch(function (err) {
					reject('JSZip: Failed to load or extract zip file!', err);
				});
		});

	});
}

})();

(function () {

var textureLoader,
	config;

DV3D.MaterialManager = function (loadingManager, configParam) {

	textureLoader = new THREE.TextureLoader(loadingManager);

	config = Object.assign({
		pathPrefix: ''
	}, configParam || {});

	this.materials = {};

	///// STANDARD MATERIALS

	// default grey
	this.add(new THREE.MeshLambertMaterial({
		name: 'defaultMat',
		color: DV3D.Defaults.objectColor
	}), true);
	this.add(new THREE.MeshLambertMaterial({
		name: 'defaultDoubleSideMat',
		color: DV3D.Defaults.objectColor,
		side: THREE.DoubleSide
	}), true);
	this.add(new THREE.MeshLambertMaterial({
		name: 'highlightMat',
		color: new THREE.Color().lerp(new THREE.Color(DV3D.Defaults.highlightColor), 0.3).getHex()
	}), true);

	// transparent
	this.add(new THREE.MeshLambertMaterial({
		name: 'transparentMat',
		color: 0xcccccc,
		transparent: true,
		opacity: 0.5
	}), true);
	this.add(new THREE.MeshLambertMaterial({
		name: 'transparentHighlightMat',
		color: new THREE.Color().lerp(new THREE.Color(DV3D.Defaults.highlightColor), 0.3).getHex(),
		transparent: true,
		opacity: 0.5
	}), true);

	// xray
	this.add(new THREE.ShaderMaterial({
		name: 'xrayMat',
		side: THREE.DoubleSide,
		transparent: true,
		depthWrite: false,
		depthTest: false,
		uniforms: {
			"ambient": {type: "f", value: 0.05},
			"edgefalloff": {type: "f", value: 0.1},
			"intensity": {type: "f", value: 1.0},
			"vColor": {type: "c", value: new THREE.Color(0x000000)}
		},
		vertexShader: THREE.XRayShader.vertexShader,
		fragmentShader: THREE.XRayShader.fragmentShader
	}), true);
	this.add(new THREE.ShaderMaterial({
		name: 'xraySelectionMat',
		side: THREE.DoubleSide,
		transparent: true,
		depthWrite: false,
		depthTest: false,
		uniforms: {
			"ambient": {type: "f", value: 0.05},
			"edgefalloff": {type: "f", value: 0.3},
			"intensity": {type: "f", value: 1.5},
			"vColor": {type: "c", value: new THREE.Color(DV3D.Defaults.selectionColor)}
		},
		vertexShader: THREE.XRayShader.vertexShader,
		fragmentShader: THREE.XRayShader.fragmentShader
	}), true);
	this.add(new THREE.ShaderMaterial({
		name: 'xrayHighlightMat',
		side: THREE.DoubleSide,
		transparent: true,
		depthWrite: false,
		depthTest: false,
		uniforms: {
			"ambient": {type: "f", value: 0.05},
			"edgefalloff": {type: "f", value: 0.3},
			"intensity": {type: "f", value: 1.5},
			"vColor": {type: "c", value: new THREE.Color(DV3D.Defaults.highlightColor)}
		},
		vertexShader: THREE.XRayShader.vertexShader,
		fragmentShader: THREE.XRayShader.fragmentShader
	}), true);

	// edges
	this.add(new THREE.LineBasicMaterial({
		name: 'edgesMat',
		color: DV3D.Defaults.edgeColor
	}), true);
	this.add(new THREE.LineBasicMaterial({
		name: 'edgesSelectionMat',
		color: DV3D.Defaults.selectionColor
	}), true);

};

DV3D.MaterialManager.prototype = {

	/**
	 * Get material by id/name
	 * @param key {string}
	 * @return {THREE.Material}
	 */
	get: function (key) {
		return this.materials[key];
	},

	/**
	 * Add to manager and if not already done set mCount=0 in userData
	 * @param material {THREE.Material}
	 * @param persistent {boolean=false}
	 * @return {THREE.Material|undefined}
	 */
	add: function (material, persistent) {
		if (!(material instanceof THREE.Material)) {
			console.warn('Material must be subclass of THREE.Material!');
			return;
		}

		if (!material.name) {
			console.warn('Material must have a name!');
			return;
		}

		if (this.materials[material.name]) {
			// console.warn('Material has been already added!');
			return material;
		}

		material.userData.mCount = 0;
		material.userData.mPersistent = persistent === true;

		this.materials[material.name] = material;

		return material;
	},

	/**
	 * Add to manager if not already done and increment mCount
	 * @param key {THREE.Material|string}
	 * @return {THREE.Material|undefined}
	 */
	assign: function (key) {
		var mat;
		if (key instanceof THREE.Material)
			mat = this.add(key);
		else
			mat = this.get(key);

		if (!mat) {
			console.warn('Material not found!');
			return;
		}

		mat.userData.mCount++;
		return mat;
	},

	/**
	 * Remove and dispose or decrement mCount
	 * @param materials {THREE.Material|Array<THREE.Material>}
	 */
	remove: function (materials) {
		var scope = this;

		if (!Array.isArray(materials)) materials = [materials];

		materials.forEach(function (material) {
			var mat = scope.materials[material.name];
			if (mat) {
				if (mat.userData.mCount > 1) {
					mat.userData.mCount--;
				}
				else if (!mat.userData.mPersistent) {
					delete scope.materials[mat.name];
					disposeMaterial(mat);
				}
			}
		});
		// TODO: set timeout, so geometries are not instantly deleted
	},

	/**
	 * Set material parameters, load textures, and add to manager.
	 * @param maps {Object|Array<Object>}
	 * @return {Promise<THREE.Material|Array<THREE.Material>>}
	 */
	setMaterial: function (maps) {

		var scope = this;

		return new Promise(function (resolve, reject) {

			if (!Array.isArray(maps))
				maps = [maps];

			Promise.mapSeries(maps, function (map) {
				// check if already set
				var mat = scope.get(map.id);
				if (mat) {
					mat.userData.mCount++;
					return mat;
				}
				else {
					// set each material
					return prepareMaterial(map)
						.then(function (material) {
							// add material to manager
							scope.assign(material);

							return material;
						});
				}
			})
				.then(function (materials) {
					if (materials.length === 1)
						resolve(materials[0]);
					else
						resolve(materials);
				})
				.catch(function (reason) {
					reject(reason);
				});
		});
	}

};

function prepareMaterial(map) {

	return new Promise(function (resolve, reject) {

		var material = new THREE.MeshLambertMaterial();

		// set diffuse color/map
		if (Array.isArray(map.diffuse)) {
			material.color = new THREE.Color(map.diffuse[0], map.diffuse[1], map.diffuse[2]);
			material.color.convertLinearToGamma();
		}
		else if (typeof map.diffuse === 'string') {
			textureLoader.load(config.pathPrefix + map.path + map.diffuse, function (texture) {
				material.map = texture;
				material.needsUpdate = true
			}, null, function (xhr) {
				reject('Couldn\'t load texture ' + xhr.path[0].src);
				material.dispose();
			});
		}

		// st alpha map
		if (map.alpha) {
			textureLoader.load(config.pathPrefix + map.path + map.alpha, function (texture) {
				material.alphaMap = texture;
				material.transparent = true;
				material.needsUpdate = true;
			}, null, function (xhr) {
				reject('Couldn\'t load texture ' + xhr.path[0].src);
				if (material.map)
					material.map.dispose();
				material.dispose();
			});
		}

		material.side = THREE.DoubleSide;

		material.name = map.id;
		Object.assign(material.userData, map);

		resolve(material);

	});
}

function disposeMaterial(material) {
	if (material.map)
		material.map.dispose();
	if (material.alphaMap)
		material.alphaMap.dispose();
	material.dispose();
}

})();

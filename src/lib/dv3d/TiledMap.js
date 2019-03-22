(function () {

var fileLoader = new THREE.FileLoader(),
	textureLoader = new THREE.TextureLoader();

DV3D.TiledMap = function (baseUrl) {

	THREE.Object3D.call(this);

	var scope = this;

	scope._baseUrl = baseUrl;
	if (!/\S+\/$/.test(baseUrl))
		scope._baseUrl += '/';

	scope._tiles = [];

	scope.promise = new Promise(function (resolve, reject) {
		fileLoader.load(scope._baseUrl + 'meta.json', function (data) {
			resolve(JSON.parse(data));
		}, undefined, function (err) {
			reject(new Error(err));
		});
	}).then(function (data) {
		return init.call(scope, data);
	}).catch(function (reason) {
		console.error(reason);
	});

};

DV3D.TiledMap.prototype = Object.assign( Object.create(THREE.Object3D.prototype), {

	dispose: function () {

		var scope = this;

		this._tiles.forEach(function (tile) {
			scope.remove(tile);
			if (tile.material.map)
				tile.material.map.dispose();
			tile.material.dispose();
			tile.geometry.dispose();
		});

		this._tiles = [];
	}

});

function init(params) {

	var scope = this,
		promises = [];

	// create tiles
	var topLeft = new THREE.Vector3(params['top-left'].x, 0, params['top-left'].z),
		topRight = new THREE.Vector3(params['top-right'].x, 0, params['top-right'].z),
		bottomRight = new THREE.Vector3(params['bottom-right'].x, 0, params['bottom-right'].z),
		bottomLeft = new THREE.Vector3(params['bottom-left'].x, 0, params['bottom-left'].z);

	var angle = new THREE.Vector3().subVectors(topRight, topLeft).angleTo(new THREE.Vector3(1,0,0)),
		distance = new THREE.Vector2(topLeft.distanceTo(topRight), topLeft.distanceTo(bottomLeft)),
		resolution = new THREE.Vector2(distance.x / params.width, distance.y / params.height);

	// load map tile texture
	function applyTexture(material, index) {
		return loadTexture(scope._baseUrl + params.filename.replace('{index}', ('00' + (index + 1).toString()).slice(-2)))
			.then(function (texture) {
				material.map = texture;
				// material.renderOrder = -90;
				material.needsUpdate = true;
			});
	}

	var tileIndex = 0;

	for (var iy = 0, ly = params.height / params.tileSize; iy < ly; iy++) {
		var ty = iy * resolution.y * params.tileSize / distance.y,
			lerp0 = new THREE.Vector3().lerpVectors(topLeft, bottomLeft, ty),
			lerp1 = new THREE.Vector3().lerpVectors(topRight, bottomRight, ty);

		var scaleY = resolution.y * ((iy + 1 > ly) ? params.height % params.tileSize : params.tileSize);

		for (var ix = 0, lx = params.width / params.tileSize; ix < lx; ix++) {

			var tile = createTileMesh();
			tile.renderOrder = -95;

			tile.position.lerpVectors(lerp0, lerp1, ix * resolution.x * params.tileSize / distance.x);
			tile.rotation.y = -angle;

			var scaleX = resolution.x * ((ix + 1 > lx) ? params.width % params.tileSize : params.tileSize);
			tile.scale.set(scaleX, 1, scaleY);

			promises.push(applyTexture(tile.material, tileIndex));

			scope.add(tile);
			scope._tiles.push(tile);

			tileIndex++;
		}
	}

	return Promise.all(promises);
}

function createTileMesh() {

	var vertices = new Float32Array([
		0, 0, 0,  0, 0, 1,  1, 0, 1,
		0, 0, 0,  1, 0, 1,  1, 0, 0
	]);

	var uvs = new Float32Array([
		0, 1,  0, 0,  1, 0,
		0, 1,  1, 0,  1, 1
	]);

	var geo = new THREE.BufferGeometry();
	geo.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
	geo.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));

	var mat = new THREE.MeshBasicMaterial({
		depthTest: false
	});

	return new THREE.Mesh(geo, mat);
}

function loadTexture(path) {
	return new Promise(function (resolve, reject) {
		textureLoader.load(path, function (texture) {
			texture.anisotropy = 4;
			resolve(texture);
		}, null, function (error) {
			reject(error);
		})
	});
}

})();
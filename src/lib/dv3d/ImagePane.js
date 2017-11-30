/**
 * Class for visualizing spatialized images. It consists of a plane with the image as texture, and lines arranged as a pyramid representing the camera orientation and fov.<br/>
 * Extends [THREE.Object3D]{@link https://threejs.org/docs/index.html#Reference/Core/Object3D}.
 * @param imageUrl {string} Path to the image
 * @param [params] {Object} Camera parameters like resolution, fov, or image center
 * @param [scale=1.0] {number} Initial scale
 * @extends THREE.Object3D
 * @constructor
 */
DV3D.ImagePane = function ( imageUrl, params, scale ) {

	THREE.Object3D.call( this );

	var scope = this;

	scope.onComplete = undefined;

	var loader = new THREE.TextureLoader();

	// load texture image
	var textureDefer = new Promise(function (resolve, reject) {
		loader.load(imageUrl, function ( texture ) {
			texture.anisotropy = 8;
			scope.texture = texture;

			if (params.width && params.height)
				scope.width = params.width / params.height;
			else
				scope.width = texture.image.width / texture.image.height;
			scope.height = 1.0;

			scope.fov = 2 * Math.atan(scope.height / (2 * params.ck)) * THREE.Math.RAD2DEG;

			var offsetX = -params.offset[0];
			var offsetY = -params.offset[1];

			var distance = params.ck;

			// plane with texture
			var paneGeometry = new THREE.PlaneBufferGeometry(scope.width, scope.height);
			var paneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

			var pane = new THREE.Mesh(paneGeometry, paneMaterial);
			//pane.scale.set(-1,-1,-1);
			pane.translateZ(-distance);
			pane.translateX(offsetX);
			pane.translateY(offsetY);

			// pyramid representing camera
			var vertices = {
				origin: new THREE.Vector3(0,0,0),
				topleft: new THREE.Vector3(-scope.width/2 + offsetX, scope.height/2 + offsetY, -distance),
				topright: new THREE.Vector3(scope.width/2 + offsetX, scope.height/2 + offsetY, -distance),
				bottomleft: new THREE.Vector3(-scope.width/2 + offsetX, -scope.height/2 + offsetY, -distance),
				bottomright: new THREE.Vector3(scope.width/2 + offsetX, -scope.height/2 + offsetY, -distance)
			};
			scope.vertices = vertices;

			var lineGeometry = new THREE.Geometry();
			lineGeometry.vertices.push(
				vertices.origin, vertices.topleft,
				vertices.origin, vertices.topright,
				vertices.origin, vertices.bottomleft,
				vertices.origin, vertices.bottomright,
				vertices.topleft, vertices.bottomleft,
				vertices.bottomleft, vertices.bottomright,
				vertices.bottomright, vertices.topright,
				vertices.topright, vertices.topleft
			);
			var lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });

			var line = new THREE.LineSegments( lineGeometry, lineMaterial );

			// invisible click dummy
			var boxGeometry = new THREE.BoxGeometry(scope.width, scope.height, distance);
			var boxMaterial = new THREE.MeshBasicMaterial({ visible: false });

			var clickBox = new THREE.Mesh(boxGeometry, boxMaterial);
			clickBox.translateZ( - distance / 2 );

			scope.add( pane );
			scope.add( line );
			scope.add( clickBox );
			scope.setScale(scale || 1.0);

			scope.image = pane;
			scope.pyramid = line;

			scope.collisionObject = clickBox;
			scope.lodSphere = new THREE.Sphere(pane.position, 2 * scale || 2.0);

			resolve();
		}, null, function ( xhr ) {
			reject(xhr);
		});
	});

	// load preview image
	var previewDefer = new Promise(function (resolve, reject) {
		if (params.preview)
			loader.load(params.preview, function ( texture ) {
				texture.anisotropy = 8;
				scope.previewTexture = texture;
				resolve();
			}, null, function ( xhr ) {
				reject(xhr);
			});
		else
			resolve();
	});

	// promise chain, wait for all texture to be loaded
	Promise.all([textureDefer, previewDefer])
		.then(function () {
			if (scope.previewTexture)
				scope.image.material.map = scope.previewTexture;
			else
				scope.image.material.map = scope.texture;
			scope.image.material.needsUpdate = true;

			if (scope.onComplete) scope.onComplete();
		})
		.catch(function (err) {
			console.error('Couldn\'t load texture', err);
		});
	
};

DV3D.ImagePane.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	/**
	 * Apply selection color to the material of the pyramid.
	 */
	select: function () {
		this.pyramid.material.color.setHex(DV3D.Defaults.selectionColor);
	},

	/**
	 * Apply default color to the material of the pyramid.
	 */
	deselect: function () {
		this.pyramid.material.color.setHex(0x0000ff);
	},

	/**
	 * Set scale of the object.
	 * @param value {number} New scale value
	 */
	setScale: function (value) {
		this.scale.set(value, value, value);
		//this.lodSphere.radius = 2 * value;
	},

	/**
	 * Set opacity of the object.
	 * @param value {number} New opacity value
	 */
	setOpacity: function (value) {
		for (var i = 0; i < this.children.length; i++) {
			var mat = this.children[i].material;
			if (value < 1) {
				mat.transparent = true;
				mat.opacity = value;
			}
			else {
				mat.transparent = false;
				mat.opacity = 1;
			}
		}
	},

	withinLODRange: function (point) {
		var elements = this.image.matrixWorld.elements;
		var lod = new THREE.Sphere(new THREE.Vector3(elements[12], elements[13], elements[14]), this.scale.z * 3);
		return lod.containsPoint(point);
	},

	updateTexture: function (highres) {
		if (highres || !this.previewTexture) {
			if (this.image.material.map === this.texture) return;
			this.image.material.map = this.texture;
		}
		else {
			if (this.image.material.map === this.previewTexture) return;
			this.image.material.map = this.previewTexture;
		}
		this.image.material.needsUpdate = true;
	},

	/**
	 * Dispose geometries, materials, and textures.
	 */
	dispose: function () {
		if (this.collisionObject) {
			this.collisionObject.material.dispose();
			this.collisionObject.geometry.dispose();
		}
		if (this.pyramid) {
			this.pyramid.material.dispose();
			this.pyramid.geometry.dispose();
		}
		if (this.image) {
			this.image.material.map.dispose();
			this.image.material.dispose();
			this.image.geometry.dispose();
		}
	}

});

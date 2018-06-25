(function () {

/**
 * Class for visualizing spatialized images. It consists of a plane with the image as texture, and lines arranged as a pyramid representing the camera orientation and fov.<br/>
 * Extends [THREE.Object3D]{@link https://threejs.org/docs/index.html#Reference/Core/Object3D}.
 * @param imageUrl {string} Path to the image
 * @param [params] {Object} Camera parameters like resolution, fov, or image center (offset)
 * @extends THREE.Object3D
 * @constructor
 */
DV3D.ImagePane = function ( imageUrl, params ) {

	THREE.Object3D.call( this );

	var scope = this;

	scope.onComplete = undefined;

	// assign urls
	scope.texture = imageUrl;
	scope.previewTexture = params.preview;

	// load either preview image or normal image
	var loader = new THREE.TextureLoader();

	if (scope.previewTexture && typeof scope.previewTexture === 'string') {
		// load preview image
		loader.load(scope.previewTexture, function ( texture ) {
			scope.previewTexture = texture;
			init.call(scope, texture, params);

			if (scope.onComplete) scope.onComplete();
		}, null, function (xhr) {
			console.error('Couldn\'t load texture', xhr);
		});
	}
	else {
		// load normal texture image
		loader.load(scope.texture, function ( texture ) {
			scope.texture = texture;
			init.call(scope, texture, params);

			if (scope.onComplete) scope.onComplete();
		}, null, function (xhr) {
			console.error('Couldn\'t load texture', xhr);
		});
	}
	
};

DV3D.ImagePane.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	/**
	 * Apply selection color to the material of the pyramid.
	 */
	select: function () {
		console.log('select');
		if (!this.pyramid)
			createPyramid.call(this);
		if (!this.pyramid.parent !== this)
			this.add(this.pyramid);
		this.pyramid.material.color.setHex(DV3D.Defaults.selectionColor);
	},

	/**
	 * Apply default color to the material of the pyramid.
	 */
	deselect: function () {
		console.log('deselect');
		this.pyramid.material.color.setHex(0x0000ff);
		this.remove(this.pyramid);
	},

	highlight: function () {
		if (!this.pyramid)
			createPyramid.call(this);
		if (!this.pyramid.parent !== this)
			this.add(this.pyramid);
	},

	dehighlight: function () {
		this.remove(this.pyramid);
	},

	/**
	 * Set scale of the object.
	 * @param value {number} New scale value
	 */
	setScale: function (value) {
		this.scale.set(value, value, value);
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

	/**
	 * Check if vector is within a certain distance and replace texture according as vector is within or outside threshold.
	 * @param vector {THREE.Vector3} Some vector position, e.g. camera position.
	 * @param threshold {number} Threshold distance.
	 * @return {boolean} True, if texture has been updated.
	 */
	updateTextureByDistance: function (vector, threshold) {
		if (!this.image) return false;
		// if there's no preview image, no update needed
		if (this.texture && !this.previewTexture) return false;

		// check, if vector within threshold
		var distance = new THREE.Vector3().subVectors(vector, this.position).length();
		if (distance < threshold) {
			// replace preview with highres texture (if not already done)
			if (this.image.material.map === this.texture) return false;

			// if texture is not yet loaded, load now
			if (typeof this.texture === 'string') {
				var scope = this;
				new THREE.TextureLoader().load(this.texture, function (texture) {
					texture.anisotropy = 8;
					texture.minFilter = THREE.LinearFilter;
					scope.texture = texture;
					scope.image.material.map = texture;
					scope.image.material.needsUpdate = true;
					if (scope.entry)
						scope.entry.update();
				}, null, function (xhr) {
					console.error('Couldn\'t load texture', xhr);
				});
			}
			else {
				this.image.material.map = this.texture;
				this.image.material.needsUpdate = true;
			}
			return true;
		}
		else {
			// replace highres texture with preview (if not already done)
			if (this.image.material.map === this.previewTexture) return false;

			this.image.material.map = this.previewTexture;
			this.image.material.needsUpdate = true;
			return true;
		}
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
		if (this.texture instanceof THREE.Texture)
			this.texture.dispose();
		if (this.previewTexture instanceof THREE.Texture)
			this.previewTexture.dispose();
		if (this.image) {
			this.image.material.dispose();
			this.image.geometry.dispose();
		}
	}

});

/**
 * Initialize geometries and materials
 * @param texture {THREE.Texture} Loaded texture
 * @param params {Object} Parameters passed from constructor
 * @private
 */
function init( texture, params ) {
	// height = 1, width = aspect ratio
	var width = this.width = 1.0;
	var height = this.height = 1.0;

	if (params.width && params.height)
		width = this.width = params.width / params.height;
	else
		width = this.width = texture.image.width / texture.image.height;

	// field of view
	this.fov = 2 * Math.atan(height / (2 * params.ck)) * THREE.Math.RAD2DEG;

	// offset from center
	var offsetX = -params.offset[0];
	var offsetY = -params.offset[1];

	var distance = params.ck;

	// plane with texture
	texture.anisotropy = 8;
	texture.minFilter = THREE.LinearFilter;

	var paneGeometry = new THREE.PlaneBufferGeometry(width, height);
	var paneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, map: texture });

	var pane = new THREE.Mesh(paneGeometry, paneMaterial);
	pane.translateZ(-distance);
	pane.translateX(offsetX);
	pane.translateY(offsetY);

	// pyramid representing camera
	var vertices = {
		'origin': new THREE.Vector3(0, 0, 0),
		'top-left': new THREE.Vector3(-width / 2 + offsetX, height / 2 + offsetY, -distance),
		'top-right': new THREE.Vector3(width / 2 + offsetX, height / 2 + offsetY, -distance),
		'bottom-left': new THREE.Vector3(-width / 2 + offsetX, -height / 2 + offsetY, -distance),
		'bottom-right': new THREE.Vector3(width / 2 + offsetX, -height / 2 + offsetY, -distance)
	};
	this.vertices = vertices;

	// invisible click dummy
	var clickGeometry = new THREE.Geometry();
	clickGeometry.vertices.push(vertices['top-left'], vertices['top-right'], vertices['bottom-left'], vertices['bottom-right']);
	clickGeometry.faces.push(
		new THREE.Face3(0,2,1),
		new THREE.Face3(0,1,2),
		new THREE.Face3(1,2,3),
		new THREE.Face3(1,3,2)
	);

	var clickMaterial = new THREE.MeshBasicMaterial({ visible: false });
	var clickObj = new THREE.Mesh(clickGeometry, clickMaterial);

	// add objects to parent
	this.add( pane );
	this.add( clickObj );

	this.image = pane;
	this.collisionObject = clickObj;
}

// create pyramid representing camera frustum
function createPyramid() {
	if (this.pyramid) return;

	var vertices = this.vertices;
	var lineGeometry = new THREE.Geometry();
	lineGeometry.vertices.push(
		vertices.origin, vertices['top-left'],
		vertices.origin, vertices['top-right'],
		vertices.origin, vertices['bottom-left'],
		vertices.origin, vertices['bottom-right'],
		vertices['top-left'], vertices['bottom-left'],
		vertices['bottom-left'], vertices['bottom-right'],
		vertices['bottom-right'], vertices['top-right'],
		vertices['top-right'], vertices['top-left']
	);
	var lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });

	this.pyramid = new THREE.LineSegments( lineGeometry, lineMaterial );
}

})();
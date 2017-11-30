/**
 * Class for a 2D plan. The mesh is retrieved from a ctm file.<br/>
 * Extends [THREE.Object3D]{@link https://threejs.org/docs/index.html#Reference/Core/Object3D}.
 * @param fileUrl {string} path to mesh (.ctm file)
 * @param imageUrl {string} path to texture
 * @param [scale=0.01] {number} scale of the mesh
 * @param [ctmloader] {THREE.CTMLoader} CTMLoader
 * @extends THREE.Object3D
 * @constructor
 */
DV3D.Plan = function ( fileUrl, imageUrl, scale, ctmloader ) {
	
	THREE.Object3D.call( this );

	var scope = this;

	scale = scale || 0.01;
	ctmloader = ctmloader || new THREE.CTMLoader();
	
	ctmloader.load(fileUrl, function (geo) {

		geo.computeBoundingSphere();

		// scale
		geo.scale(scale, scale, scale);

		// translate to origin
		var t = geo.boundingSphere.center.clone();
		geo.translate(-t.x, -t.y, -t.z);

		var xAxis = new THREE.Vector3(1,0,0);
		var yAxis = new THREE.Vector3(0,1,0);
		var zAxis = new THREE.Vector3(0,0,1);

		// rotate to normal faces to positive Z axis
		var normalXZ = new THREE.Vector3(geo.attributes.normal.array[0], 0, geo.attributes.normal.array[2]).normalize();
		var angleY = 0;
		if(normalXZ.length()) {
			angleY = normalXZ.angleTo(zAxis);
			angleY *= normalXZ.dot(xAxis) > 0 ? -1 : 1;
		}
		geo.rotateY(angleY);
		var normalYZ = new THREE.Vector3(0, geo.attributes.normal.array[1], geo.attributes.normal.array[2]).normalize();
		var angleX = 0;
		if (normalYZ.length()) {
			angleX = normalYZ.angleTo(zAxis);
			angleX *= normalYZ.dot(yAxis) > 0 ? 1 : -1;
		}
		geo.rotateX(angleX);

		geo.computeBoundingBox();
		geo.computeBoundingSphere();

		// material
		if (imageUrl) {
			var texture = new THREE.TextureLoader().load(imageUrl, function () {
				if(scope.onComplete) scope.onComplete();
			});
			texture.anisotropy = 8;
			var material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
		}
		else
			material = THREE.DokuVisTray.materials['defaultDoublesideMat'].clone();

		var mesh = new THREE.Mesh(geo, material);
		var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24.0), THREE.DokuVisTray.materials['edgesMat'].clone());

		scope.add( mesh );
		scope.add( edges );

		scope.mesh = mesh;
		scope.edges = edges;

		// translate and rotate to original position
		scope.rotateX(-angleX);
		scope.rotateY(-angleY);
		scope.position.set(t.x, t.y, t.z);
		
		scope.updateMatrix();
		scope.userData.initMatrix = scope.matrix.clone();

	}, { useWorker: false });

	scope.onComplete = undefined;
	
};

DV3D.Plan.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	/**
	 * Apply selection color to the material of the edges.
	 */
	select: function () {
		this.edges.material.color.set(DV3D.Defaults.selectionColor);
	},

	/**
	 * Apply default color to the material of the edges.
	 */
	deselect: function () {
		this.edges.material.color.set(DV3D.Defaults.edgeColor);
	},

	/**
	 * Set the opacity of the plan.
	 * @param value {number} New opacity value
	 */
	setOpacity: function (value) {
		if (value < 1) {
			this.mesh.material.transparent = true;
			this.mesh.material.opacity = value;
			this.edges.material.transparent = true;
			this.edges.material.opacity = value;
		}
		else {
			this.mesh.material.transparent = false;
			this.mesh.material.opacity = 1;
			this.edges.material.transparent = false;
			this.edges.material.opacity = 1;
		}
	},

	/**
	 * Dispose geometries, materials, and textures.
	 */
	dispose: function () {
		this.edges.material.dispose();
		this.edges.geometry.dispose();
		this.mesh.material.map.dispose();
		this.mesh.material.dispose();
		this.mesh.geometry.dispose();
	}

});

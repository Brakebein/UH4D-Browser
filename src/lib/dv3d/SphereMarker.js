DV3D.SphereMarker = function (size, color) {

	THREE.Object3D.call( this );
	
	size = size || 1.0;
	color = color || 0xff0000;

	this.type = 'SphereMarker';

	var geo = new THREE.SphereBufferGeometry(0.5, 16, 12);
	var mat = new THREE.MeshBasicMaterial({ color: color });
	var tmat = new THREE.MeshBasicMaterial({ color: color, depthTest: false, depthWrite: false });
	
	this.object = new THREE.Mesh(geo, mat);
	this.text = new THREE.Mesh(new THREE.Geometry(), tmat);
	this.text.position.set(1, 0 ,0);
	
	this.object.add(this.text);
	this.add(this.object);

	this.scale.set(size, size, size);

};
DV3D.SphereMarker.prototype = Object.assign(Object.create( THREE.Object3D.prototype ), {

	setToCursorPosition: function (mouse, camera, testObjects) {
		var vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
		var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
		var intersects = raycaster.intersectObjects(testObjects, false);

		if(intersects[0]) {
			this.position.copy(intersects[0].point);
			this.dispatchEvent({ type: 'change' });
			return intersects[0].point;
		}
		else 
			return null;
	},
	
	setNumber: function (text) {
		this.text.geometry.dispose();
		this.text.geometry = new THREE.TextGeometry(text, {
			font: THREE.DokuVisTray.fonts.HelvetikerBold,
			size: 1.0,
			height: 0.002
		});
		this.dispatchEvent({ type: 'change' });
	},
	
	dispose: function () {
		this.object.geometry.dispose();
		this.object.material.dispose();
		this.text.geometry.dispose();
		this.text.material.dispose();
	}

});

/**
 * Class for a pin/needle/marker. Basically, it's just a cone with its top at origin.
 * @param length {number} length of the cone
 * @param radius {number} radius of the cone
 * @extends THREE.Object3D
 * @constructor
 */
DV3D.Pin = function ( length, radius ) {

	THREE.Object3D.call( this );

	var cgeo = new THREE.CylinderGeometry(0, radius, length, 16);
	var cmat = new THREE.MeshLambertMaterial({ color: 0x00ff00, depthTest: false, depthWrite: false });

	this.object = new THREE.Mesh(cgeo, cmat);
	this.object.renderOrder = 100;
	this.object.rotateOnAxis(new THREE.Vector3(1,0,0), Math.PI / 2);
	this.object.translateY( - length / 2 );

	this.add(this.object);

};

DV3D.Pin.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	mousehit: function ( mouse, camera, testObjects) {
		var vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);

		var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());

		var intersects = raycaster.intersectObjects(testObjects, false);

		if(intersects.length > 0) {
			var s = intersects[0].point;
			this.position.copy(s);

			var normalMatrix = new THREE.Matrix3().getNormalMatrix(intersects[0].object.matrixWorld);
			var normal = new THREE.Vector3().copy(intersects[0].face.normal).applyMatrix3(normalMatrix).normalize();
			var focalPoint = new THREE.Vector3().subVectors(s, normal);
			this.lookAt(focalPoint);

			this.dispatchEvent({ type: 'change' });
			return intersects[0].object;
		}
		else {
			this.position.set(0,0,0);

			this.dispatchEvent({ type: 'change' });
			return null;
		}
	},

	set: function (intersection) {
		if (!intersection) {
			this.position.set(-1000,-1000,-1000);
			return;
		}

		this.position.copy(intersection.point);

		var normalMatrix = new THREE.Matrix3().getNormalMatrix(intersection.object.matrixWorld);
		var normal = new THREE.Vector3().copy(intersection.face.normal).applyMatrix3(normalMatrix).normalize();
		var focalPoint = new THREE.Vector3().subVectors(intersection.point, normal);

		this.lookAt(focalPoint);
	},

	/**
	 * Dispose geometry and material.
	 */
	dispose: function () {
		this.object.geometry.dispose();
		this.object.material.dispose();
	}

});

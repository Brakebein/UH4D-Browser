DV3D.VectorField = function () {

	THREE.Object3D.call(this);

	this.arrows = null;

};

DV3D.VectorField.prototype = Object.assign( Object.create(THREE.Object3D.prototype), {

	update: function (camera, callback) {
		this.dispose();

		// ground plane and viewing frustum rays
		var plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
		var rays = [
			new THREE.Ray(camera.position, new THREE.Vector3(-1, 1, 0.5).unproject(camera).sub(camera.position).normalize()),
			new THREE.Ray(camera.position, new THREE.Vector3(-1, -1, 0.5).unproject(camera).sub(camera.position).normalize()),
			new THREE.Ray(camera.position, new THREE.Vector3(1, -1, 0.5).unproject(camera).sub(camera.position).normalize()),
			new THREE.Ray(camera.position, new THREE.Vector3(1, 1, 0.5).unproject(camera).sub(camera.position).normalize())
		];

		var maxSphere = new THREE.Sphere(camera.position, Math.max(camera.position.y, 1));

		// distance from camera to ground plane -> determine resolution
		var midRay = new THREE.Ray(camera.position, new THREE.Vector3(0, 0, 0.5).unproject(camera).sub(camera.position).normalize());
		var midPoint = midRay.intersectPlane(plane);
		if (!midPoint)
			midPoint = midRay.intersectSphere(maxSphere);
		var distance = new THREE.Vector3().subVectors(midPoint, camera.position).length();
		var resolution = 50 / distance;

		console.log('Distance', distance, 'Resolution', resolution);

		// determine bounding box around viewing quadrangle
		var bbox = new THREE.Box2();
		maxSphere.radius = distance * 1.5;

		rays.forEach(function (ray) {
			var intersection = ray.intersectPlane(plane);
			if (!intersection)
				intersection = ray.intersectSphere(maxSphere);
			//console.log(intersection);
			bbox.expandByPoint(new THREE.Vector2(intersection.x, intersection.z));
		});

		// set heat map dimensions
		var dimension = new THREE.Vector2(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y);

		this.arrows = [];
		var maxCount = 0;

		for (var iy = 0, ly = dimension.y; iy < ly; iy += 1 / resolution) {
			for (var ix = 0, lx = dimension.x; ix < lx; ix += 1 / resolution) {
				var pos = new THREE.Vector3(Math.round(ix + bbox.min.x), 0, Math.round(iy + bbox.min.y));
				var props = callback(pos);

				if (props.direction.x === 0 && props.direction.z === 0)
					continue;

				maxCount = Math.max(maxCount, props.count);
				this.arrows.push({
					direction: new THREE.Vector3(props.direction.x, 0, props.direction.z).normalize(),
					position: pos,
					count: props.count,
					dirWeight: props.dirWeight,
					disWeight: props.disWeight
				});
			}
		}

		var scope = this;

		this.arrows.forEach(function (value) {
			var color = new THREE.Color(0xffff00).lerp(new THREE.Color(0x00ff00), value.count / maxCount);
			var a = new THREE.ArrowHelper(value.direction, value.position, 1, color.getHex(), 0.7, 0.3);
			a.cone.material.depthTest = false;
			a.line.material.depthTest = false;
			a.cone.material.transparent = true;
			a.line.material.transparent = true;
			// a.cone.material.opacity = value.count / maxCount;
			// a.line.material.opacity = value.count / maxCount;
			a.cone.renderOrder = 1000;
			a.line.renderOrder = 1000;
			// a.renderOrder = 1000;

			var scale = (1 / resolution) * value.disWeight;// * value.dirWeight * 2;// * ((value.count / maxCount) * 0.75 + 0.25);
			a.scale.set(scale, scale, scale);

			scope.add(a);
			value.object = a;
		});

		console.log(this.arrows);
	},

	dispose: function () {
		var scope = this;
		if (!this.arrows) return;
		this.arrows.forEach(function (a) {
			var obj = a.object;
			scope.remove(obj);
			obj.cone.geometry.dispose();
			obj.cone.material.dispose();
			obj.line.geometry.dispose();
			obj.line.material.dispose();
		});
		this.arrows = null;
	}

});

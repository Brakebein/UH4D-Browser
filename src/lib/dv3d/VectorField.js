DV3D.VectorField = function () {

	THREE.Object3D.call(this);

	this.arrows = null;

	this.config = {
		depthTest: true,
		transparent: false,
		gradient: {
			//0.0: '#00ff32',
			// 0.3: '#2b83ba', // blue
			0.1: '#85dd58', // cyan
			0.4: '#ffffbf', // green
			0.7: '#fdae61', // yellow
			1.0: '#d7191c'  // red
		}
	};

	this._palette = this._getColorPalette(this.config);
};

DV3D.VectorField.prototype = Object.assign( Object.create(THREE.Object3D.prototype), {

	_getColorPalette: function(config) {
		var gradientConfig = config.gradient || config.defaultGradient;
		var paletteCanvas = document.createElement('canvas');
		var paletteCtx = paletteCanvas.getContext('2d');

		paletteCanvas.width = 256;
		paletteCanvas.height = 1;

		var gradient = paletteCtx.createLinearGradient(0, 0, 256, 1);
		for (var key in gradientConfig) {
			gradient.addColorStop(key, gradientConfig[key]);
		}

		paletteCtx.fillStyle = gradient;
		paletteCtx.fillRect(0, 0, 256, 1);

		return paletteCtx.getImageData(0, 0, 256, 1).data;
	},

	setConfig: function (config) {
		Object.assign(this.config, config);

		var scope = this;
		if (this.arrows)
			this.arrows.forEach(function (a) {
				a.object.material.depthTest = scope.config.depthTest;
				a.object.material.transparent = scope.config.transparent;
			});
	},

	update: function (camera, callback, onComplete) {
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

		var step = 1 / resolution;
		for (var iy = 0, ly = dimension.y; iy < ly; iy += step) {
			for (var ix = 0, lx = dimension.x; ix < lx; ix += step) {
				var pos = new THREE.Vector3(
					Math.round(ix + bbox.min.x + (Math.random() * step / 2 - step / 4)),
					0,
					Math.round(iy + bbox.min.y + (Math.random() * step / 2 - step / 4))
				);
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
			var offset = Math.round(value.count / maxCount * 255) * 4,
				color = 'rgb(' + scope._palette[offset] + ',' + scope._palette[offset + 1] + ',' + scope._palette[offset + 2] + ')';

			var geo = new THREE.CylinderBufferGeometry(0, 0.5, 1, 5, 1),
				mat = new THREE.MeshBasicMaterial({
					color: color,
					depthTest: scope.config.depthTest,
					transparent: scope.config.transparent
				}),
				a = new THREE.Mesh(geo, mat);

			a.position.copy(value.position);
			var dir = value.direction;
			if (dir.y > 0.99999)
				a.quaternion.set(0,0,0,1);
			else if (dir.y < -0.99999)
				a.quaternion.set(1,0,0,0);
			else {
				var axis = new THREE.Vector3(dir.z, 0, -dir.x).normalize(),
					radians = Math.acos(dir.y);
				a.quaternion.setFromAxisAngle(axis, radians);
			}

			var scale = (1 / resolution) * value.disWeight;// * value.dirWeight * 2;// * ((value.count / maxCount) * 0.75 + 0.25);
			a.scale.set(scale * 0.3, scale * 0.7, scale * 0.3);

			scope.add(a);
			value.object = a;
		});

		if (onComplete)
			onComplete({
				gradient: this.config.gradient,
				scale: { min: 0, max: maxCount }
			});
	},

	dispose: function () {
		var scope = this;
		if (!this.arrows) return;
		this.arrows.forEach(function (a) {
			var obj = a.object;
			scope.remove(obj);
			obj.geometry.dispose();
			obj.material.dispose();
		});
		this.arrows = null;
	}

});

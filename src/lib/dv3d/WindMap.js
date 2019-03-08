DV3D.WindMap = function () {

	var canvas = document.createElement('canvas');
	canvas.width = 500;
	canvas.height = 500;

	var geometry = new THREE.PlaneBufferGeometry(1,1);

	var material = new THREE.MeshBasicMaterial({
		map: new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter),
		transparent: true,
		depthTest: false,
		depthWrite: false
	});

	THREE.Mesh.call(this, geometry, material);

	this._canvas = canvas;

	var gl = canvas.getContext('webgl', {antialias: false, depth: false});
	this._wind = new WindGL(gl);
	this._wind.numParticles = 65536;

	this._useWeight = 'countWeight';

};

DV3D.WindMap.prototype = Object.assign( Object.create(THREE.Mesh.prototype), {

	configure: function(c) {
		if (typeof c.numParticles === 'number')
			this._wind.numParticles = c.numParticles;
		if (typeof c.speedFactor === 'number')
			this._wind.speedFactor = c.speedFactor;
	},

	update: function (camera, callback, onComplete) {

		var startTime = Date.now();

		// ground plane and maximum distance sphere
		var plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0),
			maxSphere = new THREE.Sphere(camera.position, Math.max(camera.position.y, 1));

		// distance from camera to ground plane -> determine resolution
		var midRay = new THREE.Ray(camera.position, new THREE.Vector3(0, 0, 0.5).unproject(camera).sub(camera.position).normalize()),
			midPoint = midRay.intersectPlane(plane);
		if (!midPoint)
			midPoint = midRay.intersectSphere(maxSphere);
		var distance = new THREE.Vector3().subVectors(midPoint, camera.position).length(),
			resolution = 200 / distance;

		// console.log('Distance', distance, 'Resolution', resolution);

		// viewing frustum rays
		var rays = [
			new THREE.Ray(camera.position, new THREE.Vector3(-1, 1, 0.5).unproject(camera).sub(camera.position).normalize()),
			new THREE.Ray(camera.position, new THREE.Vector3(-1, -1, 0.5).unproject(camera).sub(camera.position).normalize()),
			new THREE.Ray(camera.position, new THREE.Vector3(1, -1, 0.5).unproject(camera).sub(camera.position).normalize()),
			new THREE.Ray(camera.position, new THREE.Vector3(1, 1, 0.5).unproject(camera).sub(camera.position).normalize())
		];

		// determine bounding box around viewing quadrangle
		var bbox = new THREE.Box2();
		maxSphere.radius = distance * 2;

		rays.forEach(function (ray) {
			var intersection = ray.intersectPlane(plane);
			if (!intersection || new THREE.Vector3().subVectors(intersection, camera.position).length() > maxSphere.radius)
				intersection = ray.intersectSphere(maxSphere);
			bbox.expandByPoint(new THREE.Vector2(intersection.x, intersection.z));
		});

		// set dimensions
		var dimension = new THREE.Vector2(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y),
			width = Math.ceil(dimension.x * resolution),
			height = Math.ceil(dimension.y * resolution);

		// console.log(width, height);

		// set new plane geometry
		var geometry = new THREE.PlaneBufferGeometry(dimension.x, dimension.y);
		geometry.rotateX(-Math.PI / 2);
		geometry.translate(dimension.x / 2  + bbox.min.x, 0, dimension.y / 2 + bbox.min.y);

		this.geometry.dispose();
		this.geometry = geometry;


		// determine vector field / callback
		var arrows = [],
			maxCount = 0;

		for (var iy = 0, ly = height; iy < ly; iy++) {
			for (var ix = 0, lx = width; ix < lx; ix++) {
				var pos = new THREE.Vector3(ix / resolution + bbox.min.x, 0, iy / resolution + bbox.min.y);
				var res = callback(pos);

				var dir = new THREE.Vector3(res.direction.x, 0, res.direction.z);

				if (!(res.direction.x === 0 && res.direction.z === 0))
					dir.normalize();

				maxCount = Math.max(maxCount, res.count);
				arrows.push({
					direction: dir,
					position: pos,
					count: res.count,
					dirWeight: res.dirWeight,
					disWeight: res.disWeight
				});
			}
		}

		arrows.forEach(function (value) {
			value.countWeight = value.count / maxCount;
		});


		// write wind image
		// encode vectors as colors
		var vCanvas = document.createElement('canvas');
		vCanvas.width = width;
		vCanvas.height = height;
		var ctx = vCanvas.getContext('2d'),
			imageData = ctx.createImageData(width, height),
			data = imageData.data;

		for (var i = 0, l = width * height; i < l; i++) {
			var i4 = i * 4,
				a = arrows[i];

			data[i4] = (a.direction.x * a[this._useWeight] * 127 + 128) >> 0;
			data[i4+1] = (-a.direction.z * a[this._useWeight] * 127 + 128) >> 0;
			data[i4+2] = 0;
			data[i4+3] = 255;
		}

		ctx.putImageData(imageData, 0, 0);

		// set wind data
		var windImage = new Image();
		windImage.src = vCanvas.toDataURL('image/png');

		var windData = {
			width: width,
			height: height,
			uMin: -10,
			uMax: 10,
			vMin: -10,
			vMax: 10,
			image: windImage
		};

		this._canvas.width = Math.min(2048, (this._canvas.width === width * 5) ? width * 5 + 1 : width * 5);
		this._canvas.height = Math.min(2048, (this._canvas.height === height * 5) ? height * 5 + 1 : height * 5);
		this._wind.resize();

		var scope = this;
		windImage.onload = function () {
			scope._wind.setWind(windData);
		};

		if (onComplete)
			onComplete({
				gradient: this._wind.colorRamp,
				scale: { min: 0, max: maxCount }
			});

		console.log('WindMap - Elapsed time', Date.now() - startTime, 'ms');
	},

	draw: function () {
		if (this._wind.windData)
			this._wind.draw();
		this.material.map.needsUpdate = true;
	},

	dispose: function () {
		this.geometry.dispose();
		this.material.map.dispose();
		this.material.dispose();
	}

});

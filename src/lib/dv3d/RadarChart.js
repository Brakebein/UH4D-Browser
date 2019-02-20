DV3D.RadarChart = function () {

	THREE.Object3D.call(this);

	this._charts = null;

	this._palette = this._getColorPalette({
		gradient: {
			//0.0: '#00ff32',
			0.3: '#2b83ba', // blue
			0.5: '#abdda4', // cyan
			0.7: '#ffffbf', // green
			0.9: '#fdae61', // yellow
			1.0: '#d7191c'  // red
		}
	});

};

DV3D.RadarChart.prototype = Object.assign( Object.create(THREE.Object3D.prototype), {

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

	update: function (camera, callback) {

		var scope = this;
		scope.dispose();

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


		// get data at each grid point
		this._charts = [];
		var maxCount = 0;

		var step = 4 / resolution;
		for (var iy = 0, ly = dimension.y; iy < ly; iy += step) {
			for (var ix = 0, lx = dimension.x; ix < lx; ix += step) {
				var pos = new THREE.Vector3(ix + bbox.min.x, 0, iy + bbox.min.y);

				var result = callback(pos);

				if (!result.normals.length) continue;

				maxCount = Math.max(maxCount, result.normals.length);

				this._charts.push({
					normals: result.normals,
					radius: result.radius,
					position: pos
				});
			}
		}

		// parameters
		var canvasWidth = 200,
			angleSteps = 16,
			piAngle = 2 * Math.PI / angleSteps;

		// chart basic normals
		var normVecs = [];
		for (var i = 0; i < angleSteps; i++) {
			normVecs.push(new THREE.Vector2(0, 1).rotateAround(new THREE.Vector2(0,0), -i * 2 * Math.PI / angleSteps));
		}

		// compute each chart
		this._charts.forEach(function (value) {

			var acc = normVecs.map(function () {
				return 0;
			});

			value.normals.forEach(function (vec3) {
				var vec2 = new THREE.Vector2(vec3.x, vec3.z).normalize();

				var angle = Math.acos(vec2.y);
				if (vec2.x < 0)
					angle = angle * -1 + 2 * Math.PI;

				var temp = angle / piAngle;
				var index = Math.floor(temp);
				var t = temp - index;

				acc[index % angleSteps] += 1.0 - t;
				acc[(index + 1) % angleSteps] += t;
			});

			var maxScalar = 0;
			// acc.forEach(function (value) {
			// 	maxScalar = Math.max(value, maxScalar);
			// });

			// gaussian blur values [1 4 6 4 1]
			acc = acc.map(function (value, index) {
				var blur = (acc[(index + 2) % acc.length] + acc[(index + 1) % acc.length] * 4 + 6 * value + acc[(index - 1 + acc.length) % acc.length]* 4 + acc[(index - 1 + acc.length) % acc.length]) / 16;

				maxScalar = Math.max(blur, maxScalar);

				return blur;
			});

			var sampleVecs = acc.map(function (value, index) {
				return normVecs[index].clone().setLength(value / maxScalar);
			});

			var origin = new THREE.Vector2(canvasWidth / 2, canvasWidth / 2);
			sampleVecs.forEach(function (v) {
				v.multiplyScalar(canvasWidth / 2).add(origin);
			});

			// create canvas material and geometry
			var canvas = document.createElement('canvas');
			canvas.setAttribute('width', canvasWidth);
			canvas.setAttribute('height', canvasWidth);

			var geometry = new THREE.PlaneBufferGeometry(Math.round(step * 1.2), Math.round(step * 1.2));
			geometry.rotateX(-Math.PI / 2);

			var material = new THREE.MeshBasicMaterial({
				map: new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter, THREE.RGBAFormat, THREE.UnsignedByteType, 4),
				transparent: true,
				depthTest: false,
				depthWrite: false
			});

			var mesh = new THREE.Mesh(geometry, material);
			mesh.position.copy(value.position);
			value.object = mesh;
			scope.add(mesh);

			// draw chart
			var ctx = canvas.getContext('2d');

			var line = d3.line()
				.x(function (d) {
					return d.x;
				})
				.y(function (d) {
					return d.y;
				})
				.curve(d3.curveBasisClosed)
				.context(ctx);

			[5, 33, 66].forEach(function (r) {
				ctx.beginPath();
				ctx.arc(origin.x, origin.y, r, 0, 2 * Math.PI);
				ctx.stroke();
			});

			var offset = Math.round(value.normals.length / maxCount * 255) * 4;

			ctx.beginPath();
			line(sampleVecs);
			ctx.lineWidth = 1.5;
			ctx.fillStyle = 'rgba(' + scope._palette[offset] + ',' + scope._palette[offset + 1] + ',' + scope._palette[offset + 2] + ', 0.7)';
			// ctx.fillStyle = '#2f9a33aa';
			ctx.stroke();
			ctx.fill();

		});

	},

	dispose: function () {
		var scope = this;
		if (!this._charts) return;
		this._charts.forEach(function (c) {
			var obj = c.object;
			scope.remove(obj);
			obj.geometry.dispose();
			obj.material.map.dispose();
			obj.material.dispose();
		});
		this._charts = null;
	}

});

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

	// update: function (camera, callback) {
	update: function (camera, clusters) {

		var startTime = Date.now();

		var scope = this;
		scope.dispose();

		// camera frustum
		var frustum = new THREE.Frustum();
		frustum.setFromMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

		// get data for each cluster
		this._charts = [];
		var maxCount = 0,
			minDistance = 1000;
		
		clusters.forEach(function (c) {
			if (!frustum.containsPoint(c.position))
				return;

			var normals = [];

			c.getLeaves().forEach(function (leaf) {
				normals.push(new THREE.Vector3(0, 0, -1).applyQuaternion(leaf.quaternion));
			});

			maxCount = Math.max(maxCount, normals.length);
			if (c.parent)
				minDistance = Math.min(minDistance, c.parent.distance);

			scope._charts.push({
				normals: normals,
				position: c.position,
				cluster: c
			});

			c.explode();
		});

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

			var geometry = new THREE.PlaneBufferGeometry(Math.round(minDistance * 1.2), Math.round(minDistance * 1.2));
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

		console.log('RadarChart - Elapsed time', Date.now() - startTime, 'ms');

	},

	dispose: function () {
		var scope = this;
		if (!this._charts) return;
		this._charts.forEach(function (c) {
			c.cluster.implode();
			var obj = c.object;
			scope.remove(obj);
			obj.geometry.dispose();
			obj.material.map.dispose();
			obj.material.dispose();
		});
		this._charts = null;
	}

});

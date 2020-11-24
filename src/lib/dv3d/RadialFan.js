DV3D.RadialFan = function () {

	THREE.Object3D.call(this);

	this.angleOffset = 0;
	this.angleResolution = 16;

	this._chart = null;

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

DV3D.RadialFan.prototype = Object.assign( Object.create(THREE.Object3D.prototype), {

	_getColorPalette: function (config) {
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

	setAngleOffset: function (offset) {
		this.angleOffset = offset;
	},

	setAngleResolution: function (resolution) {
		this.angleResolution = resolution;
	},

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
			maxScalarGlobal = 0,
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
		var canvasWidth = 250,
			angleSteps = scope.angleResolution,
			piAngle = 2 * Math.PI / angleSteps;
		//angleOffset = piAngle * 1.5;

		var maxArea = Math.pow(canvasWidth / 2 - 20, 2) * piAngle / Math.PI;

		// set chart position
		// scope.position.set(center.x, 0, center.z);

		// chart basic normals
		var normVecs = [];
		for (var i = 0; i < angleSteps; i++) {
			normVecs.push(new THREE.Vector2(0, 1).rotateAround(new THREE.Vector2(0,0), -i * piAngle + scope.angleOffset));
		}

		scope._charts.forEach(function (value) {

			var acc = normVecs.map(function () {
				return 0;
			});

			// console.log(value);

			value.normals.forEach(function (vec3) {
				var vec2 = new THREE.Vector2(vec3.x, vec3.z).normalize();

				var angle = Math.acos(vec2.y);
				if (vec2.x < 0)
					angle = angle * -1 + 2 * Math.PI;

				var temp = (angle + scope.angleOffset) / piAngle;
				var index = Math.floor(temp);
				var t = temp - index;

				acc[index % angleSteps] += 1.0 - t;
				acc[(index + 1) % angleSteps] += t;
			});

			var maxScalar = 0;

			// gaussian blur values [1 4 6 4 1]
			value.acc = acc.map(function (value, index) {
				var blur = (acc[(index + 2) % acc.length] + acc[(index + 1) % acc.length] * 4 + 6 * value + acc[(index - 1 + acc.length) % acc.length] * 4 + acc[(index - 1 + acc.length) % acc.length]) / 16;

				maxScalar = Math.max(blur, maxScalar);

				return blur;
			});

			maxScalarGlobal = Math.max(maxScalarGlobal, maxScalar);
			// console.log(maxScalar, value.normals.length, maxScalar * value.normals.length / maxCount);
			// maxScalar *= value.normals.length / maxCount;
		});

		scope._charts.forEach(function (value) {

			var acc = value.acc;

			var sampleVecs = acc.map(function (value, index) {
				// return normVecs[index].clone().setLength(value / maxScalar);
				return normVecs[index].clone().setLength(value / maxScalarGlobal);
				// return normVecs[index].clone().setLength(value / maxScalar).multiplyScalar(canvasWidth / 2);
			});

			var origin = new THREE.Vector2(canvasWidth / 2, canvasWidth / 2);

			// create canvas material and geometry
			var canvas = document.createElement('canvas');
			canvas.setAttribute('width', canvasWidth.toString());
			canvas.setAttribute('height', canvasWidth.toString());

			// var geometry = new THREE.PlaneBufferGeometry(150, 150);
			var geometry = new THREE.PlaneBufferGeometry(minDistance * 1.3, minDistance * 1.3);
			geometry.rotateX(-Math.PI / 2);

			var material = new THREE.MeshBasicMaterial({
				map: new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter, THREE.RGBAFormat, THREE.UnsignedByteType, 4),
				transparent: true,
				depthTest: false,
				depthWrite: false
			});

			var mesh = new THREE.Mesh(geometry, material);
			// mesh.position.set(value.position.x, 0, value.position.z);
			mesh.position.copy(value.position);
			mesh.renderOrder = 50;
			value.object = mesh;
			scope.add(mesh);

			// draw chart
			var ctx = canvas.getContext('2d');

			// [canvasWidth / 6, canvasWidth / 3, canvasWidth / 2].forEach(function (r) {
			// 	ctx.beginPath();
			// 	ctx.arc(origin.x, origin.y, r, 0, 2 * Math.PI);
			// 	ctx.stroke();
			// });

			var arc = d3.arc()
				.innerRadius(0)
				.context(ctx);

			ctx.translate(origin.x, origin.y);

			// important for text orientation
			var viewAngleOffset = new THREE.Vector2(value.position.x, value.position.z).sub(new THREE.Vector2(camera.position.x, camera.position.z)).angle() + Math.PI / 2;
			ctx.rotate(viewAngleOffset);

			sampleVecs.forEach(function (vec, index) {

				var angle = vec.angle();

				// var offset = Math.round(acc[index] / maxScalar * 255) * 4;
				var offset = Math.round(acc[index] / maxScalarGlobal * 255) * 4;

				var radius = Math.sqrt(vec.length() * maxArea * Math.PI / piAngle);
				// var radius = Math.sqrt(vec.length() * maxArea * Math.PI / piAngle * acc[index] / maxScalarGlobal);

				ctx.beginPath();
				ctx.lineWidth = 1.0;
				ctx.fillStyle = 'rgba(' + scope._palette[offset] + ',' + scope._palette[offset + 1] + ',' + scope._palette[offset + 2] + ', 0.7)';

				var p1 = new THREE.Vector2(radius, 0).rotateAround(new THREE.Vector2(), angle - piAngle / 2 - viewAngleOffset);
				var p2 = new THREE.Vector2(radius, 0).rotateAround(new THREE.Vector2(), angle + piAngle / 2 - viewAngleOffset);
				var tip = new THREE.Vector2(radius + p1.distanceTo(p2) / 2, 0).rotateAround(new THREE.Vector2(), angle - viewAngleOffset);

				ctx.moveTo(0, 0);
				ctx.lineTo(p1.x, p1.y);
				ctx.lineTo(tip.x, tip.y);
				ctx.lineTo(p2.x, p2.y);
				ctx.closePath();
				// arc({
				// 	outerRadius: radius, //vec.length(),
				// 	startAngle: angle - piAngle / 2 + Math.PI / 2 - viewAngleOffset,
				// 	endAngle: angle + piAngle / 2 + Math.PI / 2 - viewAngleOffset
				// });
				ctx.stroke();
				ctx.fill();

				// var textPos = new THREE.Vector2(radius - 14,0).rotateAround(new THREE.Vector2(), angle - viewAngleOffset);
				// ctx.fillStyle = 'black';
				// ctx.font = '14px sans-serif';
				// ctx.textAlign = 'center';
				// ctx.textBaseline = 'middle';
				// ctx.fillText(acc[index].toFixed(1), textPos.x, textPos.y);
			});

		});

		console.log('RadialFan - Elapsed time', Date.now() - startTime, 'ms');

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

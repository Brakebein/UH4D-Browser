DV3D.RadarChart2 = function () {

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

DV3D.RadarChart2.prototype = Object.assign( Object.create(THREE.Object3D.prototype), {

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

	update: function (camera, center, normals) {

		var scope = this;
		scope.dispose();

		// parameters
		var canvasWidth = 500,
			angleSteps = scope.angleResolution,
			piAngle = 2 * Math.PI / angleSteps;
			//angleOffset = piAngle * 1.5;


		// set chart position
		scope.position.set(center.x, 0, center.z);

		// chart basic normals
		var normVecs = [];
		for (var i = 0; i < angleSteps; i++) {
			normVecs.push(new THREE.Vector2(0, 1).rotateAround(new THREE.Vector2(0,0), -i * piAngle + scope.angleOffset));
		}

		var acc = normVecs.map(function () {
			return 0;
		});

		//console.log(normals);

		normals.forEach(function (vec3) {
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

		var maxScalar = 0,
			maxArea = Math.pow(canvasWidth / 2, 2) * piAngle / Math.PI;

		// gaussian blur values [1 4 6 4 1]
		acc = acc.map(function (value, index) {
			var blur = (acc[(index + 2) % acc.length] + acc[(index + 1) % acc.length] * 4 + 6 * value + acc[(index - 1 + acc.length) % acc.length]* 4 + acc[(index - 1 + acc.length) % acc.length]) / 16;

			maxScalar = Math.max(blur, maxScalar);

			return blur;
		});

		var sampleVecs = acc.map(function (value, index) {
			return normVecs[index].clone().setLength(value / maxScalar);
			// return normVecs[index].clone().setLength(value / maxScalar).multiplyScalar(canvasWidth / 2);
		});

		var origin = new THREE.Vector2(canvasWidth / 2, canvasWidth / 2);

		// create canvas material and geometry
		var canvas = document.createElement('canvas');
		canvas.setAttribute('width', canvasWidth.toString());
		canvas.setAttribute('height', canvasWidth.toString());

		var geometry = new THREE.PlaneBufferGeometry(150, 150);
		geometry.rotateX(-Math.PI / 2);

		var material = new THREE.MeshBasicMaterial({
			map: new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter, THREE.RGBAFormat, THREE.UnsignedByteType, 4),
			transparent: true,
			depthTest: false,
			depthWrite: false
		});

		var mesh = new THREE.Mesh(geometry, material);
		scope._chart = mesh;
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
		var viewAngleOffset = new THREE.Vector2(center.x, center.z).sub(new THREE.Vector2(camera.position.x, camera.position.z)).angle() + Math.PI / 2;
		ctx.rotate(viewAngleOffset);

		sampleVecs.forEach(function (vec, index) {

			var angle = vec.angle();

			var offset = Math.round(acc[index] / maxScalar * 255) * 4;

			var radius = Math.sqrt(vec.length() * maxArea * Math.PI / piAngle);

			ctx.beginPath();
			ctx.lineWidth = 1.0;
			ctx.fillStyle = 'rgba(' + scope._palette[offset] + ',' + scope._palette[offset + 1] + ',' + scope._palette[offset + 2] + ', 0.7)';
			arc({
				outerRadius: radius, //vec.length(),
				startAngle: angle - piAngle / 2 + Math.PI / 2 - viewAngleOffset,
				endAngle: angle + piAngle / 2 + Math.PI / 2 - viewAngleOffset
			});
			ctx.stroke();
			ctx.fill();

			var textPos = new THREE.Vector2(radius - 14,0).rotateAround(new THREE.Vector2(), angle - viewAngleOffset);
			ctx.fillStyle = 'black';
			ctx.font = '14px sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(acc[index].toFixed(1), textPos.x, textPos.y);
		});

	},

	dispose: function () {
		var scope = this;
		if (!this._chart) return;
		var obj = scope._chart;
		scope.remove(obj);
		obj.geometry.dispose();
		obj.material.map.dispose();
		obj.material.dispose();
		this._chart = null;
	}

});
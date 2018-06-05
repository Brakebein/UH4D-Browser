(function () {

DV3D.OLIC = function () {
	
	var container = document.querySelector('.heatmap');
	var canvas = document.createElement('canvas');
	this._width = canvas.width = 500;
	this._height = canvas.height = 500;
	
	container.appendChild(canvas);
	
	this._canvas = canvas;

	// initial geometry
	var geometry = new THREE.PlaneBufferGeometry(1, 1);
	geometry.rotateX(-Math.PI / 2);

	// material with CanvasTexture
	var material = new THREE.MeshBasicMaterial({
		map: new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter)
		// transparent: true,
		// depthTest: false,
		// depthWrite: false
	});
	
	THREE.Mesh.call(this, geometry, material);

	this._config = {
		h: 0.5,
		L: 20,
		M: 20,
		dimPixel: 3,
		offset: 0
	};

};

DV3D.OLIC.prototype = Object.assign( Object.create(THREE.Mesh.prototype), {
	
	update: function (camera, callback) {

		// determine vector field / callback

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
		var resolution = 200 / distance;

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

		// set dimensions
		var dimension = new THREE.Vector2(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y);
		var width = this._width = this._canvas.width = Math.ceil(dimension.x * resolution);
		var height = this._height = this._canvas.height = Math.ceil(dimension.y * resolution);

		console.log(width, height);

		// set new plane geometry
		var geometry = new THREE.PlaneBufferGeometry(dimension.x, dimension.y);
		geometry.rotateX(-Math.PI / 2);
		geometry.translate(dimension.x / 2  + bbox.min.x, 0, dimension.y / 2 + bbox.min.y);

		this.geometry.dispose();
		this.geometry = geometry;

		this.arrows = [];
		var maxCount = 0;

		for (var iy = 0, ly = height; iy < ly; iy++) {
			for (var ix = 0, lx = width; ix < lx; ix++) {
				var pos = new THREE.Vector3(Math.round(ix / resolution + bbox.min.x), 0, Math.round(iy / resolution + bbox.min.y));
				var props = callback(pos);

				var dir = new THREE.Vector3(props.direction.x, 0, props.direction.z);

				if (!(props.direction.x === 0 && props.direction.z === 0))
					dir.normalize();

				maxCount = Math.max(maxCount, props.count);
				this.arrows.push({
					direction: dir,
					position: pos,
					count: props.count,
					dirWeight: props.dirWeight,
					disWeight: props.disWeight
				});
			}
		}


		// algorithm params
		var minMumHits = 1;


		// // initialize vectors
		// var Idata = this._Idata = new Float32Array(width * height); // intensity data
		// var numHits = this._numHits = new Uint32Array(width * height); // pixel hit data
		// var texData = this._texData = new Float32Array(width * height); // texture data
		//
		// generateNoise.call(this);
		//
		// // compute LICs
		// var w2 = width / 2,
		// 	h2 = height / 2;
		// for (var i = 0, l = w2 * h2; i < l; i++) {
		// 	var p1x = i % w2,
		// 		p1y = (i / w2) >> 0,
		// 		p2x = (i % w2) + w2,
		// 		p2y = p1y,
		// 		p3x = p1x,
		// 		p3y = ((i / w2) >> 0) + h2,
		// 		p4x = p2x,
		// 		p4y = p3y,
		// 		streamLine;
		//
		// 	if (numHits[p1x + p1y * width] < minMumHits) {
		// 		streamLine = computeStreamLine.call(this, p1x, p1y);
		// 		I.call(this, streamLine);
		// 	}
		// 	if (numHits[p2x + p2y * width] < minMumHits) {
		// 		streamLine = computeStreamLine.call(this, p2x, p2y);
		// 		I.call(this, streamLine);
		// 	}
		// 	if (numHits[p3x + p3y * width] < minMumHits) {
		// 		streamLine = computeStreamLine.call(this, p3x, p3y);
		// 		I.call(this, streamLine);
		// 	}
		// 	if (numHits[p4x + p4y * width] < minMumHits) {
		// 		streamLine = computeStreamLine.call(this, p4x, p4y);
		// 		I.call(this, streamLine);
		// 	}
		// }
		//
		// // normalize LICs
		// for (i = 0, l = width * height; i < l; i++) {
		// 	Idata[i] /= (numHits[i] || 1);
		// }

		var uMin = 0,
			uMax = 0,
			vMin = 0,
			vMax = 0;


		// render LIC
		var vCanvas = document.createElement('canvas');
		vCanvas.width = width;
		vCanvas.height = height;
		var ctx = vCanvas.getContext('2d');
		var imageData = ctx.createImageData(width, height),
			data = imageData.data;

		for (var i = 0, l = width * height; i < l; i++) {
			var i4 = i * 4,
				// gray = (Idata[i] * 255) >> 0;
				//gray = (texData[i] * 255) >> 0;
				a = this.arrows[i];


			uMin = Math.min(uMin, a.direction.x * a.disWeight);
			uMax = Math.max(uMax, a.direction.x * a.disWeight);
			vMin = Math.min(vMin, -a.direction.z * a.disWeight);
			vMax = Math.min(vMax, -a.direction.z * a.disWeight);

			// data[i4] = gray;
			// data[i4+1] = gray;
			// data[i4+2] = gray;
			// data[i4+3] = 255;

			data[i4] = (a.direction.x * a.disWeight * 127 + 128) >> 0;
			data[i4+1] = (-a.direction.z * a.disWeight * 127 + 128) >> 0;
			data[i4+2] = 0;
			data[i4+3] = 255;
		}

		ctx.putImageData(imageData, 0, 0);

		console.log(uMin, uMax, vMin, vMax);

		console.log(imageData);
		var windImage = new Image();
		windImage.src = vCanvas.toDataURL('image/png');
		console.log(windImage);

		var container = document.querySelector('.heatmap');
		container.appendChild(windImage);


		var windData = {
			width: width,
			height: height,
			uMin: -10,
			uMax: 10,
			vMin: -10,
			vMax: 10,
			image: windImage
		};

		this._canvas.width = width * 10;
		this._canvas.height = height * 10;
		var gl = this._canvas.getContext('webgl', {antialiasing: false});
		var wind = new WindGL(gl);
		wind.numParticles = 10000;
		//wind.speedFactor = 0.5;

		windImage.onload = function() {
			wind.setWind(windData);
		};


		//wind.draw();

		function frame() {
			if (wind.windData)
				wind.draw();
			requestAnimationFrame(frame);
		}
		frame();

		this.material.map.needsUpdate = true;
	}
	
});

// generate white noise texture
function generateNoise() {
	var texData = this._texData,
		w = this._width,
		h = this._height,
		dimPixel = this._config.dimPixel;
	for (var i = 0, l = texData.length; i < l; i++) {
		if (Math.random() > 0.996) {
			var x = i % w,
				y = (i / w) >> 0;

			if (x < w - dimPixel && y < h - dimPixel) {
				for (var k = 0; k < dimPixel; k++) {
					for (var j = 0; j < dimPixel; j++)
						texData[(x + k) + (y + j) * w] = 1;
				}
			}
		}
	}
}

function computeStreamLine(x, y) {
	var fwd = [],
		bwd = [],
		f = new THREE.Vector2(x, y),
		b = new THREE.Vector2(x, y);

	for (var i = 0, l = this._config.L + this._config.M - 1; i < l; i++) {
		f = RK.call(this, f, this._config.h);
		fwd[i] = f;

		b = RK.call(this, b, -this._config.h);
		bwd[i] = b;
	}

	bwd.reverse();
	bwd.push.apply(bwd, fwd);

	// convert to pixel
	for (i = 0, l = bwd.length; i < l; i++) {
		var p = bwd[i];
		p.x >>= 0;
		p.y >>= 0;
	}

	return bwd;
}

// Runge-Kutta-Verfahren
function RK(p, h) {
	var v = field.call(this, p),
		k1, k2, k3, k4;

	k1 = v.multiplyScalar(h);

	v = field.call(this, new THREE.Vector2().addVectors(p, k1.clone().multiplyScalar(0.5)));
	k2 = v.multiplyScalar(h);

	v = field.call(this, new THREE.Vector2().addVectors(p, k2.clone().multiplyScalar(0.5)));
	k3 = v.multiplyScalar(h);

	v = field.call(this, new THREE.Vector2().addVectors(p, k3));
	k4 = v.multiplyScalar(h);

	return p.clone().add(k1.multiplyScalar(1/6)).add(k2.multiplyScalar(1/3)).add(k3.multiplyScalar(1/3)).add(k4.multiplyScalar(1/6));
}

// vector field definition
function field(v2) {
	var a = this.arrows[v2.x + v2.y * this._width];
	// var x = v2.x - 250,
	// 	y = v2.y - 250;
	// var v = new THREE.Vector2(-y, x);
	// var v = new THREE.Vector2(x, y);
	if (!a || !a.direction)
		return new THREE.Vector2(0,0);

	var v = new THREE.Vector2(a.direction.x, a.direction.z);

	if (v.length() === 0)
		return new THREE.Vector2(0,0);

	return v.normalize();//.multiplyScalar(2);
}

// Integral
function I(streamLine) {
	var l = streamLine.length,
		n = this._config.L,
		mid = ((l / 2) >> 0),
		x0 = streamLine[mid],
		k = 0,
		acum = 0;

	// compute integral for center of streamline
	for (var i = -n, Ix0 = 0; i < n; i++) {
		var xi = streamLine[mid + i];
		if (xi.x >= 0 && xi.x < this._width && xi.y >= 0 && xi.y < this._height) { // in bounds?
			Ix0 += this._texData[xi.x + xi.y * this._width] * ((n + i) % (2 * n)) / (2 * n);
			acum += ((n + i) % (2 * n)) / (2 * n);
			k++;
		}
	}
	Ix0 /= acum;

	this._Idata[x0.x + x0.y * this._width] += Ix0;
	this._numHits[x0.x + x0.y * this._width]++;
}

})();
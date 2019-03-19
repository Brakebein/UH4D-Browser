DV3D.HeatMap3 = function (container0, canvas0) {

	var container = container0 || document.createElement('div'),
		canvas = canvas0 || document.createElement('canvas');
	this._width = canvas.width = 100;
	this._height = canvas.height = 100;

	// initial geometry
	var geometry = new THREE.PlaneBufferGeometry(1, 1);
	geometry.rotateX(-Math.PI / 2);

	// material with CanvasTexture
	var material = new THREE.MeshBasicMaterial({
		map: new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter),
		transparent: true,
		depthTest: false,
		depthWrite: false
	});

	THREE.Mesh.call(this, geometry, material);

	this.radius = 30;

	this.renderOrder = 500;

	// initialize heat map
	this._heatmap = h337.create({
		container: container,
		canvas: canvas,
		blur: 0.95,
		radius: 1.5,
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

DV3D.HeatMap3.prototype = Object.assign( Object.create(THREE.Mesh.prototype), {

	setRadius: function (radius) {
		this.radius = radius;
	},

	update: function (camera, items, onComplete) {

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
			resolution = 100 / distance;

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
		maxSphere.radius = distance * 1.5;

		rays.forEach(function (ray) {
			var intersection = ray.intersectPlane(plane);
			if (!intersection)
				intersection = ray.intersectSphere(maxSphere);
			bbox.expandByPoint(new THREE.Vector2(intersection.x, intersection.z));
		});

		// set heat map dimensions
		var dimension = new THREE.Vector2(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y);
		this._heatmap._renderer.setDimensions(Math.ceil(dimension.x * resolution), Math.ceil(dimension.y * resolution));

		// set new plane geometry
		var geometry = new THREE.PlaneBufferGeometry(dimension.x, dimension.y);
		geometry.rotateX(-Math.PI / 2);
		geometry.translate(dimension.x / 2  + bbox.min.x, 0, dimension.y / 2 + bbox.min.y);

		this.geometry.dispose();
		this.geometry = geometry;

		// initiate matrix with zero values
		var matrix = [];

		for (var iy = 0, ly = Math.ceil(dimension.y * resolution); iy < ly; iy++) {
			matrix.push([]);
			for (var ix = 0, lx = Math.ceil(dimension.x * resolution); ix < lx; ix++) {
				matrix[iy].push(0);
			}
		}

		var radius = Math.round(this.radius * resolution),
			indexBbox = new THREE.Box2(new THREE.Vector2(0,0), new THREE.Vector2(matrix[0].length - 1, matrix.length - 1));

		// iterate over items and increment values within radius
		items.forEach(function (item) {
			// skip if item is outside of view
			if (!bbox.containsPoint(new THREE.Vector2(item.position.x, item.position.z)))
				return;

			var ox = Math.round((item.position.x - bbox.min.x) * resolution),
				oy = Math.round((item.position.z - bbox.min.y) * resolution);

			for (var y = -radius; y < radius; y++) {
				var width = Math.round(Math.sqrt(radius*radius - y*y));

				for (var x = -width; x < width; x++) {
					if (indexBbox.containsPoint(new THREE.Vector2(ox + x, oy + y)))
						matrix[oy + y][ox + x]++;
				}
			}
		});

		// pass values to _heatmap conform structure
		var points = [],
			maxValue = 1;

		for (iy = 0, ly = matrix.length; iy < ly; iy++) {
			for (ix = 0, lx = matrix[iy].length; ix < lx; ix++) {
				var count = matrix[iy][ix];
				if (count !== 0) {
					points.push({
						x: ix,
						y: iy,
						value: count
					});
					maxValue = Math.max(maxValue, count);
				}
			}
		}

		// update heat map
		this._heatmap.setData({
			max: maxValue,
			min: 1,
			data: points
		});

		this.material.map.needsUpdate = true;

		if (onComplete)
			onComplete({
				gradient: this._heatmap._config.gradient,
				scale: { min: 0, max: maxValue }
			});

		console.log('HeatMap - Elapsed time', Date.now() - startTime, 'ms');

	},
	
	dispose: function () {
		this.geometry.dispose();
		this.material.map.dispose();
		this.material.dispose();
	}

});
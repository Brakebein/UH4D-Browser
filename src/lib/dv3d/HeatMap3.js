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

	update: function (camera, callback) {

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
		var resolution = 100 / distance;

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
		this._heatmap._renderer.setDimensions(Math.ceil(dimension.x * resolution), Math.ceil(dimension.y * resolution));

		// set new plane geometry
		var geometry = new THREE.PlaneBufferGeometry(dimension.x, dimension.y);
		geometry.rotateX(-Math.PI / 2);
		geometry.translate(dimension.x / 2  + bbox.min.x, 0, dimension.y / 2 + bbox.min.y);

		this.geometry.dispose();
		this.geometry = geometry;

		// callback for each grid point to get frequency of occurrence
		var points = [];
		var maxValue = 1;

		for (var iy = 0, ly = dimension.y; iy < ly; iy += 1 / resolution) {
			for (var ix = 0, lx = dimension.x; ix < lx; ix += 1 / resolution) {
				var vector = new THREE.Vector3(Math.round(ix + bbox.min.x), 0, Math.round(iy + bbox.min.y));
				var count = callback(vector);

				if (count !== 0) {
					points.push({
						x: Math.round(ix * resolution),
						y: Math.round(iy * resolution),
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
	},
	
	dispose: function () {
		this.geometry.dispose();
		this.material.map.dispose();
		this.material.dispose();
	}

});
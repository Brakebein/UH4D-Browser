DV3D.ObjectHeatMap = function ( object, camera ) {

	this.object = object;
	this.camera = camera;

	this._originalUVs = object.geometry.attributes.uv;
	this._originalMat = object.material;

	var canvas = document.createElement('canvas');

	// initialize heat map
	this._heatmap = h337.create({
		container: document.createElement('div'),
		canvas: canvas,
		blur: 0.95,
		radius: 1.5,
		baseColor: '#2b83ba',//'#' + this._originalMat.color.getHexString(),
		gradient: {
			//0.0: '#00ff32',
			0.3: '#2b83ba', // blue
			0.5: '#abdda4', // cyan
			0.7: '#ffffbf', // green
			0.9: '#fdae61', // yellow
			1.0: '#d7191c'  // red
		}
	});

	this._heatmapMaterial = new THREE.MeshLambertMaterial({
		map: new THREE.CanvasTexture(canvas, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter)
	});

};

DV3D.ObjectHeatMap.prototype = {

	computeUVs: function () {

		var pos = this.object.geometry.attributes.position;
		var uvArray = [];

		for (var i = 0; i < pos.count; i++) {
			var index = i * pos.itemSize;

			var vertex = new THREE.Vector3(pos.array[index], pos.array[index+1], pos.array[index+2]).applyMatrix4(this.object.matrixWorld);
			vertex.project(this.camera);

			uvArray.push((vertex.x + 1) / 2, (vertex.y + 1) / 2);
		}

		var uvAttribute = new THREE.BufferAttribute(new Float32Array(uvArray), 2);
		this.object.geometry.addAttribute('uv', uvAttribute);

		// var scope = this;
		// new THREE.TextureLoader().load('img/custom_uv_diag.png', function (texture) {
		// 	scope.object.material = new THREE.MeshBasicMaterial({ map: texture });
		// });
	},

	computeMap: function (callback, onProgress, onComplete) {

		var scope = this;

		var resWidth = 100,
			resHeight = 100;

		this._heatmap._renderer.setDimensions(resWidth, resHeight);

		var points = [];
		var maxValue = 1;

		var startTime = Date.now();

		// console.log('start callback');

		// for (var iy = 0; iy < resHeight; iy++) {
		//
		// 	function timeout() {
		//
		//
		// 		for (var ix = 0; ix < resWidth; ix++) {
		//
		// 			var vpCoord = new THREE.Vector2((ix / resWidth) * 2 - 1, -(iy / resHeight) * 2 + 1);
		// 			var count = callback(vpCoord, this.object);
		//
		// 			if (count !== 0) {
		// 				points.push({
		// 					x: ix,
		// 					y: iy,
		// 					value: count
		// 				});
		// 				maxValue = Math.max(maxValue, count);
		// 			}
		//
		// 		}
		// 	}
		// 	console.log(iy);
		// 	if (onProgress) onProgress(iy, resHeight);
		// }

		step(0);

		function step(iy) {

			for (var ix = 0; ix < resWidth; ix++) {

				var vpCoord = new THREE.Vector2((ix / resWidth) * 2 - 1, -(iy / resHeight) * 2 + 1);
				var count = callback(vpCoord, scope.object);

				if (count !== 0) {
					points.push({
						x: ix,
						y: iy,
						value: count
					});
					maxValue = Math.max(maxValue, count);
				}

			}

			// console.log(iy);
			if (onProgress) onProgress(iy + 1, resHeight);

			if (iy < resHeight - 1)
				setTimeout(step, 25, iy + 1);
			else
				finish();
		}

		function finish() {
			console.log('ObjectHeatMap - Elapsed time:', (Date.now() - startTime) / 1000, 'sec');

			// update heat map
			scope._heatmap.setData({
				max: maxValue,
				min: 1,
				data: points
			});

			console.log(scope._heatmap);

			scope._heatmapMaterial.needsUpdate = true;
			scope.object.material = scope._heatmapMaterial;

			if (onComplete) onComplete();
		}

	},

	dispose: function () {
		if (this._originalUVs)
			this.object.geometry.attributes.uv = this._originalUVs;
		else
			this.object.geometry.removeAttribute('uv');

		this.object.material = this._originalMat;
		this._heatmapMaterial.dispose();
	}

};

/**
 * A plane to visualize a heat map. Determine an amount/quantity for each vertex position. The vertices will be colored according their determined amount and the overall maximum amount.
 * @param width {number} Width along the X axis
 * @param height {number} Height/length along the Z axis
 * @param widthSegments {number} Width segments
 * @param heightSegments {number} Height/length segments
 * @extends THREE.Mesh
 * @constructor
 */
DV3D.HeatMap = function (width, height, widthSegments, heightSegments) {

	var geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
	geometry.rotateX(-Math.PI / 2);

	// setup 2-dimensional matrix for vertex colors
	var vc = [];
	geometry.vertexColorMatrix = vc;

	for (var i = 0, l = heightSegments + 1; i < l; i++) {
		var row = [];
		vc.push(row);

		for (var j = 0, k = widthSegments + 1; j < k; j++) {
			row.push(new THREE.Color());
		}
	}

	// setup faces and reference to vertexColorMatrix
	geometry.faces.forEach(function (face, index) {
		var rowIndex = Math.floor(index / (widthSegments * 2)),
			colIndex = Math.floor((index % (widthSegments * 2)) / 2);

		if (index % 2 === 0) {
			face.vertexColors.push(vc[rowIndex][colIndex]);
			face.vertexColors.push(vc[rowIndex + 1][colIndex]);
			face.vertexColors.push(vc[rowIndex][colIndex + 1]);
		}
		else {
			face.vertexColors.push(vc[rowIndex + 1][colIndex]);
			face.vertexColors.push(vc[rowIndex + 1][colIndex + 1]);
			face.vertexColors.push(vc[rowIndex][colIndex + 1]);
		}
	});

	var material = new THREE.MeshBasicMaterial({
		vertexColors: THREE.VertexColors
	});

	THREE.Mesh.call(this, geometry, material);

	// heatMap colors
	this.heatMapColors = [
		new THREE.Color(0x2b83ba), // blue
		new THREE.Color(0xabdda4), // cyan
		new THREE.Color(0xffffbf), // green
		new THREE.Color(0xfdae61), // yellow
		new THREE.Color(0xd7191c)  // red
	];

};

DV3D.HeatMap.prototype = Object.assign( Object.create(THREE.Mesh.prototype), {

	toggleOverlay: function (bool) {
		if (bool) {
			this.material.transparent = true;
			this.material.opacity = 0.5;
			this.material.depthTest = false;
			this.material.deptthWrite = false;
		}
		else {
			this.material.transparent = false;
			this.material.opacity = 1;
			this.material.depthTest = true;
			this.material.deptthWrite = true;
		}
	},

	/**
	 * Determine an amount/quantity for each vertex position. The vertices will be colored according their determined amount and the overall maximum amount.
	 * @param callback {function} A callback function for each vertex with its position in global space. As return value it expects a value for an amount/quantity of this position.
	 */
	update: function (callback) {
		var vc = this.geometry.vertexColorMatrix;
		var maxCount = 0,
			countMatrix = [],
			originX = -this.geometry.parameters.width / 2,
			originZ = -this.geometry.parameters.height / 2,
			distanceX = this.geometry.parameters.width / this.geometry.parameters.widthSegments,
			distanceZ = this.geometry.parameters.height / this.geometry.parameters.heightSegments;

		// collect values
		for (var i = 0, l = vc.length, k = vc[0].length; i < l; i++) {
			var row = [];
			countMatrix.push(row);

			for (var j = 0; j < k; j++) {
				var vertexPosition = new THREE.Vector3(j * distanceX + originX, 0, i * distanceZ + originZ).applyMatrix4(this.matrixWorld);

				var count = callback(vertexPosition, j, i);

				row.push(count);
				if (count > maxCount)
					maxCount = count;
			}
		}

		// set color
		var colors = this.heatMapColors;

		for (i = 0; i < l; i++) {
			for (j = 0; j < k; j++) {
				var alpha = countMatrix[i][j] / maxCount;
				if (alpha < 0.25)
					vc[i][j].copy(colors[0].clone().lerp(colors[1], alpha * 4));
				else if (alpha < 0.5)
					vc[i][j].copy(colors[1].clone().lerp(colors[2], alpha * 4 - 1));
				else if (alpha < 0.75)
					vc[i][j].copy(colors[2].clone().lerp(colors[3], alpha * 4 - 2));
				else
					vc[i][j].copy(colors[3].clone().lerp(colors[4], alpha * 4 - 3));
			}
		}

		this.geometry.elementsNeedUpdate = true;
	},

	/**
	 * Dispose geometry and material.
	 */
	dispose: function () {
		this.geometry.dispose();
		this.material.dispose();
	}

});

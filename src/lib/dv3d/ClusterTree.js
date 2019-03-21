(function () {

var scene = undefined,
	octree = undefined;

DV3D.ClusterTree = function (sceneParam, octreeParam) {

	this.root = null;

	scene = sceneParam;
	octree = octreeParam;

	this._activeClusters = [];

	this._distanceMultiplier = 10;

};

// TODO: clean code

DV3D.ClusterTree.prototype = {

	insert: function () {

	},

	bulkInsert: function (objects) {

		this.clean();

		var startTime = Date.now();

		var tmp = [].concat(objects),
			depth = 0;

		function clusterNearest() {

			var a = tmp[0],
				b = tmp[1],
				tempDist = a.position.distanceTo(b.position);

			for (var i = 0, l = tmp.length; i < l; i++) {
				for (var j = i + 1; j < l; j++) {
					var d = tmp[i].position.distanceTo(tmp[j].position);

					if (d < tempDist) {
						tempDist = d;
						a = tmp[i];
						b = tmp[j];
					}
				}
			}

			var cluster = new DV3D.ClusterObject([a, b], depth, tempDist);

			tmp.splice(tmp.indexOf(a), 1);
			tmp.splice(tmp.indexOf(b), 1);

			tmp.push(cluster);

			depth++;
		}

		while (tmp.length > 1) {
			clusterNearest();
		}

		this.root = tmp[0];

		console.log('ClusterTree - Build Elapsed time', Date.now() - startTime, 'ms');
		console.log('ClusterTree - root', this.root);

	},

	clean: function () {
		this._activeClusters.forEach(function (c) {
			if (c instanceof DV3D.ClusterObject)
				c.toggle(false);
			else {
				// remove ImagePane
				scene.remove(c);
				octree.remove(c.collisionObject);
				c.entry.visible = false;
			}
		});

		this._activeClusters = [];

		if (!this.root) return;

		if (this.root instanceof DV3D.ClusterObject) {
			this.root.traverse(function (node) {
				node.dispose();
			});
		}

		this.root = null;
	},

	getActiveClusters: function () {
		return this._activeClusters.filter(function (value) {
			return value instanceof DV3D.ClusterObject;
		});
	},

	getActiveLeaves: function () {
		return this._activeClusters.filter(function (value) {
			return !(value instanceof DV3D.ClusterObject);
		});
	},

	getObjectsByThreshold: function (threshold, callback) {

		function traverse(node) {
			if (!(node instanceof DV3D.ClusterObject)) {
				callback(node);
				return;
			}

			if (node.distance < threshold) {
				callback(node);
			}
			else {
				node.children.forEach(function (child) {
					traverse(child);
				});
			}
		}

		traverse(this.root);

	},

	setDistanceMultiplier: function (value) {
		this._distanceMultiplier = value;
	},

	getObjectsByDistance: function (position) {

		var scope = this,
			tmp = [];

		if (scope.root instanceof DV3D.ClusterObject) {
			// traverse tree
			scope.root.traverse(function (node) {
				if (!(node instanceof DV3D.ClusterObject) || node.position.distanceTo(position) > node.distance * scope._distanceMultiplier) {
					tmp.push(node);
					return false;
				}
			}, true);
		}
		else {
			// there is only one single object in tree
			tmp.push(scope.root);
		}

		return tmp;

	},

	// traverse: function (callback, element) {
	// 	function t(node) {
	// 		if (callback(node) !== false && node instanceof DV3D.ClusterObject) {
	// 			node.children.forEach(function (child) {
	// 				t(child);
	// 			});
	// 		}
	// 	}
	// 	if (element && element instanceof DV3D.ClusterObject)
	// 		t(element);
	// 	else
	// 		t(this.root);
	// },

	getCollisionObjects: function () {

		return this._activeClusters.map(function (c) {
			return c.collisionObject;
		});

	},

	hide: function () {
		this._activeClusters.forEach(function (c) {
			if (c instanceof DV3D.ClusterObject) {
				c.toggle(false);
			}
			else {
				// remove ImagePane
				scene.remove(c);
				octree.remove(c.collisionObject);
				c.entry.visible = false;
			}
		});
	},

	update: function (camera) {

		var scope = this;

		if (!scope.root) return;

		// handle outdated objects
		scope._activeClusters.forEach(function (c) {
			if (c instanceof DV3D.ClusterObject) {
				c.toggle(false);
			}
			else {
				// remove ImagePane
				scene.remove(c);
				octree.remove(c.collisionObject);
				c.entry.visible = false;
			}
		});

		// scope._activeClusters = [];
		//
		// scope.getObjectsByThreshold(40, function (obj) {
		// 	scope._activeClusters.push(obj);
		// });

		scope._activeClusters = scope.getObjectsByDistance(camera.position);

		// activate new objects
		scope._activeClusters.forEach(function (c) {
			if (c instanceof DV3D.ClusterObject) {
				c.toggle(true);
				c.lookAt(camera.position);
			}
			else {
				// add ImagePane
				scene.add(c);
				octree.add(c.collisionObject);
				c.entry.visible = true;
			}
		});

		octree.update();

	},

	drawDebugGraph: function () {

		var geometry = new THREE.Geometry();

		var colorStep = 0.75 / (this.root.depth - 1);

		function traverse(node, parentPos) {
			if (parentPos) {
				geometry.vertices.push(parentPos, node.position);

				var color;
				if (node instanceof DV3D.ClusterObject)
					color = new THREE.Color().setHSL((node.depth - 1) * colorStep, 1.0, 0.5);
				else
					color = new THREE.Color(0xaaaaaa);

				geometry.colors.push(color, color);
			}

			if (node instanceof DV3D.ClusterObject)
				node.children.forEach(function (child) {
					traverse(child, node.position);
				});
		}

		traverse(this.root, null);

		this._debugGraph = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors, depthWrite: false, depthTest: false}));

		scene.add(this._debugGraph);

	}

};


DV3D.ClusterObject = function (children, depth, distance) {

	var scope = this;

	scope.active = false;

	scope.children = children || [];

	scope.count = children.reduce(function (sum, obj) {
		var count = 1;
		if (obj instanceof DV3D.ClusterObject) {
			count = obj.count;
			obj.parent = scope;
		}
		return sum + count;
	}, 0);

	scope.depth = depth || 0;
	scope.distance = distance || children[0].position.distanceTo(children[1].position);

	scope.parent = undefined;

	scope.position = children.reduce(function (vector, obj) {
		return vector.add(obj.position.clone().multiplyScalar((obj instanceof DV3D.ClusterObject ? obj.count : 1) / scope.count));
	}, new THREE.Vector3());

	scope.objectMap = {};
	scope.object = new THREE.Group();
	this.object.position.copy(this.position);

};

DV3D.ClusterObject.prototype = {

	toggle: function (visible) {

		// create visible objects
		if (!this.objectMap.images) {

			var lineVertices = [],
				bbox = new THREE.Box3(),
				images = this.getLeaves(),
				length = Math.min(images.length, 3),
				planes = [];

			for (var i = 0; i < length; i++) {
				var img = images[i];

				var offset = new THREE.Vector3(0.5 * i - 0.5 * (length - 1) / 2, Math.random() * 0.3 - 0.15, 0.2 * i - 0.2 * (length - 1) / 2);

				var plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(img.width, img.height), new THREE.MeshBasicMaterial({ map: img.previewTexture }));
				plane.position.copy(offset);
				plane.name = 'image' + i;

				this.object.add(plane);
				planes.push(plane);

				bbox.expandByObject(plane);

				var tr = img.vertices['top-right'];
				lineVertices.push(
					tr.x + offset.x, tr.y + offset.y, offset.z,
					-tr.x + offset.x, tr.y + offset.y, offset.z,
					-tr.x + offset.x, tr.y + offset.y, offset.z,
					-tr.x + offset.x, -tr.y + offset.y, offset.z,
					-tr.x + offset.x, -tr.y + offset.y, offset.z,
					tr.x + offset.x, -tr.y + offset.y, offset.z,
					tr.x + offset.x, -tr.y + offset.y, offset.z,
					tr.x + offset.x, tr.y + offset.y, offset.z
				);
			}

			var lineGeo = new THREE.BufferGeometry();
			lineGeo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));
			var line = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: DV3D.Defaults.selectionColor }));
			line.name = 'lines';

			var bbSize = bbox.getSize(),
				collisionObj = new THREE.Mesh(new THREE.BoxBufferGeometry(bbSize.x, bbSize.y, bbSize.z), new THREE.MeshBasicMaterial({ visible: false }));
			bbox.getCenter(collisionObj.position);
			collisionObj.name = 'collisionObject';

			var text = new THREE.Mesh(new THREE.TextBufferGeometry(this.count.toString(), {
				font: THREE.DokuVisTray.fonts.HelvetikerBold,
				size: 0.5,
				height: 0.02,
				curveSegments: 6
			}), new THREE.MeshBasicMaterial({ color: 0xffdd00, depthWrite: true, depthTest: true }));
			text.geometry.center();
			text.position.z = 0.25;
			text.name = 'text';

			// this.object.add(sphere);
			this.object.add(line);
			this.object.add(collisionObj);
			this.object.add(text);

			Object.assign(this.objectMap, {
				images: planes,
				line: line,
				text: text,
				collisionObject: collisionObj
			});

			this.collisionObject = collisionObj;

			this.object.scale.set(5, 5, 5);

			this.object.cluster = this;
		}

		if (visible && !this.active) {
			scene.add(this.object);
			octree.add(this.collisionObject);
			this.active = true;
		}
		else {
			scene.remove(this.object);
			octree.remove(this.collisionObject);
			this.active = false;
		}

	},

	lookAt: function (position) {
		this.object.lookAt(position);
		var scale = this.position.distanceTo(position) / 25;
		this.object.scale.set(scale, scale, scale);
	},

	/**
	 * @callback traverseCallback
	 * @param {DV3D.ClusterObject|Object} node
	 */

	/**
	 * Traverse this node and its children.
	 * @param callback {traverseCallback}
	 * @param includeLeaves {boolean=false} Call callback also for leaf nodes (i.e. that are not cluster objects)
	 */
	traverse: function (callback, includeLeaves) {
		if (callback(this) !== false) {
			this.children.forEach(function (child) {
				if (child instanceof DV3D.ClusterObject)
					child.traverse(callback, includeLeaves);
				else if (includeLeaves === true)
					callback(child);
			});
		}
	},

	getLeaves: function () {
		var tmp = [];
		this.traverse(function (cluster) {
			cluster.children.forEach(function (child) {
				if (!(child instanceof DV3D.ClusterObject))
					tmp.push({
						leaf: child,
						parent: cluster
					});
			});
		});
		tmp.sort(function (a, b) {
			return b.parent.depth - a.parent.depth;
		});
		// console.log(tmp);
		return tmp.map(function (value) {
			return value.leaf;
		});
	},

	explode: function () {
		var scope = this,
			obj = this.object,
			lineVertices = [],
			showLines = obj.parent instanceof THREE.Scene;

		// this.traverse(function (child) {
		// 	if (child.active) {
		// 		child.toggle(false);
		// 		return false;
		// 	}
		// });

		this.getLeaves().forEach(function (leaf) {
			if (!(leaf.parent instanceof THREE.Scene)) {
				scene.add(leaf);
				leaf.entry.visible = true;
				leaf.highlight(0xaaaaaa);
				// leaf.highlight(new THREE.Color(0xaaaaaa).lerp(new THREE.Color(DV3D.Defaults.selectionColor), 0.5).getHex());
			}
			// var pos = leaf.position.clone().sub(obj.position);
			if (showLines)
				lineVertices = lineVertices.concat(scope.position.toArray()).concat(leaf.position.toArray());
		});

		if (showLines && !this.objectMap['explodeLines']) {
			var lineGeo = new THREE.BufferGeometry();
			lineGeo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));
			var line = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
				color: 0xaaaaaa,
				transparent: true,
				opacity: 0.5,
				depthTest: true,
				depthWrite: true
			}));
			line.renderOrder = -2;
			line.name = 'explodeLines';
			this.objectMap.explodeLines = line;
		}

		if (showLines && !this.objectMap['bullet']) {
			var bullet =  new THREE.Mesh(new THREE.SphereBufferGeometry(0.1), new THREE.MeshBasicMaterial({ color: DV3D.Defaults.selectionColor, depthTest: true }));
			bullet.name = 'bullet';
			this.objectMap.bullet = bullet;
		}

		if (this.objectMap.line)
			obj.remove(this.objectMap.line);
		if (this.objectMap.text)
			obj.remove(this.objectMap.text);
		// obj.remove(obj.childMap.collisionObject);
		if (this.objectMap.images)
			this.objectMap.images.forEach(function (img) {
				obj.remove(img);
			});

		if (showLines && this.objectMap.bullet)
			obj.add(this.objectMap.bullet);
		if (showLines && this.objectMap.explodeLines)
			scene.add(this.objectMap.explodeLines);

		this.isExploded = true;
	},

	implode: function () {
		if (!this.isExploded) return;

		this.getLeaves().forEach(function (leaf) {
			scene.remove(leaf);
			leaf.entry.visible = false;
			leaf.dehighlight();
		});

		var obj = this.object;

		obj.remove(this.objectMap.bullet);
		scene.remove(this.objectMap.explodeLines);

		obj.add(this.objectMap.line);
		obj.add(this.objectMap.text);
		// obj.remove(obj.childMap.collisionObject);
		this.objectMap.images.forEach(function (img) {
			obj.add(img);
		});

	},

	select: function (bool) {
		this.objectMap.images.forEach(function (img) {
			if (bool) {
				img.material.color.lerp(new THREE.Color(DV3D.Defaults.selectionColor), 0.3);
			}
			else {
				img.material.color.setHex(0xffffff);
			}
		});
		// if (bool)
		// 	this.object.children.forEach(function (child) {
		// 		if (/image\d+/.test(child.name)) {
		// 			child.material.color.lerp(new THREE.Color(DV3D.Defaults.selectionColor), 0.3);
		// 		}
		// 	});
		// else
		// 	this.object.children.forEach(function (child) {
		// 		if (/image\d+/.test(child.name)) {
		// 			child.material.color.setHex(0xffffff);
		// 		}
		// 	});
	},

	deselect: function () {
		this.object.children.forEach(function (child) {
			if (/image\d+/.test(child.name)) {
				child.material.color.setHex(0xffffff);
			}
		});
	},

	highlight: function (bool) {
		this.objectMap.images.forEach(function (img) {
			if (bool)
				img.material.color.lerp(new THREE.Color(DV3D.Defaults.highlightColor), 0.3);
			else
				img.material.color.setHex(0xffffff);
		});
	},

	unhighlight: function () {

	},

	dispose: function () {
		if (this.object) {
			this.object.children.forEach(function (child) {
				child.geometry.dispose();
				child.material.dispose();
			});
		}
	}

};

})();
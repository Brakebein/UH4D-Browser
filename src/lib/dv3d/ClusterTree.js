(function () {

var scene = undefined,
	octree = undefined;

DV3D.ClusterTree = function (sceneParam, octreeParam) {

	this.root = null;
	this._scene = scene = sceneParam;
	this._octree = octree = octreeParam;

	this._activeClusters = [];

};

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

		console.log('Elapsed time', Date.now() - startTime);
		console.log('Cluster Tree', this.root);

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

		if (!this.root) return;

		this.root.traverse(function (node) {
			node.dispose();
		});

		this.root = null;
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

	getObjectsByDistance: function (position) {

		var tmp = [];

		this.root.traverse(function (node) {
			if (!(node instanceof DV3D.ClusterObject) || node.position.distanceTo(position) > node.distance * 10) {
				tmp.push(node);
				return false;
			}

		}, true);

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

	update: function (camera) {

		var scope = this;

		if (!scope.root) return;

		// handle outdated objects
		scope._activeClusters.forEach(function (c) {
			if (c instanceof DV3D.ClusterObject)
				c.toggle(false);
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

		this._scene.add(this._debugGraph);

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

	scope.object = undefined;

	scope.parent = undefined;

	scope.position = children.reduce(function (vector, obj) {
		return vector.add(obj.position.clone().multiplyScalar((obj instanceof DV3D.ClusterObject ? obj.count : 1) / scope.count));
	}, new THREE.Vector3());

};

DV3D.ClusterObject.prototype = {

	toggle: function (visible) {

		if (!this.object) {
			this.object = new THREE.Object3D();
			this.object.position.copy(this.position);

			var sphere = new THREE.Mesh(new THREE.SphereBufferGeometry(5), new THREE.MeshLambertMaterial({color: 0xffff00}));

			var lineGeo = new THREE.Geometry(),
				bbox = new THREE.Box3();

			var images = this.getLeaves();
			var length = images.length < 3 ? images.length : 3;
			for (var i = 0; i < length; i++) {
				var img = images[i];

				var offset = new THREE.Vector3(0.5 * i - 0.5 * (length - 1) / 2, Math.random() * 0.3 - 0.15, 0.2 * i - 0.2 * (length - 1) / 2);

				var plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(img.width, img.height), new THREE.MeshBasicMaterial({map: img.previewTexture}));
				plane.position.copy(offset);
				this.object.add(plane);

				bbox.expandByObject(plane);

				var tr = img.vertices['top-right'];
				lineGeo.vertices.push(
					new THREE.Vector3(tr.x + offset.x, tr.y + offset.y, offset.z),
					new THREE.Vector3(-tr.x + offset.x, tr.y + offset.y, offset.z),
					new THREE.Vector3(-tr.x + offset.x, tr.y + offset.y, offset.z),
					new THREE.Vector3(-tr.x + offset.x, -tr.y + offset.y, offset.z),
					new THREE.Vector3(-tr.x + offset.x, -tr.y + offset.y, offset.z),
					new THREE.Vector3(tr.x + offset.x, -tr.y + offset.y, offset.z),
					new THREE.Vector3(tr.x + offset.x, -tr.y + offset.y, offset.z),
					new THREE.Vector3(tr.x + offset.x, tr.y + offset.y, offset.z)
				);
			}

			var lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({color: 0xff4400}));

			var bbSize = bbox.getSize(),
				collisionObj = new THREE.Mesh(new THREE.BoxBufferGeometry(bbSize.x, bbSize.y, bbSize.z), new THREE.MeshBasicMaterial({ visible: false }));
			bbox.getCenter(collisionObj.position);

			var text = new THREE.Mesh(new THREE.TextBufferGeometry(this.count.toString(), {
				font: THREE.DokuVisTray.fonts.HelvetikerBold,
				size: 0.5,
				height: 0.02,
				curveSegments: 6
			}), new THREE.MeshBasicMaterial({color: 0xffdd00, depthWrite: true, depthTest: true}));
			text.geometry.center();
			text.position.z = 0.25;

			// this.object.add(sphere);
			this.object.add(lines);
			this.object.add(collisionObj);
			this.object.add(text);

			this.collisionObject = collisionObj;

			this.object.scale.set(5, 5, 5);
		}

		if (visible && !this.active) {
			scene.add(this.object);
			this.active = true;
		}
		else {
			scene.remove(this.object);
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
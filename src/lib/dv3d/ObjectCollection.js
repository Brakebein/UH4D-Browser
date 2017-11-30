(function () {

/**
 * An extended class of `DV3D.Collection` as it manages the objects in two additional lists: hierarchy and layers.
 * @constructor
 * @extends DV3D.Collection
 * @author Brakebein
 */
DV3D.ObjectCollection = function () {
	DV3D.Collection.call( this );

	/**
	 * List of layers, which will be set as soon objects are added or removed from this collection.
	 * @type {DV3D.Layer[]}
	 */
	this.layers = [];
	/**
	 * List of objects with no parents. All other objects must be descendants of these objects.
	 * @type {DV3D.ObjectEntry[]}
	 */
	this.hierarchy = [];
};

DV3D.ObjectCollection.prototype = Object.assign( Object.create(DV3D.Collection.prototype), {

	/**
	 * Add object to collection, add it to layers and hierarchy.
	 * @param obj {DV3D.ObjectEntry} Object to be added
	 * @override
	 */
	add: function (obj) {
		// cancel if already in collection
		if (this.get(obj.id)) return;

		// add to normal list
		this.list.push(obj);
		obj.addEventListener('toggle', toggleHandler.bind(this));
		this.count++;
		
		// add to layers
		var layer = this.getLayer(obj.layer);
		if (layer) {
			layer.add(obj);
		}
		else {
			layer = this.addLayer(obj.layer);
			layer.add(obj);
		}

		// add to hierarchy
		var parent = getHierarchyObject(this.hierarchy, obj.parent);
		if (parent) {
			obj.parent = parent;
			parent.children.push(obj);
		}
		else {
			obj.parent = null;
			this.hierarchy.push(obj);
		}
	},

	/**
	 * Remove object from collection, remove from layers and hierarchy.
	 * @param obj {DV3D.ObjectEntry} Object to be removed
	 * @override
	 */
	remove: function (obj) {
		// cancel if not in collection
		var index = this.list.indexOf(obj);
		if (index === -1) return;

		// remove from layer
		var layer = obj.layer;
		layer.remove(obj);

		// remove from hierarchy
		var parentList = obj.parent ? obj.parent.children : this.hierarchy;
		parentList.splice(parentList.indexOf(obj), 1);
		obj.children.forEach(function (child) {
			parentList.push(child);
			child.parent = obj.parent;
		});
		obj.children = [];
		obj.parent = obj.parent ? obj.parent.id : null;

		obj.removeEventListener('toggle', toggleHandler);
		// remove from normal list
		this.list.splice(index, 1);
		this.count--;
	},

	/**
	 * Create a new layer and add it to the collection.
	 * @param name {string} Name of the new layer
	 * @return {DV3D.Layer} The newly created layer.
	 */
	addLayer: function (name) {
		var layer = new DV3D.Layer(name);
		this.layers.push(layer);

		layer.addEventListener('removed', (function (event) {
			if (event.target.list.length === 0)
				this.removeLayer(event.target);
		}).bind(this));

		return layer;
	},

	/**
	 * Clear layer and remove it from the collection.
	 * @param layername {DV3D.Layer|string} Layer instance or name of the layer, which should be removed.
	 */
	removeLayer: function (layername) {
		if (layername instanceof DV3D.Layer) var layer = layername;
		else if (typeof layername === 'string') layer = this.getLayer(layername);
		else return;

		layer.clear();
		this.layers.splice(this.layers.indexOf(layer), 1);
	},

	/**
	 * Get layer with given name.
	 * @param name {string} Name of the layer
	 * @return {DV3D.Layer|undefined} Layer with given name or `undefined`, if no layer with this name exists.
	 */
	getLayer: function (name) {
		return this.layers.find(function (layer) {
			return layer.name === name;
		});
	}

});

function getHierarchyObject(list, id) {
	for (var i = 0, l = list.length; i < l; i++) {
		if (list[i].id === id) return list[i];
		var object = getHierarchyObject(list[i].children, id);
		if (object !== undefined) return object;
	}
	return undefined;
}

function toggleHandler(event) {
	if (event.visible)
		this.visible = true;
}

})();

(function () {

/**
 * This class is container for objects, plans, or images. There are properties that are useful for global settings. Methods like `toggle()` iterate over all items.
 * @constructor
 * @memberof DV3D
 * @author Brakebein
 */
DV3D.Collection = function () {

	/**
	 * Array containing all entries.
	 * @type {Array}
	 */
	this.list = [];
	/**
	 * Global visibility.
	 * @type {boolean}
	 */
	this.visible = true;
	/**
	 * Global opacity value.
	 * @type {number}
	 */
	this.opacity = 1.0;
	/**
	 * Global scale value.
	 * @type {number}
	 */
	this.scale = 1.0;
	/**
	 * Amount of objects in this collection.
	 * @type {number}
	 */
	this.count = 0;

};

Object.assign(DV3D.Collection.prototype, THREE.EventDispatcher.prototype, {

	/**
	 * Get an entry by the given id. If no id is specified, the whole list will be returned.
	 * @param id {string|number} Id of the entry
	 * @return {DV3D.Entry|Object} The entry with the given id or the whole list/map.
	 */
	get: function (id) {
		if (id) return this.getByProperty('id', id);
		else return this.list;
	},

	// /**
	//  * Get the list as array.
	//  * @return {DV3D.Entry[]} All entries as array.
	//  * @deprecated
	//  */
	// asArray: function () {
	// 	var array = [];
	// 	for (var key in this.list)
	// 		array.push(this.list[key]);
	// 	return array;
	// },

	/**
	 * Add object to the collection (uses `obj.id` as id).
	 * @param obj {DV3D.Entry} New entry
	 */
	add: function (obj) {
		if (this.get(obj.id)) return;
		this.list.push(obj);
		obj.addEventListener('toggle', toggleHandler.bind(this));
		this.count++;
	},

	/**
	 * Remove the object from the collection.
	 * @param obj {DV3D.Entry} Object to be removed
	 */
	remove: function (obj) {
		var index = this.list.indexOf(obj);
		if (index !== -1) {
			this.list.splice(index, 1);
			obj.removeEventListener('toggle', toggleHandler);
			this.count--;
		}
	},

	/**
	 * Get object by name.
	 * @param value {string} Name of the object
	 * @return {DV3D.Entry|null} Entry or null, if not found.
	 */
	getByName: function (value) {
		return this.getByProperty('name', value);
	},

	/**
	 * Get object by property.
	 * @param prop {string} Property name
	 * @param value {*} Property value
	 * @return {DV3D.Entry|null} Entry or null, if not found.
	 */
	getByProperty: function (prop, value) {
		return this.list.find(function (item) {
			return item[prop] === value;
		});
	},

	/**
	 * Get all visible entries.
	 * @return {DV3D.Entry[]} Array of all visible entries.
	 */
	getVisible: function () {
		return this.list.filter(function (item) {
			return item.visible;
		});
	},

	/**
	 * Iterate over the list and execute the given function for each item.
	 * @param callback {function} Function to be executed
	 * @param [onlyVisible=false] {boolean} If true, consider only visible items
	 */
	forEach: function (callback, onlyVisible) {
		var filterVisible = onlyVisible || false;
		this.list.forEach(function (item) {
			if (!filterVisible || (filterVisible && item.visible))
				callback(item);
		});
	},

	/**
	 * Toggle all entries (set visibility).
	 */
	toggle: function () {
		var visible = this.visible = !this.visible;
		this.list.forEach(function (item) {
			item.toggle(visible, false);
		});
	},

	/**
	 * Set opacity of all entries.
	 * @param value {number} New opacity value (0.0 .. 1.0)
	 */
	setOpacity: function (value) {
		value = +value || +this.opacity;
		if (typeof value === 'number' && value >= 0.0 && value <= 1.0) this.opacity = value;
		else return;
		this.list.forEach(function (item) {
			item.setOpacity(value);
		});
		// TODO: dispatchEvent animate
	},

	/**
	 * Set the scale of all entries.
	 * @param value {number} New scale value
	 */
	setScale: function (value) {
		value = +value;
		if (typeof value === 'number') this.scale = value;
		for (var key in this.list) {
			// TODO: differentiate between plans, images, objects
			this.list[key].object.setScale(this.scale);
		}
	}

});

function toggleHandler(event) {
	if (event.visible)
		this.visible = true;
}

})();

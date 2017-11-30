(function () {

/**
 * Class to manage objects within a layer.
 * @param name {string} Name of the layer
 * @constructor
 * @memberOf DV3D
 * @extends THREE.EventDispatcher
 * @author Brakebein
 */
DV3D.Layer = function (name) {
	/**
	 * Name of the layer.
	 * @type {string}
	 */
	this.name = name;
	/**
	 * Array of all objects being part of this layer.
	 * @type {DV3D.ObjectEntry[]}
	 */
	this.list = [];
	/**
	 * Flag, if layer is visible.
	 * @type {boolean}
	 */
	this.visible = true;
	/**
	 * Flag, if objects are displayed in list.
	 * @type {boolean}
	 */
	this.expand = false;
};

Object.assign(DV3D.Layer.prototype, THREE.EventDispatcher.prototype, {

	/**
	 * Add object to this layer.
	 * @param entry {DV3D.ObjectEntry} Object to be added
	 */
	add: function (entry) {
		this.list.push(entry);
		entry.layer = this;
		entry.addEventListener('toggle', toggleHandler.bind(this));
	},

	/**
	 * Remove object from this layer.
	 * @param entry {DV3D.ObjectEntry} Object to be removed
	 */
	remove: function (entry) {
		this.list.splice(this.list.indexOf(entry), 1);
		entry.layer = this.name;
		entry.removeEventListener('toggle', toggleHandler);

		this.dispatchEvent({ type: 'removed' });
	},

	/**
	 * Remove all objects from this layer
	 */
	clear: function () {
		this.list.forEach(function (entry) {
			entry.layer = this.name;
			entry.removeEventListener('toggle', toggleHandler);
		});
		this.list = [];
	},

	/**
	 * Toggle all objects of this layer.
	 * @param [bool] {boolean} All objects will be toggled depending on this value. If not set, the layer's visibility will be inverted.
	 */
	toggle: function (bool) {
		var visible;
		if (typeof bool === 'boolean') visible = bool;
		else visible = !this.visible;

		this.visible = visible;
		this.list.forEach(function (entry) {
			entry.toggle(visible);
		});
	}

});

function toggleHandler(event) {
	if (event.visible)
		this.visible = true;
}

})();

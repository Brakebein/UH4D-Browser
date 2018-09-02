/**
 * Base class for items to be added to a DV3D.Collection.
 * @param obj {THREE.Object3D} Item that is an instance of DV3D.Plan, DV3D.ImagePane, etc.
 * @param [label] {string} How the entry should be displayed in lists. (Default: `obj.name`)
 * @constructor
 * @memberOf DV3D
 * @extends THREE.EventDispatcher
 * @author Brakebein
 */
DV3D.Entry = function (obj, label) {

	/**
	 * Id of the object.
	 * @type {number|string}
	 */
	this.id = obj.id;
	/**
	 * Name of the object.
	 * @type {string}
	 */
	this.name = obj.name;
	/**
	 * Label/title to be visible in the view.
	 * @type {string}
	 */
	this.label = label || obj.name;
	/**
	 * The actual object.
	 * @type {THREE.Object3D}
	 */
	this.object = obj;

	/**
	 * Flag, if the object is visible.
	 * @type {boolean}
	 */
	this.visible = true;
	/**
	 * Flag, if the object is selected/active.
	 * @type {boolean}
	 */
	this.active = false;
	/**
	 * Opacity of the object.
	 * @type {number}
	 */
	this.opacity = 1.0;

	this.isHighlighted = false;

	obj.entry = this;

};

Object.assign(DV3D.Entry.prototype, THREE.EventDispatcher.prototype, {

	/**
	 * Toggle object in scene.
	 * @param [bool] {boolean} Object will be toggled depending on this value. If not set, the visibility will be inverted.
	 */
	toggle: function (bool) {
		if (typeof bool === 'boolean') this.visible = bool;
		else this.visible = !this.visible;

		this.dispatchEvent({ type: 'toggle', visible: this.visible });
	},

	/**
	 * Activate/select the entry and dispatch `select` event.
	 * @param event {MouseEvent|null} Event object of click event
	 * @param [bool] {boolean} If not set, `active` property is inverted
	 */
	select: function (event, bool) {
		if (typeof bool === 'boolean') this.active = bool;
		else this.active = !this.active;

		if (this.visible && event)
			this.dispatchEvent({ type: 'select', active: this.active, originalEvent: event });
	},

	/**
	 * Highlight entry and dispatch `highlight` event.
	 * @param [bool] {boolean} Object will be highlighted depending on this value. If not set, the highlighted status will be inverted.
	 * @param [preventEvent=true] {boolean} If set to `false`, event will not be dispatched. (Default: `true`)
	 */
	highlight: function (bool, preventEvent) {
		if (this.isHighlighted === bool) return;
		if (typeof bool === 'boolean') this.isHighlighted = bool;
		else this.isHighlighted = !this.isHighlighted;

		if (this.isHighlighted)
			this.object.highlight();
		else {
			if (!this.active)
				this.object.dehighlight();
		}

		if (preventEvent !== false)
			this.dispatchEvent({ type: 'highlight', isHighlighted: this.isHighlighted });

		this.update();
	},

	/**
	 * Set camera to fit the object and its children. `focus` event is being dispatched.
	 */
	focus: function () {
		//if (!this.visible) return;
		this.dispatchEvent({ type: 'focus' });
	},

	/**
	 * Set the opacity of the object.
	 * @param [value] {boolean} New opacity value. If not set, an `opacity` event will be dispatched with the old value.
	 */
	setOpacity: function (value) {
		if (typeof value !== 'undefined') this.opacity = value;
		this.object.setOpacity(this.opacity);
		this.update();
	},

	update: function () {
		this.dispatchEvent({ type: 'change' });
	},

	/**
	 * Remove any references to meshes and other entries, so this entry is ready for GC.
	 * @param [disposeObject=true] {boolean} If true, object's geometry and material will be disposed. (Default: true)
	 */
	dispose: function (disposeObject) {
		if (this.object.entry) {
			if (disposeObject !== false)
				this.object.dispose();
			delete this.object.entry;
		}
		delete this.object;
	}

});


/**
 * Extended DV3D.Entry class for plans.
 * @param obj {DV3D.Plan} Instance of a Plan object
 * @extends DV3D.Entry
 * @constructor
 */
DV3D.PlanEntry = function (obj) {
	DV3D.Entry.call( this, obj );
};
DV3D.PlanEntry.prototype = Object.assign( Object.create( DV3D.Entry.prototype ), {

	/**
	 * Set/tween to orthogonal view to fit plan to viewport.
	 */
	setOrthoView: function () {

	}

});


/**
 * Extended DV3D.Entry class for images.
 * @param obj {DV3D.ImagePane} Instance of an ImagePane object
 * @param [label] {string} How the entry should be displayed in lists. (Default: `obj.name`)
 * @extends DV3D.Entry
 * @constructor
 */
DV3D.ImageEntry = function (obj, label) {
	DV3D.Entry.call( this, obj, label );

	this.source = obj.userData.source;

	this.scale = 1;
};
DV3D.ImageEntry.prototype = Object.assign( Object.create( DV3D.Entry.prototype ), {

	// /**
	//  * Set/tween camera to position and orientation of the ImagePane.
	//  */
	// setImageView: function () {
	// 	this.dispatchEvent({ type: 'focus' })
	// }

	setScale: function (value) {
		if (typeof value === 'number') this.scale = value;
		this.object.setScale(this.scale);
		this.update();
	},

	updateTextureByDistance: function (vector, distance) {
		if (this.object.updateTextureByDistance(vector, distance))
			this.update();
	}

});

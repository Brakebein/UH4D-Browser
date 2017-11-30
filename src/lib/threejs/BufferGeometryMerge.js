THREE.BufferGeometry.prototype.merge = function ( geometry ) {

	if ( geometry instanceof THREE.BufferGeometry === false ) {

		console.error( 'THREE.BufferGeometry.merge(): geometry not an instance of THREE.BufferGeometry.', geometry );
		return;

	}

	var attributes = this.attributes;

	if ( this.index ){

		var indices = geometry.index.array;

		var offset = attributes[ 'position' ].count;

		for( var i = 0, il = indices.length; i < il; i++ ) {

			indices[i] = offset + indices[i];

		}

		this.index.array = Uint32ArrayConcat( this.index.array, indices );
		this.index.count += geometry.index.count;

	}

	for ( var key in attributes ) {

		if ( geometry.attributes[ key ] === undefined ) continue;

		attributes[ key ].array = Float32ArrayConcat( attributes[ key ].array, geometry.attributes[ key ].array );
		attributes[ key ].count += geometry.attributes[ key ].count;

	}

	return this;

	/***
	 * @param {Float32Array} first
	 * @param {Float32Array} second
	 * @returns {Float32Array}
	 * @constructor
	 */
	function Float32ArrayConcat(first, second)
	{
		var firstLength = first.length,
			result = new Float32Array(firstLength + second.length);

		result.set(first);
		result.set(second, firstLength);

		return result;
	}

	/**
	 * @param {Uint32Array} first
	 * @param {Uint32Array} second
	 * @returns {Uint32Array}
	 * @constructor
	 */
	function Uint32ArrayConcat(first, second)
	{
		var firstLength = first.length,
			result = new Uint32Array(firstLength + second.length);

		result.set(first);
		result.set(second, firstLength);

		return result;
	}

};

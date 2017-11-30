angular.module('dokuvis.viewport')

.factory('viewportSettings', [
	function () {

		var shadings = [
			{ value: 'color', label: 'Color' },
			{ value: 'grey', label: 'Grey' },
			{ value: 'transparent', label: 'Transparent' },
			{ value: 'onlyEdges', label: 'Only edges' },
			{ value: 'xray', label: 'X-Ray' },
			{ value: 'custom', label: 'Custom' }];
		var cameras = [
			{ value: 'perspective', label: 'Perspective' },
			{ value: 'top', label: 'Top' },
			{ value: 'front', label: 'Front' },
			{ value: 'back', label: 'Back' },
			{ value: 'left', label: 'Left' },
			{ value: 'right', label: 'Right' },
			{ value: 'custom', label: 'Custom' }];

		return {
			defaults: {
				NEAR: 1,
				FAR: 4000,
				initWidth: 800,
				initHeight: 600,
				backgroundColor: 0x666666,
				selectionColor: 0xfc4e2a,
				highlightColor: 0xffff44,
				objectColor: 0xdddddd,
				edgeColor: 0x333333
			},

			shadings: shadings,
			cameras: cameras,
			shading: shadings[0].value,
			camera: cameras[0].value,

			showEdges: true
		};

	}
])

.factory('viewportCache',['viewportSettings',
	function (viewportSettings) {

		///// SCENE

		// Scene
		var scene = new THREE.Scene();
		scene.fog = new THREE.Fog(viewportSettings.defaults.backgroundColor, viewportSettings.defaults.FAR - 100, viewportSettings.defaults.FAR);

		// Grid
		scene.add(new THREE.GridHelper(100, 10));

		// Light
		scene.add(new THREE.AmbientLight(0x888888));
		var directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
		directionalLight.position.set(-2, 8, 4);
		scene.add(directionalLight);

		///// GEOMETRIES

		var geometries = {};
		geometries['initGeo'] = new THREE.Geometry();

		///// MATERIALS

		var materials = {};

		// default mat
		materials['defaultMat'] = new THREE.MeshLambertMaterial({
			name: 'defaultMat',
			color: DV3D.Defaults.objectColor });
		materials['defaultDoublesideMat'] = new THREE.MeshLambertMaterial({
			name: 'defaultDoublesideMat',
			color: DV3D.Defaults.objectColor,
			side: THREE.DoubleSide });
		materials['defaultUnsafeMat'] = new THREE.MeshLambertMaterial({
			name: 'defaultUnsafeMat',
			color: 0xaaaaaa,
			transparent: true,
			opacity: 0.5,
			depthWrite: false });

		// default selection mat
		materials['selectionMat'] = new THREE.MeshLambertMaterial({
			name: 'selectionMat',
			color: DV3D.Defaults.selectionColor,
			side: THREE.DoubleSide });

		// transparent mat
		materials['transparentMat'] = new THREE.MeshLambertMaterial({
			name: 'transparentMat',
			color: 0xcccccc,
			transparent: true,
			opacity: 0.5,
			depthWrite: false });
		materials['transparentSelectionMat'] = new THREE.MeshLambertMaterial({
			name: 'transparentSelectionMat',
			color: DV3D.Defaults.selectionColor,
			transparent: true,
			opacity: 0.5,
			depthWrite: false });

		// wireframe mat
		materials['wireframeMat'] = new THREE.MeshBasicMaterial({
			name: 'wireframeMat',
			color: DV3D.Defaults.edgeColor,
			wireframe: true });
		materials['wireframeSelectionMat'] = new THREE.MeshBasicMaterial({
			name: 'wireframeSelectionMat',
			color: DV3D.Defaults.selectionColor,
			wireframe: true });

		// highlight mat
		materials['highlightMat'] = new THREE.MeshLambertMaterial({
			name: 'highlightMat',
			color: 0xffff44 });
		materials['transparentHighlightMat'] = new THREE.MeshLambertMaterial({
			name: 'transparentHighlightMat',
			color: 0xffff44,
			transparent: true,
			opacity: 0.5 });

		// xray mat
		materials['xrayMat'] = new THREE.ShaderMaterial({
			name: 'xrayMat',
			side: THREE.DoubleSide,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			uniforms: {
				"ambient":{type:"f",value:0.05},
				"edgefalloff":{type:"f",value:0.1},
				"intensity":{type:"f",value:1.0},
				"vColor":{type:"c",value:new THREE.Color(0x000000)} },
			vertexShader: THREE.XRayShader.vertexShader,
			fragmentShader: THREE.XRayShader.fragmentShader });
		materials['xraySelectionMat'] = new THREE.ShaderMaterial({
			name: 'xraySelectionMat',
			side: THREE.DoubleSide,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			uniforms: {
				"ambient": { type: "f", value: 0.05 },
				"edgefalloff": {type: "f", value: 0.3 },
				"intensity": {type: "f", value: 1.5},
				"vColor": {type: "c" , value: new THREE.Color(DV3D.Defaults.selectionColor) } },
			vertexShader: THREE.XRayShader.vertexShader,
			fragmentShader: THREE.XRayShader.fragmentShader });

		// edges mat
		materials['edgesMat'] = new THREE.LineBasicMaterial({
			name: 'edgesMat',
			color: DV3D.Defaults.edgeColor });
		materials['edgesSelectionMat'] = new THREE.LineBasicMaterial({
			name: 'edgesSelectionMat',
			color: DV3D.Defaults.selectionColor });
		materials['edgesHighlightMat'] = new THREE.LineBasicMaterial({
			name: 'edgesHighlightMat',
			color: 0xffff44 });

		// slice mat
		// materials['invisibleMat'] = new THREE.MeshLambertMaterial({color: 0xdddddd, visible: false, name: 'invisibleMat'});
		// materials['sliceMultiMat'] = [ materials['defaultMat'], materials['invisibleMat'], materials['defaultMat'], materials['invisibleMat'] ];
		// materials['sliceLineMat'] = new THREE.LineBasicMaterial({color: 0xff0000, name: 'sliceLineMat'});
		// materials['sliceMultiMat_debug'] = [new THREE.MeshLambertMaterial({color: 0xdd4444}), new THREE.MeshLambertMaterial({color: 0x44dd44}), new THREE.MeshLambertMaterial({color: 0x4444dd}), new THREE.MeshLambertMaterial({color: 0x44dddd})];

		///// FONTS

		var fontLoader = new THREE.FontLoader(),
			fonts = {};
		fontLoader.load('fonts/helvetiker_bold.typeface.json', function (font) {
			fonts['HelvetikerBold'] = font;
		});

		THREE.DokuVisTray = {

			scene: scene,
			directionalLight: directionalLight,

			geometries: geometries,
			materials: materials,
			standardGeometries: Object.keys(geometries),
			standardMaterials: Object.keys(materials),

			fonts: fonts,

			objects: new DV3D.ObjectCollection(),
			plans: new DV3D.Collection(),
			spatialImages: new DV3D.Collection()

		};

		return THREE.DokuVisTray;
	}
]);

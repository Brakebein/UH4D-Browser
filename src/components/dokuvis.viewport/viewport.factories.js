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
				FAR: 5000,
				initWidth: 800,
				initHeight: 600,
				backgroundColor: 0x666666,
				selectionColor: 0xfc4e2a,
				highlightColor: 0xffff44,
				objectColor: 0xdddddd,
				edgeColor: 0x33ff33,
				gridSize: 3000,
				gridDivisions: 100
			},

			shadings: shadings,
			cameras: cameras,
			shading: shadings[0].value,
			camera: cameras[0].value,

			showEdges: true,

			images: {
				opacity: 1.0,
				scale: 3
			}
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
		var grid = new THREE.GridHelper(viewportSettings.defaults.gridSize, viewportSettings.defaults.gridDivisions, 0x2b3e50, 0x2b3e50);
		grid.position.set(1000, -0.1, -1000);
		grid.material.dispose();
		grid.material = new THREE.ShaderMaterial({
			uniforms: {
				diffuse: { value: new THREE.Color(0xffffff) },
				opacity: { value: 0.7 },
				fogNear: { value: 1 },
				fogFar: { value: viewportSettings.defaults.gridSize / 2 }
			},
			vertexShader: '#include <common>\n#include <color_pars_vertex>\n\nvarying float fogDepth;\n\n#include <logdepthbuf_pars_vertex>\n\nvoid main() {\n\n\t#include <color_vertex>\n\n\t#include <begin_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\n\t#include <worldpos_vertex>\n\n\tfogDepth = -mvPosition.z;\n\n}',
			fragmentShader: 'uniform vec3 diffuse;\nuniform float opacity;\n\n#ifndef FLAT_SHADED\n\n\tvarying vec3 vNormal;\n\n#endif\n\n#include <common>\n#include <color_pars_fragment>\n\nvarying float fogDepth;\nuniform float fogNear;\nuniform float fogFar;\n\n#include <logdepthbuf_pars_fragment>\n\nvoid main() {\n\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n\n\t#include <logdepthbuf_fragment>\n\t#include <color_fragment>\n\t#include <alphatest_fragment>\n\n\tgl_FragColor = diffuseColor;\n\n\t#include <premultiplied_alpha_fragment>\n\t#include <tonemapping_fragment>\n\t#include <encodings_fragment>\n\n\tfloat fogFactor = smoothstep( fogNear, fogFar, fogDepth );\n\tgl_FragColor.a *= 1.0 - fogFactor;\n\n}',
			vertexColors: THREE.VertexColors,
			transparent: true
		});
		scene.add(grid);

		// Light
		scene.add(new THREE.AmbientLight(0x888888));
		var directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
		directionalLight.position.set(-2, 8, 4);
		scene.add(directionalLight);

		// Sky box
		var skyGeo = new THREE.SphereBufferGeometry(4000, 32, 15);
		var skyMat = new THREE.ShaderMaterial({
			uniforms: {
				topColor: { value: new THREE.Color().setHSL(0.6, 1, 0.6) },
				horizonColor: { value: new THREE.Color(0xffffff) },
				bottomColor: { value: new THREE.Color(0x666666) },
				offset: { value: 33 },
				topExponent: { value: 0.6 },
				bottomExponent: { value: 0.3 }
			},
			// language=GLSL
			vertexShader: 'varying vec3 vWorldPosition;\n\nvoid main() {\n\n\tvec4 worldPosition = modelMatrix * vec4(position, 1.0);\n\tvWorldPosition = worldPosition.xyz;\n\tgl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n\n}',
			fragmentShader: 'uniform vec3 topColor;\nuniform vec3 horizonColor;\nuniform vec3 bottomColor;\nuniform float offset;\nuniform float topExponent;\nuniform float bottomExponent;\nvarying vec3 vWorldPosition;\n\nvoid main() {\n\n\tfloat h = normalize(vWorldPosition + offset).y;\n\tif (h > 0.0)\n\t\tgl_FragColor = vec4( mix( horizonColor, topColor, max( pow( h, topExponent ), 0.0 ) ), 1.0);\n\telse\n\t\tgl_FragColor = vec4( mix( horizonColor, bottomColor, max( pow( abs(h), bottomExponent ), 0.0 ) ), 1.0);\n\n}',
			side: THREE.BackSide
		});
		scene.add(new THREE.Mesh(skyGeo, skyMat));

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
			grid: grid,
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

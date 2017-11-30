/**
 * Meshlab simple xray shader
 */

THREE.XRayShader = {

	uniforms: {

		"ambient":   	{ type: "f", value: 0.05 },
		"edgefalloff":  { type: "f", value: 0.1 },
		"intensity": 	{ type: "f", value: 1.0 },
		"vColor":		{ type: "c", value: new THREE.Color(0,0,0) }

	},

	vertexColors: THREE.VertexColors,
	
	vertexShader: [
		
		"varying vec3 N;",
		"varying vec3 I;",
		
		"void main() {",
			
			"vec4 P = modelViewMatrix * vec4( position, 1.0 );",
			"I = P.xyz - vec3(0);",
			"N = normalMatrix * normal;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"varying vec3 N;",
		"varying vec3 I;",
	
		"uniform float edgefalloff;",
		"uniform float intensity;",
		"uniform float ambient;",
		"uniform vec3 vColor;",

		"void main() {",
		
			"float opac = dot(normalize(-N), normalize(-I));",
			"opac = abs(opac);",
			"opac = ambient + intensity * (1.0 - pow(opac, edgefalloff));",
			
			"gl_FragColor = opac * vec4( vColor, 1.0 );",
			"gl_FragColor.a = opac;",

		"}"

	].join("\n")

};

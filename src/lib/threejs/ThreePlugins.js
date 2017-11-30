THREE.ColorCorrectionShader={
	uniforms:{
		tDiffuse:{type:"t",value:null},
		powRGB:{type:"v3",value:new THREE.Vector3(2,2,2)},
		mulRGB:{type:"v3",value:new THREE.Vector3(1,1,1)}
	},
	vertexShader:
		"varying vec2 vUv;\nvoid main() {\nvUv = uv;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
	fragmentShader:
		"uniform sampler2D tDiffuse;\nuniform vec3 powRGB;\nuniform vec3 mulRGB;\nvarying vec2 vUv;\nvoid main() {\ngl_FragColor = texture2D( tDiffuse, vUv );\ngl_FragColor.rgb = mulRGB * pow( gl_FragColor.rgb, powRGB );\n}"
};

THREE.SSAOShader={
	uniforms:{
		tDiffuse:{type:"t",value:null},
		tDepth:{type:"t",value:null},
		size:{type:"v2",value:new THREE.Vector2(512,512)},
		cameraNear:{type:"f",value:1},
		cameraFar:{type:"f",value:100},
		fogNear:{type:"f",value:5},
		fogFar:{type:"f",value:100},
		fogEnabled:{type:"i",value:0},
		onlyAO:{type:"i",value:0},
		aoClamp:{type:"f",value:0.3},
		lumInfluence:{type:"f",value:0.9}
	},
	vertexShader:
		"varying vec2 vUv;\nvoid main() {\nvUv = uv;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
	fragmentShader:
		"uniform float cameraNear;\nuniform float cameraFar;\nuniform float fogNear;\nuniform float fogFar;\nuniform bool fogEnabled;\nuniform bool onlyAO;\nuniform vec2 size;\nuniform float aoClamp;\nuniform float lumInfluence;\nuniform sampler2D tDiffuse;\nuniform sampler2D tDepth;\nvarying vec2 vUv;\n#define DL 2.399963229728653\n#define EULER 2.718281828459045\nfloat width = size.x;\nfloat height = size.y;\nfloat cameraFarPlusNear = cameraFar + cameraNear;\nfloat cameraFarMinusNear = cameraFar - cameraNear;\nfloat cameraCoef = 2.0 * cameraNear;\n#ifndef SAMPLES\n#define SAMPLES 8\n#endif\n#ifndef RADIUS\n#define RADIUS 5.0\n#endif\n#if !defined( FLOAT_DEPTH ) && !defined( RGBA_DEPTH )\n#define RGBA_DEPTH\n#endif\n#ifndef ONLY_AO_COLOR\n#define ONLY_AO_COLOR 1.0, 1.0, 1.0\n#endif\nconst int samples = SAMPLES;\nconst float radius = RADIUS;\nconst bool useNoise = false;\nconst float noiseAmount = 0.0003;\nconst float diffArea = 0.4;\nconst float gDisplace = 0.4;\nconst vec3 onlyAOColor = vec3( ONLY_AO_COLOR );\nfloat unpackDepth( const in vec4 rgba_depth ) {\nfloat depth = 0.0;\n#if defined( RGBA_DEPTH )\nconst vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );\ndepth = dot( rgba_depth, bit_shift );\n#elif defined( FLOAT_DEPTH )\ndepth = rgba_depth.w;\n#endif\nreturn depth;\n}\nvec2 rand( const vec2 coord ) {\nvec2 noise;\nif ( useNoise ) {\nfloat nx = dot ( coord, vec2( 12.9898, 78.233 ) );\nfloat ny = dot ( coord, vec2( 12.9898, 78.233 ) * 2.0 );\nnoise = clamp( fract ( 43758.5453 * sin( vec2( nx, ny ) ) ), 0.0, 1.0 );\n} else {\nfloat ff = fract( 1.0 - coord.s * ( width / 2.0 ) );\nfloat gg = fract( coord.t * ( height / 2.0 ) );\nnoise = vec2( 0.25, 0.75 ) * vec2( ff ) + vec2( 0.75, 0.25 ) * gg;\n}\nreturn ( noise * 2.0  - 1.0 ) * noiseAmount;\n}\nfloat doFog() {\nfloat zdepth = unpackDepth( texture2D( tDepth, vUv ) );\nfloat depth = -cameraFar * cameraNear / ( zdepth * cameraFarMinusNear - cameraFar );\nreturn smoothstep( fogNear, fogFar, depth );\n}\nfloat readDepth( const in vec2 coord ) {\nreturn cameraCoef / ( cameraFarPlusNear - unpackDepth( texture2D( tDepth, coord ) ) * cameraFarMinusNear );\n}\nfloat compareDepths( const in float depth1, const in float depth2, inout int far ) {\nfloat garea = 2.0;\nfloat diff = ( depth1 - depth2 ) * 100.0;\nif ( diff < gDisplace ) {\ngarea = diffArea;\n} else {\nfar = 1;\n}\nfloat dd = diff - gDisplace;\nfloat gauss = pow( EULER, -2.0 * dd * dd / ( garea * garea ) );\nreturn gauss;\n}\nfloat calcAO( float depth, float dw, float dh ) {\nfloat dd = radius - depth * radius;\nvec2 vv = vec2( dw, dh );\nvec2 coord1 = vUv + dd * vv;\nvec2 coord2 = vUv - dd * vv;\nfloat temp1 = 0.0;\nfloat temp2 = 0.0;\nint far = 0;\ntemp1 = compareDepths( depth, readDepth( coord1 ), far );\nif ( far > 0 ) {\ntemp2 = compareDepths( readDepth( coord2 ), depth, far );\ntemp1 += ( 1.0 - temp1 ) * temp2;\n}\nreturn temp1;\n}\nvoid main() {\nvec2 noise = rand( vUv );\nfloat depth = readDepth( vUv );\nfloat tt = clamp( depth, aoClamp, 1.0 );\nfloat w = ( 1.0 / width )  / tt + ( noise.x * ( 1.0 - noise.x ) );\nfloat h = ( 1.0 / height ) / tt + ( noise.y * ( 1.0 - noise.y ) );\nfloat pw;\nfloat ph;\nfloat ao;\nfloat dz = 1.0 / float( samples );\nfloat z = 1.0 - dz / 2.0;\nfloat l = 0.0;\nfor ( int i = 0; i <= samples; i ++ ) {\nfloat r = sqrt( 1.0 - z );\npw = cos( l ) * r;\nph = sin( l ) * r;\nao += calcAO( depth, pw * w, ph * h );\nz = z - dz;\nl = l + DL;\n}\nao /= float( samples );\nao = 1.0 - ao;\nif ( fogEnabled ) {\nao = mix( ao, 1.0, doFog() );\n}\nvec3 color = texture2D( tDiffuse, vUv ).rgb;\nvec3 lumcoeff = vec3( 0.299, 0.587, 0.114 );\nfloat lum = dot( color.rgb, lumcoeff );\nvec3 luminance = vec3( lum );\nvec3 final = vec3( color * mix( vec3( ao ), vec3( 1.0 ), luminance * lumInfluence ) );\nif ( onlyAO ) {\nfinal = onlyAOColor * vec3( mix( vec3( ao ), vec3( 1.0 ), luminance * lumInfluence ) );\n}\ngl_FragColor = vec4( final, 1.0 );\n}"
};

THREE.FXAAShader={
	uniforms:{
		tDiffuse:{type:"t",value:null},
		resolution:{type:"v2",value:new THREE.Vector2(1/1024,1/512)}
	},
	vertexShader:
		"varying vec2 vUv;\nvoid main() {\nvUv = uv;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
	fragmentShader:
		"uniform sampler2D tDiffuse;\nuniform vec2 resolution;\nvarying vec2 vUv;\n#define FXAA_REDUCE_MIN   (1.0/128.0)\n#define FXAA_REDUCE_MUL   (1.0/8.0)\n#define FXAA_SPAN_MAX     8.0\nvoid main() {\nvec3 rgbNW = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( -1.0, -1.0 ) ) * resolution ).xyz;\nvec3 rgbNE = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( 1.0, -1.0 ) ) * resolution ).xyz;\nvec3 rgbSW = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( -1.0, 1.0 ) ) * resolution ).xyz;\nvec3 rgbSE = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( 1.0, 1.0 ) ) * resolution ).xyz;\nvec4 rgbaM  = texture2D( tDiffuse,  gl_FragCoord.xy  * resolution );\nvec3 rgbM  = rgbaM.xyz;\nfloat opacity  = rgbaM.w;\nvec3 luma = vec3( 0.299, 0.587, 0.114 );\nfloat lumaNW = dot( rgbNW, luma );\nfloat lumaNE = dot( rgbNE, luma );\nfloat lumaSW = dot( rgbSW, luma );\nfloat lumaSE = dot( rgbSE, luma );\nfloat lumaM  = dot( rgbM,  luma );\nfloat lumaMin = min( lumaM, min( min( lumaNW, lumaNE ), min( lumaSW, lumaSE ) ) );\nfloat lumaMax = max( lumaM, max( max( lumaNW, lumaNE) , max( lumaSW, lumaSE ) ) );\nvec2 dir;\ndir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));\ndir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));\nfloat dirReduce = max( ( lumaNW + lumaNE + lumaSW + lumaSE ) * ( 0.25 * FXAA_REDUCE_MUL ), FXAA_REDUCE_MIN );\nfloat rcpDirMin = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + dirReduce );\ndir = min( vec2( FXAA_SPAN_MAX,  FXAA_SPAN_MAX),\nmax( vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),\ndir * rcpDirMin)) * resolution;\nvec3 rgbA = 0.5 * (\ntexture2D( tDiffuse, gl_FragCoord.xy  * resolution + dir * ( 1.0 / 3.0 - 0.5 ) ).xyz +\ntexture2D( tDiffuse, gl_FragCoord.xy  * resolution + dir * ( 2.0 / 3.0 - 0.5 ) ).xyz );\nvec3 rgbB = rgbA * 0.5 + 0.25 * (\ntexture2D( tDiffuse, gl_FragCoord.xy  * resolution + dir * -0.5 ).xyz +\ntexture2D( tDiffuse, gl_FragCoord.xy  * resolution + dir * 0.5 ).xyz );\nfloat lumaB = dot( rgbB, luma );\nif ( ( lumaB < lumaMin ) || ( lumaB > lumaMax ) ) {\ngl_FragColor = vec4( rgbA, opacity );\n} else {\ngl_FragColor = vec4( rgbB, opacity );\n}\n}"
};

THREE.CopyShader={
	uniforms:{
		tDiffuse:{type:"t",value:null},
		opacity:{type:"f",value:1}
	},
	vertexShader:
		"varying vec2 vUv;\nvoid main() {\nvUv = uv;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
	fragmentShader:
		"uniform float opacity;\nuniform sampler2D tDiffuse;\nvarying vec2 vUv;\nvoid main() {\nvec4 texel = texture2D( tDiffuse, vUv );\ngl_FragColor = opacity * texel;\n}"
};

THREE.HorizontalTiltShiftShader={
	uniforms:{
		tDiffuse:{type:"t",value:null},
		h:{type:"f",value:1/512},
		r:{type:"f",value:0.35}
	},
	vertexShader:
		"varying vec2 vUv;\nvoid main() {\nvUv = uv;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
	fragmentShader:
		"uniform sampler2D tDiffuse;\nuniform float h;\nuniform float r;\nvarying vec2 vUv;\nvoid main() {\nvec4 sum = vec4( 0.0 );\nfloat hh = h * abs( r - vUv.y );\nsum += texture2D( tDiffuse, vec2( vUv.x - 4.0 * hh, vUv.y ) ) * 0.051;\nsum += texture2D( tDiffuse, vec2( vUv.x - 3.0 * hh, vUv.y ) ) * 0.0918;\nsum += texture2D( tDiffuse, vec2( vUv.x - 2.0 * hh, vUv.y ) ) * 0.12245;\nsum += texture2D( tDiffuse, vec2( vUv.x - 1.0 * hh, vUv.y ) ) * 0.1531;\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;\nsum += texture2D( tDiffuse, vec2( vUv.x + 1.0 * hh, vUv.y ) ) * 0.1531;\nsum += texture2D( tDiffuse, vec2( vUv.x + 2.0 * hh, vUv.y ) ) * 0.12245;\nsum += texture2D( tDiffuse, vec2( vUv.x + 3.0 * hh, vUv.y ) ) * 0.0918;\nsum += texture2D( tDiffuse, vec2( vUv.x + 4.0 * hh, vUv.y ) ) * 0.051;\ngl_FragColor = sum;\n}"
};

THREE.VerticalTiltShiftShader={
	uniforms:{
		tDiffuse:{type:"t",value:null},
		v:{type:"f",value:1/512},
		r:{type:"f",value:0.35}
	},
	vertexShader:
		"varying vec2 vUv;\nvoid main() {\nvUv = uv;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
	fragmentShader:
		"uniform sampler2D tDiffuse;\nuniform float v;\nuniform float r;\nvarying vec2 vUv;\nvoid main() {\nvec4 sum = vec4( 0.0 );\nfloat vv = v * abs( r - vUv.y );\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 4.0 * vv ) ) * 0.051;\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 3.0 * vv ) ) * 0.0918;\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 2.0 * vv ) ) * 0.12245;\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 1.0 * vv ) ) * 0.1531;\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 1.0 * vv ) ) * 0.1531;\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 2.0 * vv ) ) * 0.12245;\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 3.0 * vv ) ) * 0.0918;\nsum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 4.0 * vv ) ) * 0.051;\ngl_FragColor = sum;\n}"
};

THREE.MaskPass=function(a,b){
	this.scene=a;this.camera=b;this.clear=this.enabled=!0;this.inverse=this.needsSwap=!1
};
THREE.MaskPass.prototype={
	render:function(a,b,c){var d=a.context;d.colorMask(!1,!1,!1,!1);d.depthMask(!1);var e,f;this.inverse?(e=0,f=1):(e=1,f=0);d.enable(d.STENCIL_TEST);d.stencilOp(d.REPLACE,d.REPLACE,d.REPLACE);d.stencilFunc(d.ALWAYS,e,4294967295);d.clearStencil(f);a.render(this.scene,this.camera,c,this.clear);a.render(this.scene,this.camera,b,this.clear);d.colorMask(!0,!0,!0,!0);d.depthMask(!0);d.stencilFunc(d.EQUAL,1,4294967295);d.stencilOp(d.KEEP,d.KEEP,d.KEEP)}
};
THREE.ClearMaskPass=function(){
	this.enabled=!0
};
THREE.ClearMaskPass.prototype={
	render:function(a){a=a.context;a.disable(a.STENCIL_TEST)}
};

THREE.EffectComposer=function(a,b){
	this.renderer=a;void 0===b&&(b=new THREE.WebGLRenderTarget(window.innerWidth||1,window.innerHeight||1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBFormat,stencilBuffer:!1}));this.renderTarget1=b;this.renderTarget2=b.clone();this.writeBuffer=this.renderTarget1;this.readBuffer=this.renderTarget2;this.passes=[];void 0===THREE.CopyShader&&console.error("THREE.EffectComposer relies on THREE.CopyShader");this.copyPass=new THREE.ShaderPass(THREE.CopyShader)
};
THREE.EffectComposer.prototype={
	swapBuffers:function(){var a=this.readBuffer;this.readBuffer=this.writeBuffer;this.writeBuffer=a},addPass:function(a){this.passes.push(a)},insertPass:function(a,b){this.passes.splice(b,0,a)},render:function(a){this.writeBuffer=this.renderTarget1;this.readBuffer=this.renderTarget2;var b=!1,c,d,e=this.passes.length;for(d=0;d<e;d++)if(c=this.passes[d],c.enabled){c.render(this.renderer,this.writeBuffer,this.readBuffer,a,b);if(c.needsSwap){if(b){var f=this.renderer.context;f.stencilFunc(f.NOTEQUAL,1,4294967295);this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,a);f.stencilFunc(f.EQUAL,1,4294967295)}this.swapBuffers()}c instanceof THREE.MaskPass?b=!0:c instanceof THREE.ClearMaskPass&&(b=!1)}},reset:function(a){void 0===a&&(a=this.renderTarget1.clone(),a.width=window.innerWidth,a.height=window.innerHeight);this.renderTarget1=a;this.renderTarget2=a.clone();this.writeBuffer=this.renderTarget1;this.readBuffer=this.renderTarget2},setSize:function(a,b){var c=this.renderTarget1.clone();c.width=a;c.height=b;this.reset(c)}
};
THREE.EffectComposer.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
THREE.EffectComposer.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null);
THREE.EffectComposer.scene=new THREE.Scene;
THREE.EffectComposer.scene.add(THREE.EffectComposer.quad);

THREE.ShaderPass=function(a,b){
	this.textureID=void 0!==b?b:"tDiffuse";this.uniforms=THREE.UniformsUtils.clone(a.uniforms);this.material=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:a.vertexShader,fragmentShader:a.fragmentShader});this.renderToScreen=!1;this.needsSwap=this.enabled=!0;this.clear=!1
};
THREE.ShaderPass.prototype={
	render:function(a,b,c){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=c);THREE.EffectComposer.quad.material=this.material;this.renderToScreen?a.render(THREE.EffectComposer.scene,THREE.EffectComposer.camera):a.render(THREE.EffectComposer.scene,THREE.EffectComposer.camera,b,this.clear)}
};

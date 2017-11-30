// Slice algorithm
// deprecated

// check for intersection of BoundingBoxes
function overlapAABB(o1, o2) {
	if(!o1.geometry.boundingBox) o1.geometry.computeBoundingBox();
	if(!o2.geometry.boundingBox) o2.geometry.computeBoundingBox();
	var box1 = o1.geometry.boundingBox.clone().applyMatrix4(o1.matrixWorld);
	var box2 = o2.geometry.boundingBox.clone().applyMatrix4(o2.matrixWorld);

	var ext1 = new THREE.Vector3().subVectors(box1.max, box1.min);
	var ext2 = new THREE.Vector3().subVectors(box2.max, box2.min);
	var pdiff = new THREE.Vector3().subVectors(box1.center(), box2.center());

	return Math.abs(pdiff.x) <= ((ext1.x + ext2.x)/2)
		&&
		Math.abs(pdiff.y) <= ((ext1.y + ext2.y)/2)
		&&
		Math.abs(pdiff.z) <= ((ext1.z + ext2.z)/2);
}

// slice object/faces
function sliceObject(objGeometry, pl, linegeo) {

	var objFaces = objGeometry.faces;
	var objVertices = objGeometry.vertices;

	//var pV0 = pl.geometry.faces[0].centroid.clone().add(pl.position);
	var pV0 = pl.geometry.vertices[0].clone().setFromMatrixPosition(pl.matrix);
	var pN = pl.geometry.faces[0].normal.clone();

	pN = pN.transformDirection(pl.matrix);
	//pN = pl.worldToLocal(pN);
	//pN.normalize();
	//console.log(pN);

	var frontFaces = [];
	for(var i=0; i<objFaces.length; i++) {

		var f = objFaces[i];
		var cf = classifyFace(f, objVertices, pV0, pN);
		if(cf > 2) {
			// frontside
			frontFaces.push(f);
		}
		else if(cf < -2 && cf !== 0) {
			// backside
		}
		else {
			// intersections with plane
			var o = intersectionsFacePlane(pV0, pN, objVertices[f.a], objVertices[f.b], objVertices[f.c]);

			if(o) {
				// generate 3 new faces
				var a = splitFaceIntoFaces(f, objVertices, o, linegeo);

				var c = classifyFace(a[0], objVertices, pV0, pN);
				if(c > 2)
					frontFaces.push(a[0]);

				c = classifyFace(a[1], objVertices, pV0, pN);
				if(c > 2)
					frontFaces.push(a[1]);

				c = classifyFace(a[2], objVertices, pV0, pN);
				if(c > 2)
					frontFaces.push(a[2]);
			}
		}
	}

	var geo = new THREE.Geometry();
	geo.faces = frontFaces;
	geo.vertices = objVertices;

	return new THREE.Mesh(geo, materials['defaultMat']);
	//return new THREE.Mesh(geo, new THREE.MeshFaceMaterial(materials['sliceMultiMat']));
	//return new THREE.Mesh(geo, new THREE.MeshFaceMaterial(materials_debug));
}

// slice lines
function sliceEdges(edgGeometry, pl) {

	var pList = edgGeometry.attributes.position.array;
	var newPList = [];

	var pV0 = pl.geometry.vertices[0].clone().setFromMatrixPosition(pl.matrix);
	var pN = pl.geometry.faces[0].normal.clone();

	pN = pN.transformDirection(pl.matrix);
	//pN = pl.worldToLocal(pN);
	//pN.normalize();
	//console.log(pN);

	for(var i=0; i<pList.length; i+=6) {

		var v0 = new THREE.Vector3(pList[i], pList[i+1], pList[i+2]);
		var v1 = new THREE.Vector3(pList[i+3], pList[i+4], pList[i+5]);

		var cl = classifyLine(v0, v1, pV0, pN);

		if(cl === 4 || cl === 3 || cl === 2) {
			// frontside: take values
			newPList.push(pList[i]);
			newPList.push(pList[i+1]);
			newPList.push(pList[i+2]);
			newPList.push(pList[i+3]);
			newPList.push(pList[i+4]);
			newPList.push(pList[i+5]);
		}
		else if(cl === -4 || cl === -1) {
			// backside: do nothing (discard values)
		}
		else {
			// get intersection point
			var vs = intersectionLinePlane(pV0, pN, v0, v1).intersection;

			if(vs) {
				// exchange backside point with intersection point
				if(classifyPoint(v0, pV0, pN) === -2)
					v0 = vs;
				else if(classifyPoint(v1, pV0, pN) === -2)
					v1 = vs;

				// take values
				newPList.push(v0.x);
				newPList.push(v0.y);
				newPList.push(v0.z);
				newPList.push(v1.x);
				newPList.push(v1.y);
				newPList.push(v1.z);
			}
		}
	}

	edgGeometry.attributes.position.array = new Float32Array(newPList);
	return new THREE.Line(edgGeometry, materials['edgesMat'], THREE.LinePieces);
}

// split/cut face into 3 faces
function splitFaceIntoFaces(face, vertices, o, linegeo) {
	// vertex indices
	var i0 = face.a;
	var i1 = face.b;
	var i2 = face.c;

	// intersection points
	var vA = o.sideA.intersection;
	var vB = o.sideB.intersection;
	var vC = o.sideC.intersection;

	var iA, iB, iC;
	var nA, nB, nC;

	// insert new intersection points, compute new vertex normals
	if(vA) {
		vertices.push(vA);
		iA = vertices.length - 1;
		nA = interpolateVectors(face.vertexNormals[0], face.vertexNormals[1], o.sideA.t);
		linegeo.vertices.push(vA);
	}
	if(vB) {
		vertices.push(vB);
		iB = vertices.length - 1;
		nB = interpolateVectors(face.vertexNormals[1], face.vertexNormals[2], o.sideB.t);
		linegeo.vertices.push(vB);
	}
	if(vC) {
		vertices.push(vC);
		iC = vertices.length - 1;
		nC = interpolateVectors(face.vertexNormals[2], face.vertexNormals[0], o.sideC.t);
		linegeo.vertices.push(vC);
	}

	var fa, fb;

	// create new faces
	if(iA && iB) {
		face.a = i1; face.b = iB; face.c = iA;

		fa = new THREE.Face3(i0, iA, iB, face.normal, face.color, 0);
		fb = new THREE.Face3(i0, iB, i2, face.normal, face.color, 0);

		fa.vertexNormals = [face.vertexNormals[0], nA, nB];
		fb.vertexNormals = [face.vertexNormals[0], nB, face.vertexNormals[2]];
		face.vertexNormals = [face.vertexNormals[1], nB, nA];
	}
	else if(iB && iC) {
		face.a = i2; face.b = iC; face.c = iB;

		fa = new THREE.Face3(i1, iB, iC, face.normal, face.color, 0);
		fb = new THREE.Face3(i0, i1, iC, face.normal, face.color, 0);

		fa.vertexNormals = [face.vertexNormals[1], nB, nC];
		fb.vertexNormals = [face.vertexNormals[0], face.vertexNormals[1], nC];
		face.vertexNormals = [face.vertexNormals[2], nC, nB];
	}
	else if(iA && iC) {
		face.a = i0; face.b = iA; face.c = iC;

		fa = new THREE.Face3(i2, iC, iA, face.normal, face.color, 0);
		fb = new THREE.Face3(iA, i1, i2, face.normal, face.color, 0);

		fa.vertexNormals = [face.vertexNormals[2], nC, nA];
		fb.vertexNormals = [nA, face.vertexNormals[1], face.vertexNormals[2]];
		face.vertexNormals = [face.vertexNormals[0], nA, nC];
	}

	return [face, fa, fb];
}

// get intersection points of face and plane
function intersectionsFacePlane(pV, pN, v0, v1, v2) {
	var num = 0;
	var o = {};

	o.sideA = intersectionLinePlane(pV, pN, v0, v1);
	if(!o.sideA.t) num++;
	o.sideB = intersectionLinePlane(pV, pN, v1, v2);
	if(!o.sideB.t) num++;
	o.sideC = intersectionLinePlane(pV, pN, v2, v0);
	if(!o.sideC.t) num++;

	if(num == 1) return o;
	else return null; // possible logic problem
}

// get intersection point of line and plane
function intersectionLinePlane(pV, pN, lineStart, lineEnd) {
	var vd = pN.dot(pV.clone().sub(lineStart));
	var vo = pN.dot(lineEnd.clone().sub(lineStart));

	if(vo == 0) return {intersection: null, t: null}; // parallel

	var t = vd/vo;

	if(t >= 0 && t <= 1)
		return {intersection: interpolateVectors(lineStart, lineEnd, t), t: t};
	else
		return {intersection: null, t: null};
}

// teste, ob AABB vor, hinter oder in der Schnittebene liegt
function classifyObject(o, pl) {
	var pV = pl.geometry.vertices[0].clone().setFromMatrixPosition(pl.matrix);
	var pN = pl.geometry.faces[0].normal.clone();
	pN = pN.transformDirection(pl.matrix);

	//o.geometry.computeBoundingBox();
	var box = o.geometry.boundingBox.clone();
	box.min = box.min.add(o.position);
	box.max = box.max.add(o.position);

	var v0 = box.min;
	var v1 = new THREE.Vector3(box.min.x, box.min.y, box.max.z);
	var v2 = new THREE.Vector3(box.min.x, box.max.y, box.min.z);
	var v3 = new THREE.Vector3(box.min.x, box.max.y, box.max.z);
	var v4 = new THREE.Vector3(box.max.x, box.min.y, box.max.z);
	var v5 = new THREE.Vector3(box.max.x, box.max.y, box.min.z);
	var v6 = new THREE.Vector3(box.max.x, box.min.y, box.min.z);
	var v7 = box.max;

	var value = 0;
	value += classifyPoint(v0, pV, pN);
	value += classifyPoint(v1, pV, pN);
	value += classifyPoint(v2, pV, pN);
	value += classifyPoint(v3, pV, pN);
	value += classifyPoint(v4, pV, pN);
	value += classifyPoint(v5, pV, pN);
	value += classifyPoint(v6, pV, pN);
	value += classifyPoint(v7, pV, pN);

	if(value == 16) return 1; // frontside
	else if(value == -16) return -1; // backside
	else return 0; // intersects plane
}

// teste, ob Face vor, hinter oder in der Schnittebene liegt
function classifyFace(face, objVertices, pV, pN) {
	/** value explanation
	 6 - 3 points frontside
	 5 - 2 points frontside, 1 point touches plane
	 4 - 1 point frontside, 2 points touch plane
	 3 - 3 points touch plane
	 2 - 2 points frontside, 1 point backside
	 ---
	 0 - 1 point backside, 2 points touch plane
	 -2 - 2 points backside, 1 point frontside
	 -3 - 2 points backside, 1 point touches plane
	 -6 - 3 points backside
	 */
	var value = 0;

	value += classifyPoint(objVertices[face.a], pV, pN);
	value += classifyPoint(objVertices[face.b], pV, pN);
	value += classifyPoint(objVertices[face.c], pV, pN);

	return value;
}

// teste, ob Line vor, hinter oder in der Schnittebene liegt
function classifyLine(v0, v1, pV, pN) {
	/** value explanation
	 4 - 2 points frontside
	 3 - 1 point frontside, 1 point touches plane
	 2 - 2 points touch plane
	 ---
	 0 - 1 point frontside, 1 point backside
	 ---
	 -1 - 1 point backside, 1 point touches plane
	 -4 - 2 points backside
	 */
	var value = 0;

	value += classifyPoint(v0, pV, pN);
	value += classifyPoint(v1, pV, pN);

	return value;
}

// teste, ob Point vor, hinter oder auf der Schnittebene liegt
function classifyPoint(p, pV, pN) {
	if((p.clone().sub(pV)).dot(pN).toFixed(8) < 0)
		return -2; // backside
	else if((p.clone().sub(pV)).dot(pN).toFixed(8) > 0)
		return 2; // frontside
	else
		return 1; // on plane
}

function sliceWorld() {

	for(var key in objects) {
		var obj = objects[key].mesh;

		// teste, ob AABB vor, hinter oder in der Schnittebene liegt
		var c = classifyObject(obj, plane);

		if(c === 1) {
			// do nothing
		}
		else if(c === -1) {
			// obj ausblenden
			scene.remove(obj);
			scene.remove(objects[key].edges);
			hidden.push(obj.id);
		}
		else if(c === 0) {
			// obj schneiden
			scene.remove(obj);
			scene.remove(objects[key].edges);

			var lineGeo = new THREE.Geometry();
			var sobj = sliceObject(obj.geometry.clone(), plane, lineGeo);
			var sedg = sliceEdges(objects[key].edges.geometry.clone(), plane);

			// sliced mesh
			sobj.material = obj.material;
			objects[key].slicedMesh = sobj;
			scene.add(sobj);
			sliced.push(obj.id);

			// sliced edges
			objects[key].slicedEdges = sedg;
			scene.add(sedg);

			// rote Schnittlinie
			//objects[key].sliceLine = new THREE.Line(lineGeo, materials['sliceLineMat'], THREE.LinePieces);
			objects[key].sliceLine = sortLines(lineGeo);
			scene.add(objects[key].sliceLine);

			//console.log(objects[key].sliceLine);

			var m = new THREE.Matrix4().getInverse(plane.matrix);
			//objects[key].sliceLine.children[0].geometry.applyMatrix(m);

			// Schnittflächen
			objects[key].sliceFaces = sliceFaces(objects[key].sliceLine, plane);
			scene.add(objects[key].sliceFaces);

			//objects[key].sliceFaces.applyMatrix(m);
		}
	}

	//console.log(sliced);
	//console.log(hidden);
}

function restoreWorld() {
	for(var i=0; i<sliced.length; i++) {
		scene.remove(objects[sliced[i]].slicedMesh);
		scene.remove(objects[sliced[i]].slicedEdges);
		scene.remove(objects[sliced[i]].sliceLine);
		scene.remove(objects[sliced[i]].sliceFaces);

		objects[sliced[i]].slicedMesh = null;
		objects[sliced[i]].slicedEdges = null;
		objects[sliced[i]].sliceLine = null;
		objects[sliced[i]].sliceFaces = null;

		scene.add(objects[sliced[i]].mesh);
		scene.add(objects[sliced[i]].edges);
	}
	for(var i=0; i<hidden.length; i++) {
		scene.add(objects[hidden[i]].mesh);
		scene.add(objects[hidden[i]].edges);
	}
	/*for(var i=0; i<objects.length; i++) {
	 if(!scene.getObjectById(objects[i].id))
	 scene.add(objects[i]);
	 }*/

	sliced = [];
	hidden = [];
}

function sliceFaces(lines, pl) {
	var obj = new THREE.Object3D();
	var m = new THREE.Matrix4().getInverse(pl.matrix);

	for(var i=0; i<lines.children.length; i++) {
		var verts = lines.children[i].geometry.vertices;

		// wenn Schnittlinie nicht geschlossen, dann keine Fläche erstellen
		if(verts.length < 3)
			continue;
		if(!equalVectors(verts[0], verts[verts.length-1], 8))
			continue;

		var shapeVerts = [];
		for(var j=0; j<verts.length; j++) {
			var v = verts[j].clone();
			v.applyMatrix4(m);
			//console.log(v.x, v.y, v.z);
			shapeVerts.push(new THREE.Vector2(v.x, v.y));
		}

		var shape = new THREE.Shape(shapeVerts);
		var shapegeo = new THREE.ShapeGeometry(shape);
		shapegeo.applyMatrix(pl.matrix);

		// var tex = new THREE.ImageUtils.loadTexture('bg_schraffur.png');
		// var mat = new THREE.MeshLambertMaterial({map: tex, side: THREE.DoubleSide});
		// obj.add(new THREE.Mesh(shapegeo, mat));
		obj.add(new THREE.Mesh(shapegeo, materials['defaultDoublesideMat']));
		//obj.add(new THREE.Mesh(shapegeo, materials['wireframeMat']));
	}

	return obj;
}

// sort LinePieces to LineStrip
function sortLines(oldgeo) {
	var obj = new THREE.Object3D();
	var verts = oldgeo.vertices;

	while(verts.length > 0) {
		var sorted = [];
		if(verts.length === 1) break;

		sorted.push(verts[0]);
		sorted.push(verts[1]);
		verts.splice(0,2);

		for(var i=0; i<verts.length; i++) {

			var first = sorted[0];
			var last = sorted[sorted.length-1];

			for(var j=0; j<verts.length; j++) {
				// test with last element
				if(equalVectors(last, verts[j], 8)) {
					if(j%2 == 0) {
						sorted.push(verts[j+1]);
						verts.splice(j,2);
					}
					else {
						sorted.push(verts[j-1]);
						verts.splice(j-1, 2);
					}
					j -= 2;
					i -= 2;
					break;
				}
				// test with first element
				else if(equalVectors(first, verts[j], 8)) {
					if(j%2 == 0) {
						sorted.unshift(verts[j+1]);
						verts.splice(j,2);
					}
					else {
						sorted.unshift(verts[j-1]);
						verts.splice(j-1, 2);
					}
					j -= 2;
					i -= 2;
					break;
				}
			}
		}

		// add new Line object
		var geo = new THREE.Geometry();
		geo.vertices = sorted;
		obj.add(new THREE.Line(geo, materials['sliceLineMat'], THREE.LineStrip));
	}

	return obj;
}

// compare two Vector3 with given precision
function equalVectors(v1, v2, precision) {
	if(v1.x.toFixed(precision) !== v2.x.toFixed(precision))
		return false;
	else if(v1.y.toFixed(precision) !== v2.y.toFixed(precision))
		return false;
	else if(v1.z.toFixed(precision) !== v2.z.toFixed(precision))
		return false;
	else
		return true;
}

// interpolate two vectors
function interpolateVectors(start, end, t) {
	return start.clone().add((end.clone().sub(start)).multiplyScalar(t));
}

# How to convert UH4D coordinates to LatLon

In the current state of the UH4D browser, the scene is located very close to the origin of the local coordinate system to retain small values.
Thus, all the spatialized images are saved with local scene coordinates.

This is a small guidance on how to convert these local coordinates to global coordinates.

We will use [Three.js](https://www.npmjs.com/package/three) for vector and matrix calculations and the [utm package](https://www.npmjs.com/package/utm) for converting coordinates (using ES modules syntax).

```javascript
import * as utm from 'utm';
import {Matrix4, Quaternion, Vector3} from 'three';
```

Let's have an example transformation matrix from an [image near to the Zwinger in Dresden](http://4dbrowser.urbanhistory4d.org/#!/search?query=df_pos-2012-c_0000023) as we would receive it from the API.

```javascript
const rawMatrix = [
  -0.59811053049099, -2.7755575615628914e-17, 0.8014136218681257, 0,
  -0.17680889874214, 0.9753595495966924, -0.13195591057671166, 0,
  -0.7816664292659491, -0.22062127959591168, -0.5833728176287307, 0,
  177.64420716088446, 4.824870892888283, -601.8950240983784, 1
];

const matrix = new Matrix4().fromArray(rawMatrix);
````

The local position of the image is at `x: rawMatrix[12], y: rawMatrix[13], z: rawMatrix[14]`, but we will use Three.js to extract the translation and rotation.

```javascript
const translation = new Vector3().setFromMatrixPosition(matrix);
const rotation = new Quaternion().setFromRotationMatrix(matrix);

console.log('Translation:', translation);
// Translation: Vector3 {
//   x: 177.64420716088446,
//   y: 4.824870892888283,
//   z: -601.8950240983784
// }
```

All the local coordinates are stored in meters.
The UTM system is a coordinate system, where 1 unit is 1 meter.
Digital elevation models (DEM) or 3D city models from public departments are usually delivered in UTM coordinates.
Dresden is located in the UTM zone 33.
The offset of the UH4D scene origin to the local UTM zone origin is:

```javascript
const utmOffset = new Vector3(410973.906, 107.392, 5655871.0);
const utmZone = 33;
```

The height (y value) is not really part of the UTM coordinates, but might be important later.

The local coordinate system is a right-handed coordinate system (common in computer graphics), where positive x axis points right/to the east, positive y axis points up/height, and positive z axis points to the south.
The UTM coordinate system is actually just 2D with positive x axis pointing right/to the east and positive y axis pointing up/to the north.

For this reason, we need to negate the z value of the translation vector.
Then, we apply the offset to get the global UTM coordinates of the image position.

```javascript
const utmPosition = translation.clone()
  .multiply(new Vector3(1, 1, -1))
  .add(utmOffset);

console.log('UTM Coordinates:', utmPosition);
// UTM Coordinates: Vector3 {
//   x: 411151.5502071609,  -> easting
//   y: 112.21687089288828, -> height
//   z: 5656472.895024098   -> northing
// }
```

Now, the UTM coordinates can be converted to latitude and longitude.

```javascript
const latlon = utm.toLatLon(utmPosition.x, utmPosition.z, utmZone, undefined, true);

console.log('LatLon:', latlon);
// LatLon: {
//   latitude: 51.05290748931661,
//   longitude: 13.73234034175551
// }
```

Let's check the result on [Google Maps](https://www.google.com/maps/place/51%C2%B003'10.5%22N+13%C2%B043'56.4%22E/@51.0529075,13.7301516,17z/data=!3m1!4b1!4m5!3m4!1s0x0:0x0!8m2!3d51.0529075!4d13.7323403?hl=en).

Computing the orientation of the image depends on the target coordinate system.
Using the right-handed coordinate system as described above (east -> +x, north -> -z), the direction vector of the image results from applying the rotation to the local camera direction vector, which in computer graphics is always the negative z axis (see figure).
The rotation can also be applied to an `Object3D`.
It depends on your needs, how to use the rotation.

```javascript
console.log(new Vector3(0, 0, -1).applyQuaternion(rotation));
// Camera negative Z normal: Vector3 {
//   x: 0.7816664292659489,
//   y: 0.22062127959591166,
//   z: 0.5833728176287306
// }

const obj = new Object3D();
obj.applyQuaternion(rotation);
```

![Camera axes](https://www.scratchapixel.com/images/upload/perspective-matrix/camera2.png)

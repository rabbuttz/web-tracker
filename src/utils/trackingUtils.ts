import * as THREE from 'three';
import { vec3, mat3, quat } from 'gl-matrix';
import { HAND_LM, FACE_LM } from '../constants';

export type LM = { x: number; y: number; z: number };

export function makeAxis(color: number, size: number, radius: number, axis: 'x' | 'y' | 'z') {
    const group = new THREE.Object3D();
    const shaftLen = size * 0.8;
    const headLen = size * 0.2;
    const material = new THREE.MeshBasicMaterial({ color });

    const shaftGeo = new THREE.CylinderGeometry(radius, radius, shaftLen, 12);
    const headGeo = new THREE.ConeGeometry(radius * 1.8, headLen, 12);

    const shaft = new THREE.Mesh(shaftGeo, material);
    shaft.position.y = shaftLen * 0.5;
    group.add(shaft);

    const head = new THREE.Mesh(headGeo, material);
    head.position.y = shaftLen + headLen * 0.5;
    group.add(head);

    if (axis === 'x') group.rotation.z = -Math.PI / 2;
    if (axis === 'z') group.rotation.x = Math.PI / 2;

    return group;
}

export function makeHandGizmo(size = 60) {
    const root = new THREE.Object3D();
    const radius = Math.max(1.5, size * 0.03);

    root.add(makeAxis(0xff3333, size, radius, 'x'));
    root.add(makeAxis(0x33ff33, size, radius, 'y'));
    root.add(makeAxis(0x3333ff, size, radius, 'z'));

    return root;
}

export function poseFromHandLandmarks(lms: LM[], handedness?: string) {
    const w = vec3.fromValues(lms[HAND_LM.WRIST].x, lms[HAND_LM.WRIST].y, lms[HAND_LM.WRIST].z);
    const i = vec3.fromValues(lms[HAND_LM.INDEX_MCP].x, lms[HAND_LM.INDEX_MCP].y, lms[HAND_LM.INDEX_MCP].z);
    const p = vec3.fromValues(lms[HAND_LM.PINKY_MCP].x, lms[HAND_LM.PINKY_MCP].y, lms[HAND_LM.PINKY_MCP].z);
    const mm = vec3.fromValues(lms[HAND_LM.MIDDLE_MCP].x, lms[HAND_LM.MIDDLE_MCP].y, lms[HAND_LM.MIDDLE_MCP].z);

    const vIndex = vec3.sub(vec3.create(), i, w);
    const vPinky = vec3.sub(vec3.create(), p, w);
    const nPalm = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), vIndex, vPinky));

    const z_up = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), mm, w));
    const isLeft = handedness === 'Left';
    let x_left_raw = vec3.normalize(
        vec3.create(),
        isLeft ? vec3.sub(vec3.create(), p, i) : vec3.sub(vec3.create(), i, p),
    );
    const y_palm_hint = isLeft
        ? vec3.scale(vec3.create(), nPalm, -1)
        : vec3.normalize(vec3.create(), nPalm);

    let y_palm = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), z_up, x_left_raw));
    if (vec3.dot(y_palm, y_palm_hint) < 0) {
        vec3.scale(x_left_raw, x_left_raw, -1);
        y_palm = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), z_up, x_left_raw));
    }

    const x = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), y_palm, z_up));
    const y = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), z_up, x));
    const z = z_up;

    const rot = mat3.fromValues(
        x[0], x[1], x[2],
        y[0], y[1], y[2],
        z[0], z[1], z[2],
    );
    const q = quat.normalize(quat.create(), quat.fromMat3(quat.create(), rot));

    return { position: w, quaternion: q };
}

export function poseFromFaceLandmarks(lms: LM[]) {
    const forehead = vec3.fromValues(lms[FACE_LM.FOREHEAD].x, lms[FACE_LM.FOREHEAD].y, lms[FACE_LM.FOREHEAD].z);
    const chin = vec3.fromValues(lms[FACE_LM.CHIN].x, lms[FACE_LM.CHIN].y, lms[FACE_LM.CHIN].z);
    const leftEye = vec3.fromValues(lms[FACE_LM.LEFT_EYE_CORNER].x, lms[FACE_LM.LEFT_EYE_CORNER].y, lms[FACE_LM.LEFT_EYE_CORNER].z);
    const rightEye = vec3.fromValues(lms[FACE_LM.RIGHT_EYE_CORNER].x, lms[FACE_LM.RIGHT_EYE_CORNER].y, lms[FACE_LM.RIGHT_EYE_CORNER].z);

    const y_up = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), forehead, chin));
    const x_left_raw = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), leftEye, rightEye));
    const z_fwd = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), x_left_raw, y_up));
    const x_left = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), y_up, z_fwd));

    // Left-handed coordinate system with Z up: X=right, Y=forward, Z=up
    const x = vec3.scale(vec3.create(), x_left, -1);
    const y = z_fwd;
    const z = y_up;

    // Calculate neck base position (head-neck junction)
    const faceHeight = vec3.distance(forehead, chin);
    const neckBase = vec3.clone(chin);
    // Move backward (z_fwd points backward in MediaPipe space)
    vec3.scaleAndAdd(neckBase, neckBase, z_fwd, faceHeight * 0.5);
    // Move down slightly below chin (Y is inverted in screen space)
    vec3.scaleAndAdd(neckBase, neckBase, y_up, faceHeight * 0.15);

    const rot = mat3.fromValues(
        x[0], x[1], x[2],
        y[0], y[1], y[2],
        z[0], z[1], z[2],
    );
    const q = quat.normalize(quat.create(), quat.fromMat3(quat.create(), rot));

    return { position: neckBase, quaternion: q };
}

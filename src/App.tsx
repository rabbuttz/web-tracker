import { useCallback, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { Camera } from '@mediapipe/camera_utils';
import { Hands, type Results } from '@mediapipe/hands';
import { drawCanvas } from './utils/drawCanvas';

import * as THREE from 'three';
import { vec3, mat3, quat } from 'gl-matrix';

type LM = { x: number; y: number; z: number };

const WIDTH = 1280;
const HEIGHT = 720;
const MIRROR_X = true;

const HAND_LM = {
	WRIST: 0,
	INDEX_MCP: 5,
	MIDDLE_MCP: 9,
	MIDDLE_TIP: 12,
	PINKY_MCP: 17,
};

function makeAxis(color: number, size: number, radius: number, axis: 'x' | 'y' | 'z') {
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

function makeHandGizmo(size = 60) {
	const root = new THREE.Object3D();
	const radius = Math.max(1.5, size * 0.03);

	root.add(makeAxis(0xff3333, size, radius, 'x'));
	root.add(makeAxis(0x33ff33, size, radius, 'y'));
	root.add(makeAxis(0x3333ff, size, radius, 'z'));

	return root;
}

function poseFromHandLandmarks(lms: LM[], handedness?: string) {
	const w = vec3.fromValues(lms[HAND_LM.WRIST].x, lms[HAND_LM.WRIST].y, lms[HAND_LM.WRIST].z);
	const i = vec3.fromValues(lms[HAND_LM.INDEX_MCP].x, lms[HAND_LM.INDEX_MCP].y, lms[HAND_LM.INDEX_MCP].z);
	const p = vec3.fromValues(lms[HAND_LM.PINKY_MCP].x, lms[HAND_LM.PINKY_MCP].y, lms[HAND_LM.PINKY_MCP].z);
	const mm = vec3.fromValues(lms[HAND_LM.MIDDLE_MCP].x, lms[HAND_LM.MIDDLE_MCP].y, lms[HAND_LM.MIDDLE_MCP].z);

	const vIndex = vec3.sub(vec3.create(), i, w);
	const vPinky = vec3.sub(vec3.create(), p, w);
	const nPalm = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), vIndex, vPinky));

	const z = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), mm, w));
	const isLeft = handedness === 'Left';
	let xRaw = vec3.normalize(
		vec3.create(),
		isLeft ? vec3.sub(vec3.create(), p, i) : vec3.sub(vec3.create(), i, p),
	);
	const yBack = isLeft
		? vec3.scale(vec3.create(), nPalm, -1)
		: vec3.normalize(vec3.create(), nPalm);
	let y = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), z, xRaw));
	if (vec3.dot(y, yBack) < 0) {
		vec3.scale(xRaw, xRaw, -1);
		y = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), z, xRaw));
	}
	const x = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), y, z));
	const y2 = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), z, x));

	const rot = mat3.fromValues(
		x[0], x[1], x[2],
		y2[0], y2[1], y2[2],
		z[0], z[1], z[2],
	);
	const q = quat.normalize(quat.create(), quat.fromMat3(quat.create(), rot));

	return { position: w, quaternion: q };
}

function App() {
	const webcamRef = useRef<Webcam>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const threeCanvasRef = useRef<HTMLCanvasElement>(null)
	const resultsRef = useRef<any>(null)
	const wsRef = useRef<WebSocket | null>(null)
	const threeStateRef = useRef<{
		renderer: THREE.WebGLRenderer;
		scene: THREE.Scene;
		camera: THREE.OrthographicCamera;
		gizmos: THREE.Object3D[];
	} | null>(null)

	const onResults = useCallback((results: Results) => {
		resultsRef.current = results

		const canvasCtx = canvasRef.current!.getContext('2d')!
		drawCanvas(canvasCtx, results)

		const st = threeStateRef.current
		if (!st) return

		const hands2d = results.multiHandLandmarks ?? []
		const hands3d = results.multiHandWorldLandmarks ?? []
		const handedness = results.multiHandedness ?? []

		const ws = wsRef.current
		const sendParam = (path: string, values: number[]) => {
			if (!ws || ws.readyState !== WebSocket.OPEN) return
			ws.send(`${path} [${values.join(';')}]`)
		}

		for (let hi = 0; hi < st.gizmos.length; hi++) {
			const gizmo = st.gizmos[hi]
			const lm2d = hands2d[hi]
			if (!lm2d) {
				gizmo.visible = false
				continue
			}
			gizmo.visible = true

			const wrist2d = lm2d[0]
			const x = (MIRROR_X ? 1 - wrist2d.x : wrist2d.x) * WIDTH
			const y = (1 - wrist2d.y) * HEIGHT
			const z = -wrist2d.z * 300
			gizmo.position.set(x, y, z)

			const lmForRot = hands3d[hi]?.map(p => ({ x: p.x, y: p.y, z: p.z }))
				?? lm2d.map(p => ({ x: p.x, y: p.y, z: p.z }))
			const rawLabel = handedness[hi]?.label
			const label = MIRROR_X
				? (rawLabel === 'Left' ? 'Right' : rawLabel === 'Right' ? 'Left' : rawLabel)
				: rawLabel
			const rotLabel = label ?? (hi === 0 ? 'Left' : 'Right')
			const { quaternion } = poseFromHandLandmarks(lmForRot, rotLabel)
			gizmo.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3])
			const suffix = label === 'Left' ? 'L' : label === 'Right' ? 'R' : (hi === 0 ? 'L' : 'R')
			const positionPath = `/avatar/parameters/Hand.${suffix}.Position`
			const rotationPath = `/avatar/parameters/Hand.${suffix}.Rotation`

			const normX = MIRROR_X ? 1 - wrist2d.x : wrist2d.x
			const normY = 1 - wrist2d.y
			const normZ = wrist2d.z
			sendParam(positionPath, [normX, normY, normZ])
			sendParam(rotationPath, [
				gizmo.quaternion.x,
				gizmo.quaternion.y,
				gizmo.quaternion.z,
				gizmo.quaternion.w,
			])
		}
	}, [])

	useEffect(() => {
		const ws = new WebSocket('ws://localhost:3456')
		wsRef.current = ws
		return () => {
			ws.close()
			wsRef.current = null
		}
	}, [])

	useEffect(() => {
		const canvas = threeCanvasRef.current
		if (!canvas) return

		const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
		renderer.setSize(WIDTH, HEIGHT, false)
		renderer.setPixelRatio(window.devicePixelRatio)

		const scene = new THREE.Scene()
		const camera = new THREE.OrthographicCamera(0, WIDTH, HEIGHT, 0, -1000, 1000)
		camera.position.z = 10

		const gizmos = [makeHandGizmo(60), makeHandGizmo(60)]
		gizmos.forEach(g => {
			g.visible = false
			scene.add(g)
		})

		threeStateRef.current = { renderer, scene, camera, gizmos }

		let raf = 0
		const tick = () => {
			raf = requestAnimationFrame(tick)
			renderer.render(scene, camera)
		}
		tick()

		return () => {
			cancelAnimationFrame(raf)
			renderer.dispose()
			threeStateRef.current = null
		}
	}, [])

	useEffect(() => {
		const hands = new Hands({
			locateFile: file => {
				return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
			}
		})

		hands.setOptions({
			maxNumHands: 2,
			modelComplexity: 1,
			minDetectionConfidence: 0.5,
			minTrackingConfidence: 0.5
		})

		hands.onResults(onResults)

		if (typeof webcamRef.current !== 'undefined' && webcamRef.current !== null) {
			const camera = new Camera(webcamRef.current.video!, {
				onFrame: async () => {
					await hands.send({ image: webcamRef.current!.video! })
				},
				width: 1280,
				height: 720
			})
			camera.start()
		}
	}, [onResults])

	const videoConstraints = {
		width: WIDTH,
		height: HEIGHT,
		facingMode: 'user'
	}

	return (
		<div
            style={{
                position: 'relative',
                width: `${WIDTH}px`,
                height: `${HEIGHT}px`,
            }}
        >
			{/* capture */}
			<Webcam
				audio={false}
				style={{ 
                    visibility: 'hidden',
                    position: 'absolute',
                }}
				width={WIDTH}
				height={HEIGHT}
				ref={webcamRef}
				screenshotFormat="image/jpeg"
				videoConstraints={videoConstraints}
			/>
			<canvas 
                ref={canvasRef} 
				width={WIDTH}
				height={HEIGHT}
                style={{
                    position: 'absolute',
                    width: `${WIDTH}px`,
                    height: `${HEIGHT}px`,
                    backgroundColor: '#fff',
                }}
            />
			<canvas
				ref={threeCanvasRef}
				width={WIDTH}
				height={HEIGHT}
				style={{
					position: 'absolute',
					width: `${WIDTH}px`,
					height: `${HEIGHT}px`,
					pointerEvents: 'none',
				}}
			/>
		</div>
	)
}

export default App

import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { type Results as HandResults } from '@mediapipe/hands';
import { type Results as FaceResults } from '@mediapipe/face_mesh';
import { quat, vec3 } from 'gl-matrix';
import { drawCanvas } from './utils/drawCanvas';
import { WIDTH, HEIGHT, MIRROR_X, FACE_LM } from './constants';
import { poseFromHandLandmarks, poseFromFaceLandmarks } from './utils/trackingUtils';
import { ControlPanel } from './components/ControlPanel';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useThreeManager } from './hooks/useThreeManager';

declare global {
	interface Window {
		electronAPI: {
			oscSend: (path: string, value: any) => void;
		};
	}
}

function App() {
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')

	const webcamRef = useRef<Webcam>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const threeCanvasRef = useRef<HTMLCanvasElement>(null)

	const handResultsRef = useRef<HandResults | null>(null)
	const faceResultsRef = useRef<FaceResults | null>(null)
	const headPoseRef = useRef<{ position: vec3; quaternion: quat } | null>(null)
	const calibrationRef = useRef<{ position: vec3; quaternion: quat } | null>(null)
	const rawHeadPoseRef = useRef<{ position: vec3; quaternion: quat } | null>(null)

	const threeStateRef = useThreeManager(threeCanvasRef.current)

	const formatVec = (v: number[]) => `[${v.map(n => n.toFixed(4)).join(';')}]`

	const handleCalibrate = useCallback(() => {
		if (rawHeadPoseRef.current) {
			calibrationRef.current = {
				position: vec3.clone(rawHeadPoseRef.current.position),
				quaternion: quat.clone(rawHeadPoseRef.current.quaternion)
			}
		}
	}, [])

	const sendParam = (path: string, values: number[]) => {
		if (window.electronAPI) {
			let val: any = values
			if (path.includes('Rotation') || path.includes('Position')) {
				val = formatVec(values)
			} else {
				val = values.length === 1 ? values[0] : formatVec(values)
			}
			window.electronAPI.oscSend(path, val)
		}
	}

	const onHandResults = useCallback((results: HandResults) => {
		handResultsRef.current = results
		const canvasCtx = canvasRef.current?.getContext('2d')
		if (canvasCtx) {
			drawCanvas(canvasCtx, results, faceResultsRef.current || undefined)
		}

		const st = threeStateRef.current
		if (!st) return

		const hands2d = results.multiHandLandmarks ?? []
		const hands3d = results.multiHandWorldLandmarks ?? []
		const handedness = results.multiHandedness ?? []

		const detectedHands = new Set<string>();

		for (let hi = 0; hi < st.handGizmos.length; hi++) {
			const gizmo = st.handGizmos[hi]
			const lm2d = hands2d[hi]
			const rawLabel = handedness[hi]?.label
			const label = MIRROR_X
				? (rawLabel === 'Left' ? 'Right' : rawLabel === 'Right' ? 'Left' : rawLabel)
				: rawLabel
			const suffix = label === 'Left' ? 'L' : label === 'Right' ? 'R' : (hi === 0 ? 'L' : 'R')

			if (!lm2d) {
				gizmo.visible = false
				continue
			}
			gizmo.visible = true
			detectedHands.add(suffix);

			const wrist2d = lm2d[0]
			const x = (MIRROR_X ? 1 - wrist2d.x : wrist2d.x) * WIDTH
			const y = (1 - wrist2d.y) * HEIGHT
			const z = -wrist2d.z * 300
			gizmo.position.set(x, y, z)

			const lmForRot = hands3d[hi]?.map(p => ({ x: p.x, y: p.y, z: p.z }))
				?? lm2d.map(p => ({ x: p.x, y: p.y, z: p.z }))
			const rotLabel = label ?? (hi === 0 ? 'Left' : 'Right')

			const { quaternion } = poseFromHandLandmarks(lmForRot, rotLabel)
			gizmo.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3])

			const positionPath = `/avatar/parameters/Hand.${suffix}.Position`
			const rotationPath = `/avatar/parameters/Hand.${suffix}.Rotation`
			const detectedPath = `/avatar/parameters/Hand.${suffix}.Detected`

			const normX = MIRROR_X ? 1 - wrist2d.x : wrist2d.x
			const normY = 1 - wrist2d.y
			const normZ = wrist2d.z

			// Calculate head-relative position (position offset only, no rotation)
			const headPose = headPoseRef.current
			if (headPose) {
				const relX = normX - headPose.position[0]
				const relY = normY - headPose.position[1]
				const relZ = normZ - headPose.position[2]
				sendParam(positionPath, [relX, relY, relZ])
			} else {
				sendParam(positionPath, [normX, normY, normZ])
			}
			sendParam(rotationPath, [quaternion[0], quaternion[1], quaternion[2], quaternion[3]])
			sendParam(detectedPath, [1]) // Detected
		}

		// Send not detected for L/R if they weren't in the loop
		['L', 'R'].forEach(s => {
			if (!detectedHands.has(s)) {
				sendParam(`/avatar/parameters/Hand.${s}.Detected`, [0])
			}
		})
	}, [threeStateRef])

	const onFaceResults = useCallback((results: FaceResults) => {
		faceResultsRef.current = results
		const canvasCtx = canvasRef.current?.getContext('2d')
		if (canvasCtx) {
			drawCanvas(canvasCtx, handResultsRef.current || undefined, results)
		}

		const st = threeStateRef.current
		if (!st) return

		if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
			const lms = results.multiFaceLandmarks[0]
			st.faceGizmo.visible = true

			const { position, quaternion } = poseFromFaceLandmarks(lms)
			const gizmoX = (MIRROR_X ? 1 - position[0] : position[0]) * WIDTH
			const gizmoY = (1 - position[1]) * HEIGHT
			const gizmoZ = -position[2] * 300
			st.faceGizmo.position.set(gizmoX, gizmoY, gizmoZ)
			st.faceGizmo.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3])

			const nose2d = lms[FACE_LM.NOSE]
			const normX = MIRROR_X ? 1 - nose2d.x : nose2d.x
			const normY = 1 - nose2d.y
			const normZ = nose2d.z

			const rawPos = vec3.fromValues(normX, normY, normZ)
			const rawQuat = quat.fromValues(quaternion[0], quaternion[1], quaternion[2], quaternion[3])

			// Store raw head pose for calibration
			rawHeadPoseRef.current = { position: rawPos, quaternion: rawQuat }

			// Store head pose for hand relative calculations
			headPoseRef.current = { position: vec3.clone(rawPos), quaternion: quat.clone(rawQuat) }

			// Apply calibration offset
			let outPos = rawPos
			let outQuat = rawQuat
			if (calibrationRef.current) {
				outPos = vec3.sub(vec3.create(), rawPos, calibrationRef.current.position)
				const calibQuatInv = quat.invert(quat.create(), calibrationRef.current.quaternion)
				outQuat = quat.multiply(quat.create(), calibQuatInv, rawQuat)
				quat.normalize(outQuat, outQuat)
			}

			sendParam('/avatar/parameters/Head.Position', [outPos[0], outPos[1], outPos[2]])
			sendParam('/avatar/parameters/Head.Rotation', [outQuat[0], outQuat[1], outQuat[2], outQuat[3]])
			sendParam('Head.Rotation', [outQuat[0], outQuat[1], outQuat[2], outQuat[3]])

			// MouthOpen calculation
			const upper = lms[FACE_LM.LIP_UPPER]
			const lower = lms[FACE_LM.LIP_LOWER]
			const mouthOpen = Math.max(0, (lower.y - upper.y) * 10) // Approx 0.0 to 1.0
			sendParam('/avatar/parameters/MouthOpen', [mouthOpen])
			sendParam('/avatar/parameters/Head.Detected', [1])

		} else {
			st.faceGizmo.visible = false
			sendParam('/avatar/parameters/Head.Detected', [0])
			sendParam('/avatar/parameters/MouthOpen', [0])
		}
	}, [threeStateRef])

	// Camera setup
	useEffect(() => {
		const updateDevices = async () => {
			const deviceInfos = await navigator.mediaDevices.enumerateDevices()
			const videoDevices = deviceInfos.filter(d => d.kind === 'videoinput')
			setDevices(videoDevices)
			if (videoDevices.length > 0 && !selectedDeviceId) {
				setSelectedDeviceId(videoDevices[0].deviceId)
			}
		}
		updateDevices()
		navigator.mediaDevices.addEventListener('devicechange', updateDevices)
		return () => navigator.mediaDevices.removeEventListener('devicechange', updateDevices)
	}, [selectedDeviceId])

	// MediaPipe setup
	useMediaPipe(
		webcamRef.current?.video || null,
		onHandResults,
		onFaceResults,
		selectedDeviceId
	)


	return (
		<div className="app-container" style={{ position: 'relative', width: WIDTH, height: HEIGHT, backgroundColor: '#0f0f13', overflow: 'hidden' }}>
			<Webcam
				audio={false}
				style={{ visibility: 'hidden', position: 'absolute' }}
				width={WIDTH}
				height={HEIGHT}
				ref={webcamRef}
				videoConstraints={{ width: WIDTH, height: HEIGHT, deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined }}
			/>
			<canvas
				ref={canvasRef}
				width={WIDTH}
				height={HEIGHT}
				style={{ position: 'absolute', width: WIDTH, height: HEIGHT, backgroundColor: '#16161a' }}
			/>
			<canvas
				ref={threeCanvasRef}
				width={WIDTH}
				height={HEIGHT}
				style={{ position: 'absolute', width: WIDTH, height: HEIGHT, pointerEvents: 'none' }}
			/>

			<ControlPanel
				devices={devices}
				selectedDeviceId={selectedDeviceId}
				onDeviceChange={setSelectedDeviceId}
				onCalibrate={handleCalibrate}
			/>
		</div>
	)
}

export default App

import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { type Results as HandResults } from '@mediapipe/hands';
import { type Results as FaceResults } from '@mediapipe/face_mesh';
import { quat, vec3 } from 'gl-matrix';
import { drawCanvas } from './utils/drawCanvas';
import { WIDTH, HEIGHT, MIRROR_X, FACE_LM, HAND_LM } from './constants';
import { poseFromHandLandmarks, poseFromFaceLandmarks } from './utils/trackingUtils';
import { ControlPanel } from './components/ControlPanel';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useThreeManager } from './hooks/useThreeManager';

interface HandCalibration {
	leftHandSize: number | null;
	rightHandSize: number | null;
	referenceDepth: number;
}

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
	const [handCalibCountdown, setHandCalibCountdown] = useState<number | null>(null)
	const [setupStatus, setSetupStatus] = useState<string>('')
	const [mouthDebug, setMouthDebug] = useState<{
		nHeight: number;
		nWidth: number;
		aa: number;
		ih: number;
		ou: number;
		E: number;
		oh: number;
	} | null>(null)

	const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

	const webcamRef = useRef<Webcam>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const threeCanvasRef = useRef<HTMLCanvasElement>(null)

	const handleWebcamRef = useCallback((node: Webcam | null) => {
		webcamRef.current = node;
		if (node && node.video) {
			setVideoElement(node.video);
		}
	}, []);

	const handResultsRef = useRef<HandResults | null>(null)
	const faceResultsRef = useRef<FaceResults | null>(null)
	const headPoseRef = useRef<{ position: vec3; quaternion: quat } | null>(null)
	const calibrationRef = useRef<{ position: vec3; quaternion: quat } | null>(null)
	const rawHeadPoseRef = useRef<{ position: vec3; quaternion: quat } | null>(null)
	const handCalibrationRef = useRef<HandCalibration>({
		leftHandSize: null,
		rightHandSize: null,
		referenceDepth: 0.5
	})

	const threeStateRef = useThreeManager(threeCanvasRef.current)

	const formatVec = (v: number[]) => `[${v.map(n => n.toFixed(4)).join(';')}]`

	const calculateHandSize = (landmarks: { x: number; y: number; z: number }[]) => {
		const wrist = landmarks[HAND_LM.WRIST]
		const middleTip = landmarks[HAND_LM.MIDDLE_TIP]
		const dx = middleTip.x - wrist.x
		const dy = middleTip.y - wrist.y
		return Math.sqrt(dx * dx + dy * dy)
	}

	const handleHandCalibrate = useCallback(() => {
		setHandCalibCountdown(3)
		const interval = setInterval(() => {
			setHandCalibCountdown(prev => {
				if (prev === null || prev <= 1) {
					clearInterval(interval)
					const results = handResultsRef.current
					if (results?.multiHandLandmarks && results.multiHandedness) {
						for (let i = 0; i < results.multiHandLandmarks.length; i++) {
							const lm = results.multiHandLandmarks[i]
							const rawLabel = results.multiHandedness[i]?.label
							const label = MIRROR_X
								? (rawLabel === 'Left' ? 'Right' : rawLabel === 'Right' ? 'Left' : rawLabel)
								: rawLabel
							const handSize = calculateHandSize(lm)
							if (label === 'Left') {
								handCalibrationRef.current.leftHandSize = handSize
							} else if (label === 'Right') {
								handCalibrationRef.current.rightHandSize = handSize
							}
						}
					}
					return null
				}
				return prev - 1
			})
		}, 1000)
	}, [])

	const handleCalibrate = useCallback(() => {
		if (rawHeadPoseRef.current) {
			calibrationRef.current = {
				position: vec3.clone(rawHeadPoseRef.current.position),
				quaternion: quat.clone(rawHeadPoseRef.current.quaternion)
			}
		}
	}, [])

	const handleSetupFaceTrack = useCallback(async (username: string, port: number) => {
		setSetupStatus('Setting up...');
		try {
			const response = await fetch(`http://localhost:3000/setup-facetrack?username=${encodeURIComponent(username)}&port=${port}`);
			const text = await response.text();
			setSetupStatus(text);
		} catch (error) {
			setSetupStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
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

			if (!lm2d || lm2d.length === 0 || !lm2d[0]) {
				gizmo.visible = false
				continue
			}
			gizmo.visible = true
			detectedHands.add(suffix);

			const wrist2d = lm2d[0]
			const x = (MIRROR_X ? 1 - wrist2d.x : wrist2d.x) * WIDTH
			const y = (1 - wrist2d.y) * HEIGHT

			// Calculate depth from hand size if calibrated
			const currentHandSize = calculateHandSize(lm2d)
			const calibHandSize = label === 'Left'
				? handCalibrationRef.current.leftHandSize
				: handCalibrationRef.current.rightHandSize
			let z: number
			if (calibHandSize) {
				const depthRatio = calibHandSize / currentHandSize
				z = -(handCalibrationRef.current.referenceDepth * depthRatio) * 300
			} else {
				z = -wrist2d.z * 300
			}
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
			// Use calibrated depth if available
			let normZ: number
			if (calibHandSize) {
				const depthRatio = calibHandSize / currentHandSize
				normZ = handCalibrationRef.current.referenceDepth * depthRatio
			} else {
				normZ = wrist2d.z
			}

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

			// Mouth and Viseme calculation
			const upper = lms[FACE_LM.LIP_UPPER]
			const lower = lms[FACE_LM.LIP_LOWER]
			const mLeft = lms[FACE_LM.MOUTH_LEFT]
			const mRight = lms[FACE_LM.MOUTH_RIGHT]
			const forehead = lms[FACE_LM.FOREHEAD]
			const chin = lms[FACE_LM.CHIN]
			const leftEye = lms[FACE_LM.LEFT_EYE_CORNER]
			const rightEye = lms[FACE_LM.RIGHT_EYE_CORNER]

			const faceHeight = Math.abs(chin.y - forehead.y)
			const mouthHeight = Math.abs(lower.y - upper.y)
			const mouthWidth = Math.abs(mRight.x - mLeft.x)
			const eyeDist = Math.abs(rightEye.x - leftEye.x)

			// Normalized values
			const nHeight = mouthHeight / faceHeight
			const nWidth = mouthWidth / eyeDist

			// Basic MouthOpen based on actual data
			const mouthOpen = Math.max(0, Math.min(1.0, nHeight / 0.2)) // 0.2 is max from "あ"
			sendParam('/avatar/parameters/MouthOpen', [mouthOpen])

			// Define target values for each viseme based on user calibration data
			// Format: [height, width]
			const targets = {
				aa: { h: 0.20, w: 0.50 },  // あ
				ih: { h: 0.06, w: 0.58 },  // い
				ou: { h: 0.015, w: 0.35 }, // う
				E:  { h: 0.07, w: 0.50 },  // え
				oh: { h: 0.05, w: 0.28 }   // お
			}

			// Helper function: calculate activation based on distance from target
			const calcActivation = (targetH: number, targetW: number, hWeight: number, wWeight: number, threshold: number) => {
				const hDist = Math.abs(nHeight - targetH) / hWeight
				const wDist = Math.abs(nWidth - targetW) / wWeight
				const totalDist = Math.sqrt(hDist * hDist + wDist * wDist)
				return Math.max(0, 1.0 - totalDist / threshold)
			}

			// Calculate each viseme based on distance from target
			// Weights determine how much each dimension matters
			// Threshold determines activation range

			// あ (aa): Primarily height-driven, width should be medium
			let v_aa = nHeight < 0.01 ? 0 : calcActivation(targets.aa.h, targets.aa.w, 0.15, 0.15, 1.2)

			// い (ih): Wide mouth, medium height
			let v_ih = nHeight < 0.01 ? 0 : calcActivation(targets.ih.h, targets.ih.w, 0.05, 0.1, 1.5)

			// う (ou): Very small height, narrow width
			let v_ou = nHeight < 0.005 ? 0 : calcActivation(targets.ou.h, targets.ou.w, 0.02, 0.15, 1.5)

			// え (E): Medium height, medium width (similar to aa but less height)
			let v_E = nHeight < 0.01 ? 0 : calcActivation(targets.E.h, targets.E.w, 0.05, 0.15, 1.5)

			// お (oh): Small height, narrow width (narrowest)
			let v_oh = nHeight < 0.01 ? 0 : calcActivation(targets.oh.h, targets.oh.w, 0.04, 0.1, 1.5)

			// Ensure no NaN values
			v_aa = isNaN(v_aa) ? 0 : v_aa
			v_ih = isNaN(v_ih) ? 0 : v_ih
			v_ou = isNaN(v_ou) ? 0 : v_ou
			v_E = isNaN(v_E) ? 0 : v_E
			v_oh = isNaN(v_oh) ? 0 : v_oh

			// Height-based boost: when mouth is wide open, strongly favor "aa"
			// User's "aa" data: Height = 0.2, so use that as reference for 100%
			if (nHeight >= 0.12) {
				const heightRatio = Math.min(1.0, nHeight / 0.2)
				v_aa = Math.max(v_aa, heightRatio)
			} else if (nHeight >= 0.02) {
				// For smaller openings, boost the strongest viseme moderately
				const maxViseme = Math.max(v_aa, v_ih, v_ou, v_E, v_oh)
				if (maxViseme < 0.3) {
					const minBoost = 0.4
					if (v_aa >= maxViseme) v_aa = Math.max(v_aa, minBoost)
					else if (v_E >= maxViseme) v_E = Math.max(v_E, minBoost)
					else if (v_ih >= maxViseme) v_ih = Math.max(v_ih, minBoost)
					else if (v_oh >= maxViseme) v_oh = Math.max(v_oh, minBoost)
					else if (v_ou >= maxViseme) v_ou = Math.max(v_ou, minBoost)
				}
			}

			// Send to OSC (VRChat/Resonite parameter names)
			// Force very small value instead of exact 0 to ensure OSC sends it
			sendParam('/avatar/parameters/aa', [v_aa === 0 ? 0.0001 : v_aa])
			sendParam('/avatar/parameters/ih', [v_ih === 0 ? 0.0001 : v_ih])
			sendParam('/avatar/parameters/ou', [v_ou === 0 ? 0.0001 : v_ou])
			sendParam('/avatar/parameters/E', [v_E === 0 ? 0.0001 : v_E])
			sendParam('/avatar/parameters/oh', [v_oh === 0 ? 0.0001 : v_oh])

			// Update debug info
			setMouthDebug({
				nHeight,
				nWidth,
				aa: v_aa,
				ih: v_ih,
				ou: v_ou,
				E: v_E,
				oh: v_oh
			})

			sendParam('/avatar/parameters/Head.Detected', [1])

		} else {
			st.faceGizmo.visible = false
			sendParam('/avatar/parameters/Head.Detected', [0])
			sendParam('/avatar/parameters/MouthOpen', [0.0001])
			// Send very small value instead of 0 for all visemes when face not detected
			sendParam('/avatar/parameters/aa', [0.0001])
			sendParam('/avatar/parameters/ih', [0.0001])
			sendParam('/avatar/parameters/ou', [0.0001])
			sendParam('/avatar/parameters/E', [0.0001])
			sendParam('/avatar/parameters/oh', [0.0001])
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
		videoElement,
		onHandResults,
		onFaceResults,
		selectedDeviceId
	)


	return (
		<div className="app-container" style={{ position: 'relative', width: WIDTH, height: HEIGHT, backgroundColor: '#0f0f13', overflow: 'hidden' }}>
			<Webcam
				key={selectedDeviceId}
				audio={false}
				style={{ visibility: 'hidden', position: 'absolute' }}
				width={WIDTH}
				height={HEIGHT}
				ref={handleWebcamRef}
				videoConstraints={{ width: WIDTH, height: HEIGHT, deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined }}
				onUserMedia={() => {
					if (webcamRef.current?.video) {
						setVideoElement(webcamRef.current.video);
					}
				}}
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

			{handCalibCountdown !== null && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: WIDTH,
					height: HEIGHT,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: 'rgba(0, 0, 0, 0.5)',
					pointerEvents: 'none',
					zIndex: 50
				}}>
					<div style={{
						fontSize: '120px',
						fontWeight: 'bold',
						color: 'white',
						textShadow: '0 0 20px rgba(150, 100, 255, 0.8)'
					}}>
						{handCalibCountdown}
					</div>
				</div>
			)}

			<ControlPanel
				devices={devices}
				selectedDeviceId={selectedDeviceId}
				onDeviceChange={setSelectedDeviceId}
				onCalibrate={handleCalibrate}
				onHandCalibrate={handleHandCalibrate}
				handCalibCountdown={handCalibCountdown}
				onSetupFaceTrack={handleSetupFaceTrack}
				setupStatus={setupStatus}
				mouthDebug={mouthDebug}
			/>
		</div>
	)
}

export default App

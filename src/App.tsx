import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { type FaceLandmarkerResult, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { quat, vec3, mat3 } from 'gl-matrix';
import { drawCanvas } from './utils/drawCanvas';
import { WIDTH, HEIGHT, MIRROR_X, FACE_LM, HAND_LM, ARKIT_BLENDSHAPES, ARKIT_TO_UNIFIED_MAP } from './constants';
import { poseFromHandLandmarks, poseFromFaceLandmarks } from './utils/trackingUtils';
import { ControlPanel } from './components/ControlPanel';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useThreeManager } from './hooks/useThreeManager';

interface HandCalibration {
  leftHandSize: number | null;
  rightHandSize: number | null;
  referenceDepth: number;
}

interface EyeCalibration {
  openLeft: number;
  openRight: number;
  closedLeft: number;
  closedRight: number;
  frameCount: number;
}

declare global {
  interface Window {
    electronAPI: {
      oscSend: (path: string, value: number | number[] | string) => void;
    };
  }
}

function App() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [handCalibCountdown, setHandCalibCountdown] = useState<number | null>(null)
  const [setupStatus, setSetupStatus] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [expressionMode, setExpressionMode] = useState<'visemeBlendshape' | 'blendshape'>('visemeBlendshape')
  const [mouthDebug, setMouthDebug] = useState<{
    nHeight: number;
    nWidth: number;
    aa: number;
    ih: number;
    ou: number;
    E: number;
    oh: number;
  } | null>(null)

  const [blendshapeDebug, setBlendshapeDebug] = useState<{ name: string; value: number }[] | null>(null)

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

  const handResultsRef = useRef<HandLandmarkerResult | null>(null)
  const faceResultsRef = useRef<FaceLandmarkerResult | null>(null)
  const headPoseRef = useRef<{ position: vec3; quaternion: quat } | null>(null)
  const calibrationRef = useRef<{ position: vec3; quaternion: quat } | null>(null)
  const rawHeadPoseRef = useRef<{ position: vec3; quaternion: quat } | null>(null)
  const handCalibrationRef = useRef<HandCalibration>({
    leftHandSize: null,
    rightHandSize: null,
    referenceDepth: 0.5
  })

  const eyeCalibrationRef = useRef<EyeCalibration>({
    openLeft: 1.0,
    openRight: 1.0,
    closedLeft: 0.0,
    closedRight: 0.0,
    frameCount: 0
  })

  const detectedBlendshapeNamesRef = useRef<Set<string>>(new Set())
  const debugUpdateCounterRef = useRef(0)
  const expressionModeRef = useRef<'visemeBlendshape' | 'blendshape'>(expressionMode)

  // Keep expressionModeRef in sync with state
  useEffect(() => {
    expressionModeRef.current = expressionMode
  }, [expressionMode])

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
          if (results?.landmarks && results.handedness) {
            for (let i = 0; i < results.landmarks.length; i++) {
              const lm = results.landmarks[i]
              const rawLabel = results.handedness[i]?.[0]?.categoryName
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

  const handleSetupArkit = useCallback(async (username: string, port: number) => {
    setSetupStatus('Setting up ARKit...');
    try {
      const response = await fetch(`http://localhost:3000/setup-arkit?username=${encodeURIComponent(username)}&port=${port}`);
      const data = await response.json();
      if (data.success) {
        setSetupStatus(`Success: Created ${data.createdCount}, Updated ${data.updatedCount}`);
      } else {
        setSetupStatus(`Error: ${data.error || 'Failed'}`);
      }
    } catch (error) {
      setSetupStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [])

  const handleSetMode = useCallback((mode: 'visemeBlendshape' | 'blendshape') => {
    setExpressionMode(mode)
  }, [])

  const sendParam = useCallback((path: string, values: number[]) => {
    if (window.electronAPI) {
      let val: number | string;
      if (path.includes('Rotation') || path.includes('Position')) {
        val = formatVec(values);
      } else {
        val = values.length === 1 ? values[0] : formatVec(values);
      }
      window.electronAPI.oscSend(path, val);
    }
  }, []);

  const processResults = useCallback((faceResults: FaceLandmarkerResult | null, handResults: HandLandmarkerResult | null) => {
    faceResultsRef.current = faceResults
    handResultsRef.current = handResults

    // Throttle debug UI updates to every 5 frames to reduce React re-renders
    debugUpdateCounterRef.current = (debugUpdateCounterRef.current + 1) % 5
    const shouldUpdateDebug = debugUpdateCounterRef.current === 0

    const canvasCtx = canvasRef.current?.getContext('2d')
    if (canvasCtx) {
      if (videoElement && videoElement.readyState >= 2) {
        drawCanvas(canvasCtx, handResults || undefined, faceResults || undefined, videoElement)
      } else {
        // Fallback: draw a dark background when video is not ready
        canvasCtx.fillStyle = '#16161a'
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)
        canvasCtx.fillStyle = '#666'
        canvasCtx.font = '20px sans-serif'
        canvasCtx.textAlign = 'center'
        canvasCtx.fillText('Waiting for camera...', WIDTH / 2, HEIGHT / 2)
      }
    }

    const st = threeStateRef.current
    if (!st) return

    // Process hand results
    if (handResults?.landmarks) {
      const hands2d = handResults.landmarks
      const hands3d = handResults.worldLandmarks ?? []
      const handedness = handResults.handedness ?? []

      const detectedHands = new Set<string>();

      for (let hi = 0; hi < st.handGizmos.length; hi++) {
        const gizmo = st.handGizmos[hi]
        const lm2d = hands2d[hi]
        const rawLabel = handedness[hi]?.[0]?.categoryName
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
        let normZ: number
        if (calibHandSize) {
          const depthRatio = calibHandSize / currentHandSize
          normZ = handCalibrationRef.current.referenceDepth * depthRatio
        } else {
          normZ = wrist2d.z
        }

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
        sendParam(detectedPath, [1])
      }

      ['L', 'R'].forEach(s => {
        if (!detectedHands.has(s)) {
          sendParam(`/avatar/parameters/Hand.${s}.Detected`, [0])
        }
      })
    }

    // Process face results
    if (faceResults?.faceLandmarks && faceResults.faceLandmarks.length > 0) {
      const lms = faceResults.faceLandmarks[0]
      st.faceGizmo.visible = true

      // Use 2D landmarks for position to keep the gizmo aligned to the video frame
      const nose = lms[FACE_LM.NOSE]
      const leftEye = lms[FACE_LM.LEFT_EYE_CORNER]
      const rightEye = lms[FACE_LM.RIGHT_EYE_CORNER]
      const position = vec3.fromValues(
        (nose.x + leftEye.x + rightEye.x) / 3,
        (nose.y + leftEye.y + rightEye.y) / 3,
        nose.z
      )

      let quaternion: quat
      const matrix = faceResults.facialTransformationMatrixes?.[0]

      if (matrix?.data) {
        const m = matrix.data
        // Extract rotation from column-major 4x4 matrix
        const rotMatrix = mat3.fromValues(
          m[0], m[1], m[2],
          m[4], m[5], m[6],
          m[8], m[9], m[10]
        )
        quaternion = quat.normalize(quat.create(), quat.fromMat3(quat.create(), rotMatrix))
      } else {
        // Fallback to landmark-based calculation
        const pose = poseFromFaceLandmarks(lms)
        quaternion = pose.quaternion
      }

      // Convert to screen coordinates
      const gizmoX = (MIRROR_X ? 1 - position[0] : position[0]) * WIDTH
      const gizmoY = (1 - position[1]) * HEIGHT
      const gizmoZ = -position[2] * 300

      st.faceGizmo.position.set(gizmoX, gizmoY, gizmoZ)
      st.faceGizmo.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3])

      // For OSC output, use normalized coordinates
      const normX = MIRROR_X ? 1 - position[0] : position[0]
      const normY = 1 - position[1]
      const normZ = position[2]

      const rawPos = vec3.fromValues(normX, normY, normZ)
      const rawQuat = quat.clone(quaternion)

      rawHeadPoseRef.current = { position: rawPos, quaternion: rawQuat }
      headPoseRef.current = { position: vec3.clone(rawPos), quaternion: quat.clone(rawQuat) }

      let outPos = rawPos
      let outQuat = rawQuat
      if (calibrationRef.current) {
        outPos = vec3.sub(vec3.create(), rawPos, calibrationRef.current.position)
        const calibQuatInv = quat.invert(quat.create(), calibrationRef.current.quaternion)
        outQuat = quat.multiply(quat.create(), calibQuatInv, rawQuat)
        quat.normalize(outQuat, outQuat)
      }

      sendParam('/avatar/parameters/Head.Position', [outPos[0], outPos[1], outPos[2]])
      // Swap Y and Z components for Resonite coordinate system, negate Z (roll) to fix direction
      sendParam('/avatar/parameters/Head.Rotation', [outQuat[0], -outQuat[2], outQuat[1], outQuat[3]])
      sendParam('Head.Rotation', [outQuat[0], -outQuat[2], outQuat[1], outQuat[3]])

      // Mouth and Viseme / Blendshapes calculation
      const upper = lms[FACE_LM.LIP_UPPER]
      const lower = lms[FACE_LM.LIP_LOWER]
      const mLeft = lms[FACE_LM.MOUTH_LEFT]
      const mRight = lms[FACE_LM.MOUTH_RIGHT]
      const forehead = lms[FACE_LM.FOREHEAD]
      const chin = lms[FACE_LM.CHIN]
      // leftEye and rightEye are already declared above for position calculation

      const faceHeight = Math.abs(chin.y - forehead.y)
      const mouthHeight = Math.abs(lower.y - upper.y)
      const mouthWidth = Math.abs(mRight.x - mLeft.x)
      const eyeDist = Math.abs(rightEye.x - leftEye.x)

      const nHeight = mouthHeight / faceHeight
      const nWidth = mouthWidth / eyeDist

      const mouthOpen = Math.max(0.0001, Math.min(1.0, nHeight / 0.2))
      sendParam('/avatar/parameters/MouthOpen', [mouthOpen])

      const blendshapes = faceResults.faceBlendshapes?.[0]?.categories
      const getBlendshapeValue = (name: string) => {
        if (!blendshapes) return 0
        const bs = blendshapes.find(b => b.categoryName === name)
        return bs?.score ?? 0
      }

      // Auto-calibrating blink normalization
      // Automatically tracks min (open) and max (closed) values over time
      const normalizeBlinkValue = (rawValue: number, side: 'left' | 'right') => {
        const calib = eyeCalibrationRef.current

        // Ignore extreme noise (values too close to 0)
        if (rawValue < 0.005) {
          return 0
        }

        // Update calibration with current observation
        calib.frameCount++

        if (side === 'left') {
          // Track minimum (open eyes) - update if we see a lower value
          if (rawValue < calib.openLeft) {
            calib.openLeft = rawValue
          }
          // Track maximum (closed eyes) - update if we see a higher value
          if (rawValue > calib.closedLeft) {
            calib.closedLeft = rawValue
          }

          // Slowly drift minimum upward to adapt to lighting changes (every ~10 seconds at 30fps)
          if (calib.frameCount % 300 === 0 && calib.openLeft < calib.closedLeft * 0.5) {
            calib.openLeft = calib.openLeft * 0.95 + calib.closedLeft * 0.05 * 0.3
          }
        } else {
          if (rawValue < calib.openRight) {
            calib.openRight = rawValue
          }
          if (rawValue > calib.closedRight) {
            calib.closedRight = rawValue
          }

          if (calib.frameCount % 300 === 0 && calib.openRight < calib.closedRight * 0.5) {
            calib.openRight = calib.openRight * 0.95 + calib.closedRight * 0.05 * 0.3
          }
        }

        const openVal = side === 'left' ? calib.openLeft : calib.openRight
        const closedVal = side === 'left' ? calib.closedLeft : calib.closedRight

        // Calculate range - use 75% of observed max as "fully closed" threshold
        // This makes it easier to fully close eyes without requiring extreme values
        const effectiveClosedVal = openVal + (closedVal - openVal) * 0.75
        const range = effectiveClosedVal - openVal

        // If range is too small, not enough data yet - return raw value
        if (range < 0.05) {
          return rawValue
        }

        // Normalize: 0 = open, 1 = closed
        const normalized = (rawValue - openVal) / range
        return Math.max(0, Math.min(1, normalized))
      }

      if (expressionModeRef.current === 'blendshape') {
        // Perfect Sync Mode: Send all 52 ARKit blendshapes + corresponding Unified names
        // Using /avatar/parameters/FT/v2/ prefix
        ARKIT_BLENDSHAPES.forEach(shapeName => {
          let value = getBlendshapeValue(shapeName);

          // Apply eye calibration for blink values
          if (shapeName === 'eyeBlinkLeft') {
            value = normalizeBlinkValue(value, 'left')
          } else if (shapeName === 'eyeBlinkRight') {
            value = normalizeBlinkValue(value, 'right')
          }

          // ARKit名で送信
          sendParam(`/avatar/parameters/FT/v2/${shapeName}`, [value]);
          // 対応するUnified名でも送信
          const unifiedName = ARKIT_TO_UNIFIED_MAP[shapeName];
          if (unifiedName) {
            sendParam(`/avatar/parameters/FT/v2/${unifiedName}`, [value]);
          }
        });

        // Suppress visemes in Perfect Sync mode to prevent interference
        sendParam('/avatar/parameters/aa', [0.0001])
        sendParam('/avatar/parameters/ih', [0.0001])
        sendParam('/avatar/parameters/ou', [0.0001])
        sendParam('/avatar/parameters/E', [0.0001])
        sendParam('/avatar/parameters/oh', [0.0001])

        if (blendshapes) {
          // Update blendshape debug display - remember names that exceeded threshold
          blendshapes.forEach(bs => {
            if (bs.score > 0.001) {
              detectedBlendshapeNamesRef.current.add(bs.categoryName)
            }
          })

          // Show all remembered blendshapes with current values (alphabetically sorted)
          if (shouldUpdateDebug) {
            const allDetectedBlendshapes = Array.from(detectedBlendshapeNamesRef.current)
              .map(name => {
                const bs = blendshapes.find(b => b.categoryName === name)
                return { name, value: bs?.score ?? 0 }
              })
              .sort((a, b) => a.name.localeCompare(b.name))
            setBlendshapeDebug(allDetectedBlendshapes)
          }
        }
      } else {
        // Viseme (Blendshape-based): Calculate aiueo from blendshapes
        const jawOpen = getBlendshapeValue('jawOpen')
        const mouthPucker = getBlendshapeValue('mouthPucker')
        const mouthFunnel = getBlendshapeValue('mouthFunnel')
        const mouthSmileLeft = getBlendshapeValue('mouthSmileLeft')
        const mouthSmileRight = getBlendshapeValue('mouthSmileRight')
        const mouthStretchLeft = getBlendshapeValue('mouthStretchLeft')
        const mouthStretchRight = getBlendshapeValue('mouthStretchRight')
        const mouthLowerDown = getBlendshapeValue('mouthLowerDownLeft') + getBlendshapeValue('mouthLowerDownRight')
        const mouthUpperUp = getBlendshapeValue('mouthUpperUpLeft') + getBlendshapeValue('mouthUpperUpRight')

        // Calculate aiueo from blendshapes
        // mouthOpenness: Use normalized mouth height (actual lip separation) as the gate.
        // This prevents activation when the jaw moves while the lips are still closed.
        const mouthOpenGate = Math.min(1.0, nHeight / 0.04)

        // aa (あ): primarily jaw open
        let v_aa = Math.max(0, jawOpen * 1.5 - 0.1) * mouthOpenGate

        // ih (い): wide smile/stretch
        const smileAmount = (mouthSmileLeft + mouthSmileRight) * 0.5 + (mouthStretchLeft + mouthStretchRight) * 0.5
        let v_ih = Math.max(0, smileAmount * 1.3 - 0.1) * mouthOpenGate

        // ou (う): pucker/funnel
        const puckerAmount = mouthPucker * 0.7 + mouthFunnel * 0.3
        let v_ou = Math.max(0, puckerAmount * 1.0 - 0.3) * mouthOpenGate
        // E (え): mouth open with horizontal stretch (between あ and い)
        const lipOpen = (mouthLowerDown + mouthUpperUp) * 0.5
        const eStretch = (mouthStretchLeft + mouthStretchRight) * 0.5
        const eSmile = (mouthSmileLeft + mouthSmileRight) * 0.3
        let v_E = Math.min(1.0, Math.max(0, lipOpen + eStretch + eSmile + jawOpen * 0.6) * 1.5) * mouthOpenGate

        // oh (お): jaw open + moderate pucker
        let v_oh = Math.max(0, (jawOpen * 0.8 + mouthPucker * 0.4) - 0.25) * 1.0 * mouthOpenGate

        // Softmax-style normalization: sum to 1.0, emphasize the dominant viseme
        const rawValues = [v_aa, v_ih, v_ou, v_E, v_oh]
        const sum = rawValues.reduce((a, b) => a + b, 0)

        if (sum > 1.5) {
          // Normalize only when sum exceeds 1.5
          const scale = 1.5 / sum
          v_aa *= scale
          v_ih *= scale
          v_ou *= scale
          v_E *= scale
          v_oh *= scale
        } else if (sum <= 0.01) {
          // Mouth is closed - explicitly set all to 0.0001
          v_aa = 0.0001
          v_ih = 0.0001
          v_ou = 0.0001
          v_E = 0.0001
          v_oh = 0.0001
        }

        // Clamp and validate - use 0.0001 as minimum to ensure receiver updates
        v_aa = isNaN(v_aa) ? 0.0001 : Math.max(0.0001, Math.min(1.0, v_aa))
        v_ih = isNaN(v_ih) ? 0.0001 : Math.max(0.0001, Math.min(1.0, v_ih))
        v_ou = isNaN(v_ou) ? 0.0001 : Math.max(0.0001, Math.min(1.0, v_ou))
        v_E = isNaN(v_E) ? 0.0001 : Math.max(0.0001, Math.min(1.0, v_E))
        v_oh = isNaN(v_oh) ? 0.0001 : Math.max(0.0001, Math.min(1.0, v_oh))
        sendParam('/avatar/parameters/aa', [v_aa])
        sendParam('/avatar/parameters/ih', [v_ih])
        sendParam('/avatar/parameters/ou', [v_ou])
        sendParam('/avatar/parameters/E', [v_E])
        sendParam('/avatar/parameters/oh', [v_oh])

        // Also send blendshapes for additional expression detail
        // EyeClosed uses ARKit path for compatibility with FaceTrack setup
        const eyeBlinkLeft = normalizeBlinkValue(getBlendshapeValue('eyeBlinkLeft'), 'left')
        const eyeBlinkRight = normalizeBlinkValue(getBlendshapeValue('eyeBlinkRight'), 'right')
        sendParam('/avatar/parameters/FT/v2/EyeClosedLeft', [eyeBlinkLeft])
        sendParam('/avatar/parameters/FT/v2/EyeClosedRight', [eyeBlinkRight])
        // Legacy paths for backward compatibility
        sendParam('/avatar/parameters/Blendshapes/EyeBlinkLeft', [eyeBlinkLeft])
        sendParam('/avatar/parameters/Blendshapes/EyeBlinkRight', [eyeBlinkRight])
        sendParam('/avatar/parameters/Blendshapes/BrowInnerUp', [getBlendshapeValue('browInnerUp')])
        sendParam('/avatar/parameters/Blendshapes/CheekPuff', [getBlendshapeValue('cheekPuff')])

        if (shouldUpdateDebug) {
          setMouthDebug({
            nHeight,
            nWidth,
            aa: v_aa,
            ih: v_ih,
            ou: v_ou,
            E: v_E,
            oh: v_oh
          })
        }
      }
      sendParam('/avatar/parameters/Head.Detected', [1])
    } else {
      st.faceGizmo.visible = false
      sendParam('/avatar/parameters/Head.Detected', [0])
      sendParam('/avatar/parameters/MouthOpen', [0.0001])
      sendParam('/avatar/parameters/aa', [0.0001])
      sendParam('/avatar/parameters/ih', [0.0001])
      sendParam('/avatar/parameters/ou', [0.0001])
      sendParam('/avatar/parameters/E', [0.0001])
      sendParam('/avatar/parameters/oh', [0.0001])
      // Reset blendshape parameters when tracking is lost
      sendParam('/avatar/parameters/Blendshapes/JawOpen', [0.0001])
      sendParam('/avatar/parameters/Blendshapes/MouthOpen', [0.0001])
      sendParam('/avatar/parameters/Blendshapes/MouthPucker', [0.0001])
      sendParam('/avatar/parameters/Blendshapes/MouthSmile', [0.0001])
      sendParam('/avatar/parameters/Blendshapes/EyeBlinkLeft', [0.0001])
      sendParam('/avatar/parameters/Blendshapes/EyeBlinkRight', [0.0001])
      sendParam('/avatar/parameters/Blendshapes/BrowInnerUp', [0.0001])
      sendParam('/avatar/parameters/Blendshapes/CheekPuff', [0.0001])
    }
  }, [threeStateRef, videoElement, sendParam])

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
    processResults,
    selectedDeviceId,
    setIsLoading,
    { outputBlendshapes: true }
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

      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 100
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '10px'
            }}>
              Loading MediaPipe Models...
            </div>
            <div style={{
              fontSize: '14px',
              color: '#888'
            }}>
              Downloading face_landmarker and hand_landmarker models (~9MB)
            </div>
          </div>
        </div>
      )}

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
        blendshapeDebug={blendshapeDebug}
        expressionMode={expressionMode}
        onSetMode={handleSetMode}
      />
    </div>
  )
}

export default App

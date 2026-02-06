import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { type FaceLandmarkerResult, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { mat3, quat, vec3 } from 'gl-matrix';
import type * as THREE from 'three';
import { drawCanvas } from '../utils/drawCanvas';
import { FACE_LM, HAND_LM, HEIGHT, MIRROR_X, WIDTH } from '../constants';
import { poseFromFaceLandmarks, poseFromHandLandmarks } from '../utils/trackingUtils';
import { useBlinkNormalization } from './useBlinkNormalization';
import { calculateVisemes } from '../utils/visemeCalculation';
import {
  buildBlendshapeDebug,
  getBlendshapeValue,
  rememberDetectedBlendshapes,
  sendPerfectSyncBlendshapes,
  type BlendshapeCategory
} from '../utils/blendshapeProcessing';
import type { AppLogLevel, ExpressionMode, EyeCalibration, HandCalibration } from '../types/tracking';
import type { TrackingPose } from './useCalibration';

interface ThreeState {
  handGizmos: THREE.Object3D[];
  faceGizmo: THREE.Object3D;
}

export interface MouthDebugState {
  nHeight: number;
  nWidth: number;
  aa: number;
  ih: number;
  ou: number;
  E: number;
  oh: number;
}

interface UseTrackingOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  threeStateRef: MutableRefObject<ThreeState | null>;
  videoElement: HTMLVideoElement | null;
  isWindowVisible: boolean;
  expressionMode: ExpressionMode;
  blinkSyncEnabled: boolean;
  autoCalibrate: boolean;
  headPoseRef: MutableRefObject<TrackingPose | null>;
  rawHeadPoseRef: MutableRefObject<TrackingPose | null>;
  calibrationRef: MutableRefObject<TrackingPose | null>;
  handCalibrationRef: MutableRefObject<HandCalibration>;
  eyeCalibrationRef: MutableRefObject<EyeCalibration>;
  updateAutoCalibration: (rawPos: vec3, rawQuat: quat, enabled: boolean) => void;
  log: (level: AppLogLevel, ...args: unknown[]) => void;
}

const formatVec = (values: number[]) => `[${values.map((value) => value.toFixed(4)).join(';')}]`;

const calculateHandSize = (landmarks: { x: number; y: number; z: number }[]) => {
  const wrist = landmarks[HAND_LM.WRIST];
  const middleTip = landmarks[HAND_LM.MIDDLE_TIP];
  const dx = middleTip.x - wrist.x;
  const dy = middleTip.y - wrist.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const getMirroredLabel = (rawLabel: string | undefined) => {
  if (!MIRROR_X) {
    return rawLabel;
  }
  if (rawLabel === 'Left') {
    return 'Right';
  }
  if (rawLabel === 'Right') {
    return 'Left';
  }
  return rawLabel;
};

export function useTracking(options: UseTrackingOptions) {
  const {
    canvasRef,
    threeStateRef,
    videoElement,
    isWindowVisible,
    expressionMode,
    blinkSyncEnabled,
    autoCalibrate,
    headPoseRef,
    rawHeadPoseRef,
    calibrationRef,
    handCalibrationRef,
    eyeCalibrationRef,
    updateAutoCalibration,
    log
  } = options;

  const [mouthDebug, setMouthDebug] = useState<MouthDebugState | null>(null);
  const [blendshapeDebug, setBlendshapeDebug] = useState<{ name: string; value: number }[] | null>(null);

  const handResultsRef = useRef<HandLandmarkerResult | null>(null);
  const faceResultsRef = useRef<FaceLandmarkerResult | null>(null);
  const firstTrackingFrameRef = useRef(false);
  const debugUpdateCounterRef = useRef(0);
  const detectedBlendshapeNamesRef = useRef<Set<string>>(new Set());
  const expressionModeRef = useRef<ExpressionMode>(expressionMode);
  const blinkSyncEnabledRef = useRef(blinkSyncEnabled);

  const normalizeBlinkValue = useBlinkNormalization(eyeCalibrationRef);

  useEffect(() => {
    expressionModeRef.current = expressionMode;
  }, [expressionMode]);

  useEffect(() => {
    blinkSyncEnabledRef.current = blinkSyncEnabled;
  }, [blinkSyncEnabled]);

  const sendParam = useCallback((path: string, values: number[]) => {
    if (!window.electronAPI) {
      return;
    }

    let value: number | string;
    if (path.includes('Rotation') || path.includes('Position')) {
      value = formatVec(values);
    } else {
      value = values.length === 1 ? values[0] : formatVec(values);
    }

    window.electronAPI.oscSend(path, value);
  }, []);

  const processResults = useCallback((faceResults: FaceLandmarkerResult | null, handResults: HandLandmarkerResult | null) => {
    faceResultsRef.current = faceResults;
    handResultsRef.current = handResults;

    if (!firstTrackingFrameRef.current && (faceResults?.faceLandmarks?.length || handResults?.landmarks?.length)) {
      firstTrackingFrameRef.current = true;
      log('info', 'Tracking started - first frame processed successfully');
      if (faceResults?.faceLandmarks?.length) {
        log('info', '  ✓ Face detected');
      }
      if (handResults?.landmarks?.length) {
        log('info', `  ✓ ${handResults.landmarks.length} hand(s) detected`);
      }
      if (window.electronAPI?.notifyTrackingStarted) {
        window.electronAPI.notifyTrackingStarted();
      }
    }

    debugUpdateCounterRef.current = (debugUpdateCounterRef.current + 1) % 5;
    const shouldUpdateDebug = debugUpdateCounterRef.current === 0;

    if (isWindowVisible) {
      const canvasCtx = canvasRef.current?.getContext('2d');
      if (canvasCtx) {
        if (videoElement && videoElement.readyState >= 2) {
          drawCanvas(canvasCtx, handResults || undefined, faceResults || undefined, videoElement);
        } else {
          canvasCtx.fillStyle = '#16161a';
          canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
          canvasCtx.fillStyle = '#666';
          canvasCtx.font = '20px sans-serif';
          canvasCtx.textAlign = 'center';
          canvasCtx.fillText('Waiting for camera...', WIDTH / 2, HEIGHT / 2);
        }
      }
    }

    const state = threeStateRef.current;
    if (!state) {
      return;
    }

    if (handResults?.landmarks) {
      const hands2d = handResults.landmarks;
      const hands3d = handResults.worldLandmarks ?? [];
      const handedness = handResults.handedness ?? [];
      const detectedHands = new Set<string>();

      for (let handIndex = 0; handIndex < state.handGizmos.length; handIndex += 1) {
        const gizmo = state.handGizmos[handIndex];
        const landmarks2d = hands2d[handIndex];
        const rawLabel = handedness[handIndex]?.[0]?.categoryName;
        const label = getMirroredLabel(rawLabel);
        const suffix = label === 'Left' ? 'L' : label === 'Right' ? 'R' : (handIndex === 0 ? 'L' : 'R');

        if (!landmarks2d || landmarks2d.length === 0 || !landmarks2d[0]) {
          gizmo.visible = false;
          continue;
        }

        gizmo.visible = true;
        detectedHands.add(suffix);

        const wrist2d = landmarks2d[0];
        const x = (MIRROR_X ? 1 - wrist2d.x : wrist2d.x) * WIDTH;
        const y = (1 - wrist2d.y) * HEIGHT;

        const currentHandSize = calculateHandSize(landmarks2d);
        const calibrationHandSize = label === 'Left'
          ? handCalibrationRef.current.leftHandSize
          : handCalibrationRef.current.rightHandSize;

        let z: number;
        if (calibrationHandSize) {
          const depthRatio = calibrationHandSize / currentHandSize;
          z = -(handCalibrationRef.current.referenceDepth * depthRatio) * 300;
        } else {
          z = -wrist2d.z * 300;
        }

        if (isWindowVisible) {
          gizmo.position.set(x, y, z);
        }

        const landmarksForRotation = hands3d[handIndex]?.map((point) => ({ x: point.x, y: point.y, z: point.z }))
          ?? landmarks2d.map((point) => ({ x: point.x, y: point.y, z: point.z }));
        const rotationLabel = label ?? (handIndex === 0 ? 'Left' : 'Right');
        const { quaternion: handQuat } = poseFromHandLandmarks(landmarksForRotation, rotationLabel);

        if (isWindowVisible) {
          gizmo.quaternion.set(handQuat[0], handQuat[1], handQuat[2], handQuat[3]);
        }

        const positionPath = `/avatar/parameters/Hand.${suffix}.Position`;
        const rotationPath = `/avatar/parameters/Hand.${suffix}.Rotation`;
        const detectedPath = `/avatar/parameters/Hand.${suffix}.Detected`;

        const normX = MIRROR_X ? 1 - wrist2d.x : wrist2d.x;
        const normY = 1 - wrist2d.y;
        let normZ: number;
        if (calibrationHandSize) {
          const depthRatio = calibrationHandSize / currentHandSize;
          normZ = handCalibrationRef.current.referenceDepth * depthRatio;
        } else {
          normZ = wrist2d.z;
        }

        const currentHeadPose = headPoseRef.current;
        if (currentHeadPose) {
          sendParam(positionPath, [
            normX - currentHeadPose.position[0],
            normY - currentHeadPose.position[1],
            normZ - currentHeadPose.position[2]
          ]);
        } else {
          sendParam(positionPath, [normX, normY, normZ]);
        }

        sendParam(rotationPath, [handQuat[0], handQuat[1], handQuat[2], handQuat[3]]);
        sendParam(detectedPath, [1]);
      }

      ['L', 'R'].forEach((suffix) => {
        if (!detectedHands.has(suffix)) {
          sendParam(`/avatar/parameters/Hand.${suffix}.Detected`, [0]);
        }
      });
    }

    if (faceResults?.faceLandmarks && faceResults.faceLandmarks.length > 0) {
      const landmarks = faceResults.faceLandmarks[0];
      state.faceGizmo.visible = true;

      const nose = landmarks[FACE_LM.NOSE];
      const leftEye = landmarks[FACE_LM.LEFT_EYE_CORNER];
      const rightEye = landmarks[FACE_LM.RIGHT_EYE_CORNER];

      const position = vec3.fromValues(
        (nose.x + leftEye.x + rightEye.x) / 3,
        (nose.y + leftEye.y + rightEye.y) / 3,
        nose.z
      );

      let faceQuat: quat;
      const matrix = faceResults.facialTransformationMatrixes?.[0];

      if (matrix?.data) {
        const m = matrix.data;
        const rotMatrix = mat3.fromValues(
          m[0], m[1], m[2],
          m[4], m[5], m[6],
          m[8], m[9], m[10]
        );
        faceQuat = quat.normalize(quat.create(), quat.fromMat3(quat.create(), rotMatrix));
      } else {
        const fallbackPose = poseFromFaceLandmarks(landmarks);
        faceQuat = fallbackPose.quaternion;
      }

      const gizmoX = (MIRROR_X ? 1 - position[0] : position[0]) * WIDTH;
      const gizmoY = (1 - position[1]) * HEIGHT;
      const gizmoZ = -position[2] * 300;

      if (isWindowVisible) {
        state.faceGizmo.position.set(gizmoX, gizmoY, gizmoZ);
        state.faceGizmo.quaternion.set(faceQuat[0], faceQuat[1], faceQuat[2], faceQuat[3]);
      }

      const normX = MIRROR_X ? 1 - position[0] : position[0];
      const normY = 1 - position[1];
      const normZ = position[2];

      const rawPos = vec3.fromValues(normX, normY, normZ);
      const rawQuat = quat.clone(faceQuat);

      rawHeadPoseRef.current = { position: rawPos, quaternion: rawQuat };
      headPoseRef.current = { position: vec3.clone(rawPos), quaternion: quat.clone(rawQuat) };

      updateAutoCalibration(rawPos, rawQuat, autoCalibrate);

      let outPos = rawPos;
      let outQuat = rawQuat;
      if (calibrationRef.current) {
        outPos = vec3.sub(vec3.create(), rawPos, calibrationRef.current.position);
        const calibrationInverse = quat.invert(quat.create(), calibrationRef.current.quaternion);
        outQuat = quat.multiply(quat.create(), calibrationInverse, rawQuat);
        quat.normalize(outQuat, outQuat);
      }

      sendParam('/avatar/parameters/Head.Position', [outPos[0], outPos[1], outPos[2]]);
      sendParam('/avatar/parameters/Head.Rotation', [outQuat[0], -outQuat[2], outQuat[1], outQuat[3]]);
      sendParam('Head.Rotation', [outQuat[0], -outQuat[2], outQuat[1], outQuat[3]]);

      const upper = landmarks[FACE_LM.LIP_UPPER];
      const lower = landmarks[FACE_LM.LIP_LOWER];
      const mouthLeft = landmarks[FACE_LM.MOUTH_LEFT];
      const mouthRight = landmarks[FACE_LM.MOUTH_RIGHT];
      const forehead = landmarks[FACE_LM.FOREHEAD];
      const chin = landmarks[FACE_LM.CHIN];

      const faceHeight = Math.abs(chin.y - forehead.y);
      const mouthHeight = Math.abs(lower.y - upper.y);
      const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
      const eyeDist = Math.abs(rightEye.x - leftEye.x);

      const nHeight = mouthHeight / faceHeight;
      const nWidth = mouthWidth / eyeDist;

      const mouthOpen = Math.max(0.0001, Math.min(1.0, nHeight / 0.2));
      sendParam('/avatar/parameters/MouthOpen', [mouthOpen]);

      const blendshapes = faceResults.faceBlendshapes?.[0]?.categories?.map((shape) => ({
        categoryName: shape.categoryName,
        score: shape.score
      } satisfies BlendshapeCategory));

      const rawBlinkLeft = getBlendshapeValue(blendshapes, 'eyeBlinkLeft');
      const rawBlinkRight = getBlendshapeValue(blendshapes, 'eyeBlinkRight');

      let eyeBlinkLeft = normalizeBlinkValue(rawBlinkLeft, 'left');
      let eyeBlinkRight = normalizeBlinkValue(rawBlinkRight, 'right');

      if (blinkSyncEnabledRef.current) {
        const synced = (eyeBlinkLeft + eyeBlinkRight) * 0.5;
        eyeBlinkLeft = synced;
        eyeBlinkRight = synced;
      }

      if (expressionModeRef.current === 'blendshape') {
        // Perfect Sync Mode: Calculate aiueo from blendshapes and send to legacy paths
        // ここはまだ実装途中 by tatsuさん なので、今は一旦コメントアウトしてるだけなので指示があるまでは勝手に消さないで
        sendPerfectSyncBlendshapes(blendshapes, eyeBlinkLeft, eyeBlinkRight, sendParam);

        sendParam('/avatar/parameters/aa', [0.0001]);
        sendParam('/avatar/parameters/ih', [0.0001]);
        sendParam('/avatar/parameters/ou', [0.0001]);
        sendParam('/avatar/parameters/E', [0.0001]);
        sendParam('/avatar/parameters/oh', [0.0001]);

        if (blendshapes) {
          rememberDetectedBlendshapes(blendshapes, detectedBlendshapeNamesRef.current);

          if (isWindowVisible && shouldUpdateDebug) {
            setBlendshapeDebug(buildBlendshapeDebug(detectedBlendshapeNamesRef.current, blendshapes));
          }
        }
      } else {
        const visemes = calculateVisemes({
          nHeight,
          jawOpen: getBlendshapeValue(blendshapes, 'jawOpen'),
          mouthPucker: getBlendshapeValue(blendshapes, 'mouthPucker'),
          mouthFunnel: getBlendshapeValue(blendshapes, 'mouthFunnel'),
          mouthSmileLeft: getBlendshapeValue(blendshapes, 'mouthSmileLeft'),
          mouthSmileRight: getBlendshapeValue(blendshapes, 'mouthSmileRight'),
          mouthStretchLeft: getBlendshapeValue(blendshapes, 'mouthStretchLeft'),
          mouthStretchRight: getBlendshapeValue(blendshapes, 'mouthStretchRight'),
          mouthLowerDown: getBlendshapeValue(blendshapes, 'mouthLowerDownLeft') + getBlendshapeValue(blendshapes, 'mouthLowerDownRight'),
          mouthUpperUp: getBlendshapeValue(blendshapes, 'mouthUpperUpLeft') + getBlendshapeValue(blendshapes, 'mouthUpperUpRight')
        });

        sendParam('/avatar/parameters/aa', [visemes.aa]);
        sendParam('/avatar/parameters/ih', [visemes.ih]);
        sendParam('/avatar/parameters/ou', [visemes.ou]);
        sendParam('/avatar/parameters/E', [visemes.E]);
        sendParam('/avatar/parameters/oh', [visemes.oh]);

        sendParam('/avatar/parameters/FT/v2/EyeClosedLeft', [eyeBlinkLeft]);
        sendParam('/avatar/parameters/FT/v2/EyeClosedRight', [eyeBlinkRight]);
        sendParam('/avatar/parameters/Blendshapes/EyeBlinkLeft', [eyeBlinkLeft]);
        sendParam('/avatar/parameters/Blendshapes/EyeBlinkRight', [eyeBlinkRight]);
        sendParam('/avatar/parameters/Blendshapes/BrowInnerUp', [getBlendshapeValue(blendshapes, 'browInnerUp')]);
        sendParam('/avatar/parameters/Blendshapes/CheekPuff', [getBlendshapeValue(blendshapes, 'cheekPuff')]);

        if (isWindowVisible && shouldUpdateDebug) {
          setMouthDebug({
            nHeight,
            nWidth,
            aa: visemes.aa,
            ih: visemes.ih,
            ou: visemes.ou,
            E: visemes.E,
            oh: visemes.oh
          });
        }
      }

      sendParam('/avatar/parameters/Head.Detected', [1]);
    } else {
      state.faceGizmo.visible = false;
      sendParam('/avatar/parameters/Head.Detected', [0]);
      sendParam('/avatar/parameters/MouthOpen', [0.0001]);
      sendParam('/avatar/parameters/aa', [0.0001]);
      sendParam('/avatar/parameters/ih', [0.0001]);
      sendParam('/avatar/parameters/ou', [0.0001]);
      sendParam('/avatar/parameters/E', [0.0001]);
      sendParam('/avatar/parameters/oh', [0.0001]);
      sendParam('/avatar/parameters/Blendshapes/JawOpen', [0.0001]);
      sendParam('/avatar/parameters/Blendshapes/MouthOpen', [0.0001]);
      sendParam('/avatar/parameters/Blendshapes/MouthPucker', [0.0001]);
      sendParam('/avatar/parameters/Blendshapes/MouthSmile', [0.0001]);
      sendParam('/avatar/parameters/Blendshapes/EyeBlinkLeft', [0.0001]);
      sendParam('/avatar/parameters/Blendshapes/EyeBlinkRight', [0.0001]);
      sendParam('/avatar/parameters/Blendshapes/BrowInnerUp', [0.0001]);
      sendParam('/avatar/parameters/Blendshapes/CheekPuff', [0.0001]);
    }
  }, [
    autoCalibrate,
    calibrationRef,
    canvasRef,
    handCalibrationRef,
    headPoseRef,
    isWindowVisible,
    log,
    normalizeBlinkValue,
    rawHeadPoseRef,
    sendParam,
    threeStateRef,
    updateAutoCalibration,
    videoElement
  ]);

  return {
    processResults,
    handResultsRef,
    mouthDebug,
    blendshapeDebug
  };
}

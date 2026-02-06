import { useCallback, useEffect, useRef, useState } from 'react';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { quat, vec3 } from 'gl-matrix';
import { HAND_LM, MIRROR_X } from '../constants';
import { createDefaultEyeCalibration, type EyeCalibration, type HandCalibration } from '../types/tracking';

export interface TrackingPose {
  position: vec3;
  quaternion: quat;
}

const DEFAULT_HEAD_CALIBRATION = {
  position: [0.4859048128128052, 0.48299509286880493, -0.04700769856572151] as [number, number, number],
  quaternion: [-0.03367241099476814, -0.016153844073414803, 0.006220859009772539, 0.9992830157279968] as [number, number, number, number]
};

const DEFAULT_HAND_CALIBRATION = {
  leftHandSize: 0.40479355842178694,
  rightHandSize: 0.4208306103774612,
  referenceDepth: 0.5
};

const AUTO_CALIBRATE_THRESHOLD_MS = 5000;
const TRANSITION_DURATION_MS = 5000;
const POSITION_THRESHOLD = 0.01;
const ROTATION_THRESHOLD = 0.02;

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

export function useCalibration() {
  const [handCalibCountdown, setHandCalibCountdown] = useState<number | null>(null);

  const headPoseRef = useRef<TrackingPose | null>(null);
  const rawHeadPoseRef = useRef<TrackingPose | null>(null);
  const calibrationRef = useRef<TrackingPose | null>(null);
  const handCalibrationRef = useRef<HandCalibration>({
    leftHandSize: null,
    rightHandSize: null,
    referenceDepth: 0.5
  });
  const eyeCalibrationRef = useRef<EyeCalibration>(createDefaultEyeCalibration());

  const lastHeadPoseRef = useRef<TrackingPose | null>(null);
  const stillTimeRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const isTransitioningRef = useRef(false);
  const targetCalibrationRef = useRef<TrackingPose | null>(null);
  const transitionStartRef = useRef<TrackingPose | null>(null);
  const transitionProgressRef = useRef(0);

  useEffect(() => {
    const savedHeadCalib = localStorage.getItem('headCalibration');
    if (savedHeadCalib) {
      try {
        const parsed = JSON.parse(savedHeadCalib);
        calibrationRef.current = {
          position: vec3.fromValues(parsed.position[0], parsed.position[1], parsed.position[2]),
          quaternion: quat.fromValues(parsed.quaternion[0], parsed.quaternion[1], parsed.quaternion[2], parsed.quaternion[3])
        };
      } catch (error) {
        console.error('Failed to load head calibration:', error);
      }
    } else {
      calibrationRef.current = {
        position: vec3.fromValues(
          DEFAULT_HEAD_CALIBRATION.position[0],
          DEFAULT_HEAD_CALIBRATION.position[1],
          DEFAULT_HEAD_CALIBRATION.position[2]
        ),
        quaternion: quat.fromValues(
          DEFAULT_HEAD_CALIBRATION.quaternion[0],
          DEFAULT_HEAD_CALIBRATION.quaternion[1],
          DEFAULT_HEAD_CALIBRATION.quaternion[2],
          DEFAULT_HEAD_CALIBRATION.quaternion[3]
        )
      };
    }

    const savedHandCalib = localStorage.getItem('handCalibration');
    if (savedHandCalib) {
      try {
        const parsed = JSON.parse(savedHandCalib);
        handCalibrationRef.current = parsed;
      } catch (error) {
        console.error('Failed to load hand calibration:', error);
      }
    } else {
      handCalibrationRef.current = {
        leftHandSize: DEFAULT_HAND_CALIBRATION.leftHandSize,
        rightHandSize: DEFAULT_HAND_CALIBRATION.rightHandSize,
        referenceDepth: DEFAULT_HAND_CALIBRATION.referenceDepth
      };
    }
  }, []);

  const handleCalibrate = useCallback(() => {
    if (!rawHeadPoseRef.current) {
      return;
    }

    calibrationRef.current = {
      position: vec3.clone(rawHeadPoseRef.current.position),
      quaternion: quat.clone(rawHeadPoseRef.current.quaternion)
    };

    localStorage.setItem('headCalibration', JSON.stringify({
      position: Array.from(calibrationRef.current.position),
      quaternion: Array.from(calibrationRef.current.quaternion)
    }));
  }, []);

  const handleHandCalibrate = useCallback((getCurrentResults: () => HandLandmarkerResult | null) => {
    setHandCalibCountdown(3);

    const intervalId = window.setInterval(() => {
      setHandCalibCountdown((prev) => {
        if (prev === null || prev <= 1) {
          window.clearInterval(intervalId);

          const results = getCurrentResults();
          if (results?.landmarks && results.handedness) {
            for (let index = 0; index < results.landmarks.length; index += 1) {
              const landmarks = results.landmarks[index];
              const rawLabel = results.handedness[index]?.[0]?.categoryName;
              const label = getMirroredLabel(rawLabel);
              const handSize = calculateHandSize(landmarks);

              if (label === 'Left') {
                handCalibrationRef.current.leftHandSize = handSize;
              } else if (label === 'Right') {
                handCalibrationRef.current.rightHandSize = handSize;
              }
            }

            localStorage.setItem('handCalibration', JSON.stringify(handCalibrationRef.current));
          }

          return null;
        }

        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleResetCalibration = useCallback(() => {
    calibrationRef.current = null;
    handCalibrationRef.current = {
      leftHandSize: null,
      rightHandSize: null,
      referenceDepth: 0.5
    };
    localStorage.removeItem('headCalibration');
    localStorage.removeItem('handCalibration');
  }, []);

  const updateAutoCalibration = useCallback((rawPos: vec3, rawQuat: quat, enabled: boolean) => {
    if (!enabled) {
      return;
    }

    const now = Date.now();
    const deltaTime = now - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = now;

    if (lastHeadPoseRef.current) {
      const posChange = vec3.distance(rawPos, lastHeadPoseRef.current.position);
      const quatChange = Math.abs(1 - Math.abs(quat.dot(rawQuat, lastHeadPoseRef.current.quaternion)));

      if (isTransitioningRef.current && (posChange >= POSITION_THRESHOLD || quatChange >= ROTATION_THRESHOLD)) {
        isTransitioningRef.current = false;
        targetCalibrationRef.current = null;
        transitionStartRef.current = null;
        transitionProgressRef.current = 0;
        stillTimeRef.current = 0;
      }

      if (isTransitioningRef.current && targetCalibrationRef.current && transitionStartRef.current) {
        transitionProgressRef.current += deltaTime / TRANSITION_DURATION_MS;

        if (transitionProgressRef.current >= 1.0) {
          calibrationRef.current = {
            position: vec3.clone(targetCalibrationRef.current.position),
            quaternion: quat.clone(targetCalibrationRef.current.quaternion)
          };

          localStorage.setItem('headCalibration', JSON.stringify({
            position: Array.from(calibrationRef.current.position),
            quaternion: Array.from(calibrationRef.current.quaternion)
          }));

          isTransitioningRef.current = false;
          targetCalibrationRef.current = null;
          transitionStartRef.current = null;
          transitionProgressRef.current = 0;
        } else {
          const t = Math.min(1.0, transitionProgressRef.current);
          const smoothT = t * t * (3 - 2 * t);

          calibrationRef.current = {
            position: vec3.lerp(
              vec3.create(),
              transitionStartRef.current.position,
              targetCalibrationRef.current.position,
              smoothT
            ),
            quaternion: quat.slerp(
              quat.create(),
              transitionStartRef.current.quaternion,
              targetCalibrationRef.current.quaternion,
              smoothT
            )
          };
        }
      }

      if (!isTransitioningRef.current) {
        if (posChange < POSITION_THRESHOLD && quatChange < ROTATION_THRESHOLD) {
          stillTimeRef.current += deltaTime;
          if (stillTimeRef.current >= AUTO_CALIBRATE_THRESHOLD_MS) {
            isTransitioningRef.current = true;
            targetCalibrationRef.current = {
              position: vec3.clone(rawPos),
              quaternion: quat.clone(rawQuat)
            };
            transitionStartRef.current = calibrationRef.current
              ? {
                position: vec3.clone(calibrationRef.current.position),
                quaternion: quat.clone(calibrationRef.current.quaternion)
              }
              : {
                position: vec3.clone(rawPos),
                quaternion: quat.create()
              };
            transitionProgressRef.current = 0;
            stillTimeRef.current = 0;
          }
        } else {
          stillTimeRef.current = 0;
        }
      }
    }

    lastHeadPoseRef.current = {
      position: vec3.clone(rawPos),
      quaternion: quat.clone(rawQuat)
    };
  }, []);

  return {
    handCalibCountdown,
    headPoseRef,
    rawHeadPoseRef,
    calibrationRef,
    handCalibrationRef,
    eyeCalibrationRef,
    handleCalibrate,
    handleHandCalibrate,
    handleResetCalibration,
    updateAutoCalibration
  };
}

import { useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  FaceLandmarker,
  HandLandmarker,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

// Helper function to log to both console and Electron main process
function mpLog(level: 'log' | 'info' | 'warn' | 'error', ...args: any[]) {
  console[level](...args);
  if (typeof window !== 'undefined' && (window as any).electronAPI?.log) {
    (window as any).electronAPI.log(level, ...args);
  }
}

export function useMediaPipe(
  videoElement: HTMLVideoElement | null,
  onResults: (faceResult: FaceLandmarkerResult | null, handResult: HandLandmarkerResult | null) => void,
  deviceId: string,
  onLoadingChange?: (isLoading: boolean) => void,
  options?: { outputBlendshapes?: boolean }
) {
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs for callbacks to avoid re-initializing MediaPipe when callbacks change
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;
  const onLoadingChangeRef = useRef(onLoadingChange);
  onLoadingChangeRef.current = onLoadingChange;

  useEffect(() => {
    if (!deviceId || !videoElement) {
      return;
    }

    let isRunning = true;
    let rafId: number;

    const init = async () => {
      try {
        mpLog('info', 'Initializing MediaPipe...');
        onLoadingChangeRef.current?.(true);

        // Use unpkg instead of jsDelivr for better WASM file availability
        const wasmPath = 'https://unpkg.com/@mediapipe/tasks-vision@0.10.32/wasm';
        mpLog('info', 'Loading WASM files...');

        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        mpLog('info', '✓ WASM files loaded successfully');

        mpLog('info', 'Downloading MediaPipe models (face_landmarker + hand_landmarker)...');
        const [faceLandmarker, handLandmarker] = await Promise.all([
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: options?.outputBlendshapes ?? true,
            outputFacialTransformationMatrixes: true,
          }),
          HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
          }),
        ]);
        mpLog('info', '✓ MediaPipe models loaded successfully');

        if (!isRunning) {
          faceLandmarker.close();
          handLandmarker.close();
          return;
        }

        faceLandmarkerRef.current = faceLandmarker;
        handLandmarkerRef.current = handLandmarker;
        setIsInitialized(true);
        setError(null);
        onLoadingChangeRef.current?.(false);
        mpLog('info', '✓ MediaPipe initialization complete - ready for tracking');

        const processFrame = () => {
          if (!isRunning) return;
          if (videoElement.readyState >= 2) {
            const now = performance.now();
            const faceResult = faceLandmarker.detectForVideo(videoElement, now);
            const handResult = handLandmarker.detectForVideo(videoElement, now);
            onResultsRef.current(faceResult, handResult);
          } else {
            // Still call onResults with null so canvas can show waiting message
            onResultsRef.current(null, null);
          }
          rafId = requestAnimationFrame(processFrame);
        };
        processFrame();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        mpLog('error', 'MediaPipe initialization failed:', errorMessage);
        if (err instanceof Error && err.stack) {
          mpLog('error', 'Stack trace:', err.stack);
        }
        setError(errorMessage);
        onLoadingChangeRef.current?.(false);
      }
    };

    init();

    return () => {
      mpLog('info', 'Stopping MediaPipe tracking');
      isRunning = false;
      cancelAnimationFrame(rafId);
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
      setIsInitialized(false);
    };
  // onResults and onLoadingChange are accessed via refs to avoid re-initialization
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoElement, deviceId, options?.outputBlendshapes]);

  return { isInitialized, error };
}

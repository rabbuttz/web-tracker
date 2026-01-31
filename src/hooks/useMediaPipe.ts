import { useEffect, useRef, useState } from 'react';
import {
  FilesetResolver,
  FaceLandmarker,
  HandLandmarker,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

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

  useEffect(() => {
    console.log('useMediaPipe effect triggered, videoElement:', videoElement?.readyState, 'deviceId:', deviceId);
    if (!deviceId || !videoElement) {
      console.log('Early return: no deviceId or videoElement');
      return;
    }

    let isRunning = true;
    let rafId: number;

    const init = async () => {
      try {
        console.log('Initializing MediaPipe...');
        onLoadingChange?.(true);

        // Use unpkg instead of jsDelivr for better WASM file availability
        const wasmPath = 'https://unpkg.com/@mediapipe/tasks-vision@0.10.32/wasm';
        console.log('Loading WASM from:', wasmPath);

        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        console.log('FilesetResolver loaded successfully');

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
        console.log('Landmarkers created successfully');

        if (!isRunning) {
          faceLandmarker.close();
          handLandmarker.close();
          return;
        }

        faceLandmarkerRef.current = faceLandmarker;
        handLandmarkerRef.current = handLandmarker;
        setIsInitialized(true);
        setError(null);
        onLoadingChange?.(false);

        const processFrame = () => {
          if (!isRunning) return;
          if (videoElement.readyState >= 2) {
            const now = performance.now();
            const faceResult = faceLandmarker.detectForVideo(videoElement, now);
            const handResult = handLandmarker.detectForVideo(videoElement, now);
            onResults(faceResult, handResult);
          } else {
            // Still call onResults with null so canvas can show waiting message
            onResults(null, null);
          }
          rafId = requestAnimationFrame(processFrame);
        };
        processFrame();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error initializing MediaPipe:', err);
        setError(errorMessage);
        onLoadingChange?.(false);
      }
    };

    init();

    return () => {
      console.log('Cleaning up useMediaPipe');
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
  }, [videoElement, deviceId, onResults, onLoadingChange, options?.outputBlendshapes]);

  return { isInitialized, error };
}

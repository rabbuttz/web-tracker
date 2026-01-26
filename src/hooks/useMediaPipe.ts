import { useEffect, useRef } from 'react';
import { Hands, type Results as HandResults } from '@mediapipe/hands';
import { FaceMesh, type Results as FaceResults } from '@mediapipe/face_mesh';
import { WIDTH, HEIGHT } from '../constants';

export function useMediaPipe(
    videoElement: HTMLVideoElement | null,
    onHandResults: (results: HandResults) => void,
    onFaceResults: (results: FaceResults) => void,
    deviceId: string
) {
    const handsRef = useRef<Hands | null>(null);
    const faceMeshRef = useRef<FaceMesh | null>(null);

    useEffect(() => {
        if (!deviceId || !videoElement) return;

        const smartLocateFile = (file: string) => {
            if (file.includes('hand')) {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        };

        const hands = new Hands({ locateFile: smartLocateFile });
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });
        hands.onResults(onHandResults);
        handsRef.current = hands;

        let faceMesh: FaceMesh | null = null;
        const faceMeshTimer = setTimeout(() => {
            faceMesh = new FaceMesh({ locateFile: smartLocateFile });
            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });
            faceMesh.onResults(onFaceResults);
            faceMeshRef.current = faceMesh;
        }, 1000);

        let rafId: number;
        const processFrame = async () => {
            if (videoElement && videoElement.readyState >= 2) {
                await hands.send({ image: videoElement });
                if (faceMeshRef.current) {
                    await faceMeshRef.current.send({ image: videoElement });
                }
            }
            rafId = requestAnimationFrame(processFrame);
        };
        rafId = requestAnimationFrame(processFrame);

        return () => {
            clearTimeout(faceMeshTimer);
            cancelAnimationFrame(rafId);
            hands.close();
            if (faceMeshRef.current) faceMeshRef.current.close();
        };
    }, [videoElement, onHandResults, onFaceResults, deviceId]);
}

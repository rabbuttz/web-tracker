import { useCallback, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { Camera } from '@mediapipe/camera_utils';
import { Hands, type Results } from '@mediapipe/hands';
import { drawCanvas } from './utils/drawCanvas';

function App() {
	const webcamRef = useRef<Webcam>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const resultsRef = useRef<any>(null)

	const onResults = useCallback((results: Results) => {
		resultsRef.current = results

		const canvasCtx = canvasRef.current!.getContext('2d')!
		drawCanvas(canvasCtx, results)
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
		width: 1280,
		height: 720,
		facingMode: 'user'
	}

	return (
		<div
            style={{
                position: 'relative',
                width: '1280px',
                height: '720px',
            }}
        >
			{/* capture */}
			<Webcam
				audio={false}
				style={{ 
                    visibility: 'hidden',
                    position: 'absolute',
                }}
				width={1280}
				height={720}
				ref={webcamRef}
				screenshotFormat="image/jpeg"
				videoConstraints={videoConstraints}
			/>
			<canvas 
                ref={canvasRef} 
                style={{
                    position: 'absolute',
                    width: '1280px',
                    height: '720px',
                    backgroundColor: '#fff',
                }}
            />
		</div>
	)
}

export default App

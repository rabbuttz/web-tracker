import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS, type Results as HandResults } from '@mediapipe/hands';
import { FACEMESH_TESSELATION, type Results as FaceResults } from '@mediapipe/face_mesh';

export const drawCanvas = (
	ctx: CanvasRenderingContext2D,
	handResults?: HandResults,
	faceResults?: FaceResults
) => {
	const width = ctx.canvas.width
	const height = ctx.canvas.height

	ctx.save()
	ctx.clearRect(0, 0, width, height)

	ctx.scale(-1, 1)
	ctx.translate(-width, 0)

	// Use handResults.image or faceResults.image (they should be the same frame)
	const image = handResults?.image || faceResults?.image
	if (image) {
		ctx.drawImage(image, 0, 0, width, height)
	}

	if (handResults?.multiHandLandmarks) {
		for (const landmarks of handResults.multiHandLandmarks) {
			drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 1 })
			drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 2 })
		}
	}

	if (faceResults?.multiFaceLandmarks) {
		for (const landmarks of faceResults.multiFaceLandmarks) {
			drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 })
			drawLandmarks(ctx, landmarks, { color: '#FF3030', lineWidth: 1, radius: 1 })
		}
	}

	ctx.restore()
}


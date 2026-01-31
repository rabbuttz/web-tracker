import { DrawingUtils, FaceLandmarker, HandLandmarker, type FaceLandmarkerResult, type HandLandmarkerResult } from '@mediapipe/tasks-vision';

export const drawCanvas = (
  ctx: CanvasRenderingContext2D,
  handResults?: HandLandmarkerResult,
  faceResults?: FaceLandmarkerResult,
  videoImage?: HTMLVideoElement
) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  ctx.scale(-1, 1);
  ctx.translate(-width, 0);

  if (videoImage) {
    ctx.drawImage(videoImage, 0, 0, width, height);
  }

  const drawingUtils = new DrawingUtils(ctx);

  if (handResults?.landmarks) {
    for (const landmarks of handResults.landmarks) {
      drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 1 });
      drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', lineWidth: 1, radius: 2 });
    }
  }

  if (faceResults?.faceLandmarks) {
    for (const landmarks of faceResults.faceLandmarks) {
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
      drawingUtils.drawLandmarks(landmarks, { color: '#FF3030', lineWidth: 1, radius: 1 });
    }
  }

  ctx.restore();
};

import { ARKIT_BLENDSHAPES, ARKIT_TO_UNIFIED_MAP } from '../constants';

export interface BlendshapeCategory {
  categoryName: string;
  score: number;
}

export function getBlendshapeValue(blendshapes: BlendshapeCategory[] | undefined, name: string): number {
  if (!blendshapes) {
    return 0;
  }
  const found = blendshapes.find((shape) => shape.categoryName === name);
  return found?.score ?? 0;
}

export function sendPerfectSyncBlendshapes(
  blendshapes: BlendshapeCategory[] | undefined,
  eyeBlinkLeft: number,
  eyeBlinkRight: number,
  sendParam: (path: string, values: number[]) => void
) {
  ARKIT_BLENDSHAPES.forEach((shapeName) => {
    let value = getBlendshapeValue(blendshapes, shapeName);

    if (shapeName === 'eyeBlinkLeft') {
      value = eyeBlinkLeft;
    } else if (shapeName === 'eyeBlinkRight') {
      value = eyeBlinkRight;
    }

    sendParam(`/avatar/parameters/FT/v2/${shapeName}`, [value]);

    const unifiedName = ARKIT_TO_UNIFIED_MAP[shapeName];
    if (unifiedName) {
      sendParam(`/avatar/parameters/FT/v2/${unifiedName}`, [value]);
    }
  });
}

export function rememberDetectedBlendshapes(
  blendshapes: BlendshapeCategory[],
  detectedNames: Set<string>,
  threshold = 0.001
) {
  blendshapes.forEach((shape) => {
    if (shape.score > threshold) {
      detectedNames.add(shape.categoryName);
    }
  });
}

export function buildBlendshapeDebug(
  detectedNames: Set<string>,
  blendshapes: BlendshapeCategory[]
): { name: string; value: number }[] {
  return Array.from(detectedNames)
    .map((name) => {
      const found = blendshapes.find((shape) => shape.categoryName === name);
      return { name, value: found?.score ?? 0 };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

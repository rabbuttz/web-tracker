const MIN_VISeme = 0.0001;

export interface VisemeValues {
  aa: number;
  ih: number;
  ou: number;
  E: number;
  oh: number;
}

export interface VisemeInput {
  nHeight: number;
  jawOpen: number;
  mouthPucker: number;
  mouthFunnel: number;
  mouthSmileLeft: number;
  mouthSmileRight: number;
  mouthStretchLeft: number;
  mouthStretchRight: number;
  mouthLowerDown: number;
  mouthUpperUp: number;
}

const clampViseme = (value: number) => {
  if (Number.isNaN(value)) {
    return MIN_VISeme;
  }
  return Math.max(MIN_VISeme, Math.min(1.0, value));
};

export function calculateVisemes(input: VisemeInput): VisemeValues {
  const mouthOpenGate = Math.min(1.0, input.nHeight / 0.04);

  let aa = Math.max(0, input.jawOpen * 1.5 - 0.1) * mouthOpenGate;

  const smileAmount = (input.mouthSmileLeft + input.mouthSmileRight) * 0.5
    + (input.mouthStretchLeft + input.mouthStretchRight) * 0.5;
  let ih = Math.max(0, smileAmount * 1.3 - 0.1) * mouthOpenGate;

  const puckerAmount = input.mouthPucker * 0.7 + input.mouthFunnel * 0.3;
  let ou = Math.max(0, puckerAmount * 1.0 - 0.3) * mouthOpenGate;

  const lipOpen = (input.mouthLowerDown + input.mouthUpperUp) * 0.5;
  const eStretch = (input.mouthStretchLeft + input.mouthStretchRight) * 0.5;
  const eSmile = (input.mouthSmileLeft + input.mouthSmileRight) * 0.3;
  let E = Math.min(1.0, Math.max(0, lipOpen + eStretch + eSmile + input.jawOpen * 0.6) * 1.5) * mouthOpenGate;

  let oh = Math.max(0, input.jawOpen * 0.8 + input.mouthPucker * 0.4 - 0.25) * mouthOpenGate;

  const sum = aa + ih + ou + E + oh;

  if (sum > 1.5) {
    const scale = 1.5 / sum;
    aa *= scale;
    ih *= scale;
    ou *= scale;
    E *= scale;
    oh *= scale;
  } else if (sum <= 0.01) {
    aa = MIN_VISeme;
    ih = MIN_VISeme;
    ou = MIN_VISeme;
    E = MIN_VISeme;
    oh = MIN_VISeme;
  }

  return {
    aa: clampViseme(aa),
    ih: clampViseme(ih),
    ou: clampViseme(ou),
    E: clampViseme(E),
    oh: clampViseme(oh)
  };
}

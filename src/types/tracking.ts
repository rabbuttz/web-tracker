export type AppLogLevel = 'log' | 'info' | 'warn' | 'error';
export type ExpressionMode = 'visemeBlendshape' | 'blendshape';

export interface HandCalibration {
  leftHandSize: number | null;
  rightHandSize: number | null;
  referenceDepth: number;
}

export interface BlinkHistory {
  inBlink: boolean;
  minSinceBlink: number;
  openSamples: number[];
}

export interface EyeCalibration {
  openLeft: number;
  openRight: number;
  closedLeft: number;
  closedRight: number;
  frameCount: number;
  leftBlink: BlinkHistory;
  rightBlink: BlinkHistory;
}

export const createBlinkHistory = (): BlinkHistory => ({
  inBlink: false,
  minSinceBlink: Number.POSITIVE_INFINITY,
  openSamples: []
});

export const createDefaultEyeCalibration = (): EyeCalibration => ({
  openLeft: 1.0,
  openRight: 1.0,
  closedLeft: 0.0,
  closedRight: 0.0,
  frameCount: 0,
  leftBlink: createBlinkHistory(),
  rightBlink: createBlinkHistory()
});

export interface CalibrateControlCommand {
  type: 'calibrate';
  target: 'head' | 'hand';
  queuedAt?: number;
}

export interface AutoCalibrateControlCommand {
  type: 'auto-calibrate';
  enabled: boolean;
  queuedAt?: number;
}

export type ControlCommand = CalibrateControlCommand | AutoCalibrateControlCommand;

export interface ElectronAPI {
  oscSend: (path: string, value: number | number[] | string) => void;
  onWindowVisibilityChange: (callback: (isVisible: boolean) => void) => void;
  onAutoHideNotice: (callback: (payload?: { durationMs?: number }) => void) => void;
  log: (level: AppLogLevel, ...args: unknown[]) => void;
  notifyTrackingStarted: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

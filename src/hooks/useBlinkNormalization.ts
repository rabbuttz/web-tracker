import { useCallback, type MutableRefObject } from 'react';
import { createBlinkHistory, type EyeCalibration } from '../types/tracking';

const BLINK_HISTORY_SIZE = 5;

export function useBlinkNormalization(eyeCalibrationRef: MutableRefObject<EyeCalibration>) {
  return useCallback((rawValue: number, side: 'left' | 'right') => {
    const calib = eyeCalibrationRef.current;
    calib.frameCount++;

    const isLeft = side === 'left';

    if (!calib.leftBlink) {
      calib.leftBlink = createBlinkHistory();
    }
    if (!calib.rightBlink) {
      calib.rightBlink = createBlinkHistory();
    }

    const blink = isLeft ? calib.leftBlink : calib.rightBlink;
    const getOpen = () => (isLeft ? calib.openLeft : calib.openRight);
    const getClosed = () => (isLeft ? calib.closedLeft : calib.closedRight);

    const setOpen = (value: number) => {
      if (isLeft) {
        calib.openLeft = value;
      } else {
        calib.openRight = value;
      }
    };

    const setClosed = (value: number) => {
      if (isLeft) {
        calib.closedLeft = value;
      } else {
        calib.closedRight = value;
      }
    };

    if (rawValue > getClosed()) {
      setClosed(rawValue);
    }

    const openBase = getOpen();
    const closedBase = getClosed();
    const baseRange = closedBase - openBase;
    const hasRange = baseRange > 0.05;
    const closeThreshold = hasRange ? openBase + baseRange * 0.6 : 0.4;
    const openThreshold = hasRange ? openBase + baseRange * 0.3 : 0.2;

    if (!blink.inBlink) {
      if (!Number.isFinite(blink.minSinceBlink)) {
        blink.minSinceBlink = rawValue;
      } else if (rawValue < blink.minSinceBlink) {
        blink.minSinceBlink = rawValue;
      }

      if (rawValue >= closeThreshold) {
        if (Number.isFinite(blink.minSinceBlink)) {
          blink.openSamples.push(blink.minSinceBlink);
          if (blink.openSamples.length > BLINK_HISTORY_SIZE) {
            blink.openSamples.shift();
          }
        }
        blink.inBlink = true;
      }
    } else if (rawValue <= openThreshold) {
      blink.inBlink = false;
      blink.minSinceBlink = rawValue;
    }

    if (blink.openSamples.length > 0) {
      const sum = blink.openSamples.reduce((acc, value) => acc + value, 0);
      let avgOpen = sum / blink.openSamples.length;
      if (getClosed() > 0.05) {
        avgOpen = Math.min(avgOpen, getClosed() - 0.02);
      }
      setOpen(avgOpen);
    } else if (rawValue < getOpen()) {
      setOpen(rawValue);
    }

    if (calib.frameCount % 300 === 0 && blink.openSamples.length === 0 && getOpen() < getClosed() * 0.5) {
      setOpen(getOpen() * 0.95 + getClosed() * 0.05 * 0.3);
    }

    if (rawValue < 0.001) {
      return 0;
    }

    const openVal = getOpen();
    const closedVal = getClosed();
    const effectiveClosedVal = openVal + (closedVal - openVal) * 0.75;
    const range = effectiveClosedVal - openVal;

    if (range < 0.05) {
      return rawValue;
    }

    const normalized = (rawValue - openVal) / range;
    return Math.max(0, Math.min(1, normalized));
  }, [eyeCalibrationRef]);
}

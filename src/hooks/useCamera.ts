import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppLogLevel } from '../types/tracking';

type AppLogger = (level: AppLogLevel, ...args: unknown[]) => void;

export const CAMERA_RETRY_INTERVAL_MS = 3000;

function getMediaErrorName(error: unknown): string {
  if (error instanceof DOMException) {
    return error.name;
  }
  if (error && typeof error === 'object' && 'name' in error) {
    return String((error as { name?: unknown }).name ?? '');
  }
  return '';
}

function shouldRetryCameraAccess(error: unknown): boolean {
  const errorName = getMediaErrorName(error);
  return errorName !== 'NotAllowedError' && errorName !== 'SecurityError';
}

export function useCamera(log: AppLogger) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const [isCameraRetryActive, setIsCameraRetryActive] = useState(false);

  const selectedDeviceIdRef = useRef(selectedDeviceId);
  selectedDeviceIdRef.current = selectedDeviceId;

  useEffect(() => {
    const updateDevices = async () => {
      try {
        log('info', 'Enumerating camera devices...');
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceInfos.filter((device) => device.kind === 'videoinput');

        log('info', `Found ${videoDevices.length} camera device(s)`);
        videoDevices.forEach((device, index) => {
          log('info', `  Camera ${index + 1}: ${device.label || 'Unknown device'}`);
        });

        setDevices(videoDevices);

        if (videoDevices.length > 0 && !selectedDeviceIdRef.current) {
          const savedDeviceId = localStorage.getItem('selectedCameraDeviceId');
          const savedDevice = savedDeviceId ? videoDevices.find((device) => device.deviceId === savedDeviceId) : null;

          if (savedDevice) {
            setSelectedDeviceId(savedDevice.deviceId);
            log('info', `Loaded saved camera: ${savedDevice.label || 'Unknown device'}`);
          } else {
            setSelectedDeviceId(videoDevices[0].deviceId);
            log('info', `Selected default camera: ${videoDevices[0].label || 'Unknown device'}`);
          }
        }
      } catch (error) {
        log('error', 'Failed to enumerate camera devices:', error);
      }
    };

    updateDevices();
    navigator.mediaDevices.addEventListener('devicechange', updateDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', updateDevices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  useEffect(() => {
    if (!isCameraRetryActive) {
      return;
    }

    log('warn', `Camera stream unavailable. Retrying every ${CAMERA_RETRY_INTERVAL_MS / 1000} seconds...`);
    const timerId = window.setInterval(() => {
      log('info', 'Retrying camera access...');
      setCameraRetryNonce((current) => current + 1);
    }, CAMERA_RETRY_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isCameraRetryActive, log]);

  const selectDevice = useCallback((deviceId: string) => {
    setIsCameraRetryActive(false);
    setSelectedDeviceId(deviceId);
    localStorage.setItem('selectedCameraDeviceId', deviceId);

    const device = devices.find((item) => item.deviceId === deviceId);
    log('info', `Camera changed and saved: ${device?.label || 'Unknown device'}`);
  }, [devices, log]);

  const handleCameraStarted = useCallback(() => {
    setIsCameraRetryActive(false);
    const deviceName = devices.find((device) => device.deviceId === selectedDeviceId)?.label || 'Unknown device';
    log('info', `Camera stream started successfully: ${deviceName}`);
  }, [devices, log, selectedDeviceId]);

  const handleCameraError = useCallback((error: unknown) => {
    const willRetry = shouldRetryCameraAccess(error);
    setIsCameraRetryActive(willRetry);

    if (!willRetry) {
      log('warn', `Camera access is blocked (${getMediaErrorName(error) || 'unknown'}). Retry is disabled until camera permission changes.`);
    }

    log('error', 'Camera access failed:', error);
  }, [log]);

  return {
    devices,
    selectedDeviceId,
    cameraRetryNonce,
    selectDevice,
    handleCameraStarted,
    handleCameraError
  };
}

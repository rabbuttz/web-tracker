import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { HEIGHT, WIDTH } from './constants';
import { ControlPanel } from './components/ControlPanel';
import { LoadingOverlay } from './components/LoadingOverlay';
import { CalibrationCountdown } from './components/CalibrationCountdown';
import { AutoHideNotice } from './components/AutoHideNotice';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useThreeManager } from './hooks/useThreeManager';
import { useCalibration } from './hooks/useCalibration';
import { useCamera } from './hooks/useCamera';
import { useTracking } from './hooks/useTracking';
import type { AppLogLevel, ControlCommand, ExpressionMode } from './types/tracking';

const CONTROL_POLL_INTERVAL_MS = 500;

function appLog(level: AppLogLevel, ...args: unknown[]) {
  console[level](...args);
  if (window.electronAPI?.log) {
    window.electronAPI.log(level, ...args);
  }
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [expressionMode, setExpressionMode] = useState<ExpressionMode>('visemeBlendshape');
  const [autoCalibrate, setAutoCalibrate] = useState(true);
  const [blinkSyncEnabled, setBlinkSyncEnabled] = useState(false);
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const [setupStatus, setSetupStatus] = useState('');
  const [showAutoHideNotice, setShowAutoHideNotice] = useState(false);
  const [resoniteUsername, setResoniteUsername] = useState(localStorage.getItem('resoniteUsername') || '');
  const [resonitePort, setResonitePort] = useState<number>(Number(localStorage.getItem('resonitePort')) || 10534);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  const controlPollErrorRef = useRef(0);
  const autoHideNoticeTimerRef = useRef<number | null>(null);

  const threeStateRef = useThreeManager(threeCanvasRef.current);

  const {
    handCalibCountdown,
    headPoseRef,
    rawHeadPoseRef,
    calibrationRef,
    handCalibrationRef,
    eyeCalibrationRef,
    handleCalibrate,
    handleHandCalibrate,
    handleResetCalibration,
    updateAutoCalibration
  } = useCalibration();

  const {
    devices,
    selectedDeviceId,
    cameraRetryNonce,
    selectDevice,
    handleCameraStarted,
    handleCameraError
  } = useCamera(appLog);

  const { processResults, handResultsRef, mouthDebug, blendshapeDebug } = useTracking({
    canvasRef,
    threeStateRef,
    videoElement,
    isWindowVisible,
    expressionMode,
    blinkSyncEnabled,
    autoCalibrate,
    headPoseRef,
    rawHeadPoseRef,
    calibrationRef,
    handCalibrationRef,
    eyeCalibrationRef,
    updateAutoCalibration,
    log: appLog
  });

  const handleWebcamRef = useCallback((node: Webcam | null) => {
    webcamRef.current = node;
    if (node?.video) {
      setVideoElement(node.video);
    }
  }, []);

  const handleSetupFacetrack = useCallback(async () => {
    if (!resoniteUsername) {
      setSetupStatus('Error: Username required');
      return;
    }

    setSetupStatus('Setting up FaceTrack...');
    try {
      const response = await fetch(
        `http://localhost:3000/setup-facetrack?username=${encodeURIComponent(resoniteUsername)}&port=${resonitePort}`
      );
      const text = await response.text();
      setSetupStatus(text);
      appLog('info', `Setup result: ${text}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSetupStatus(`Error: ${message}`);
      appLog('error', `Setup failed: ${message}`);
    }
  }, [resonitePort, resoniteUsername]);

  const handleSetMode = useCallback((mode: ExpressionMode) => {
    setExpressionMode(mode);
    localStorage.setItem('expressionMode', mode);
    appLog('info', `Expression mode saved: ${mode}`);
  }, []);

  useEffect(() => {
    const savedExpressionMode = localStorage.getItem('expressionMode');
    if (savedExpressionMode === 'visemeBlendshape' || savedExpressionMode === 'blendshape') {
      setExpressionMode(savedExpressionMode);
      appLog('info', `Loaded expression mode: ${savedExpressionMode}`);
    }

    const savedAutoCalibrate = localStorage.getItem('autoCalibrate');
    if (savedAutoCalibrate !== null) {
      setAutoCalibrate(savedAutoCalibrate === 'true');
      appLog('info', `Loaded auto calibrate: ${savedAutoCalibrate}`);
    }

    const savedBlinkSync = localStorage.getItem('blinkSyncEnabled');
    if (savedBlinkSync !== null) {
      setBlinkSyncEnabled(savedBlinkSync === 'true');
      appLog('info', `Blink sync: ${savedBlinkSync}`);
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onWindowVisibilityChange) {
      return;
    }

    window.electronAPI.onWindowVisibilityChange((isVisible) => {
      setIsWindowVisible(isVisible);
      if (isVisible) {
        setShowAutoHideNotice(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onAutoHideNotice) {
      return;
    }

    window.electronAPI.onAutoHideNotice((payload) => {
      if (autoHideNoticeTimerRef.current !== null) {
        window.clearTimeout(autoHideNoticeTimerRef.current);
        autoHideNoticeTimerRef.current = null;
      }

      setShowAutoHideNotice(true);

      const durationMs = payload?.durationMs ?? 1400;
      autoHideNoticeTimerRef.current = window.setTimeout(() => {
        setShowAutoHideNotice(false);
        autoHideNoticeTimerRef.current = null;
      }, Math.max(600, durationMs + 600));
    });

    return () => {
      if (autoHideNoticeTimerRef.current !== null) {
        window.clearTimeout(autoHideNoticeTimerRef.current);
        autoHideNoticeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    const applyCommand = (command: ControlCommand) => {
      if (command.type === 'calibrate') {
        if (command.target === 'head') {
          handleCalibrate();
          appLog('info', 'Head calibration triggered via endpoint');
        } else {
          handleHandCalibrate(() => handResultsRef.current);
          appLog('info', 'Hand calibration triggered via endpoint');
        }
        return;
      }

      setAutoCalibrate(command.enabled);
      localStorage.setItem('autoCalibrate', String(command.enabled));
      appLog('info', `Auto calibrate set via endpoint: ${command.enabled}`);
    };

    const poll = async () => {
      try {
        const response = await fetch('http://localhost:3000/control-commands', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload: unknown = await response.json();
        if (Array.isArray(payload)) {
          payload.forEach((command) => {
            if (command && typeof command === 'object' && typeof (command as { type?: unknown }).type === 'string') {
              applyCommand(command as ControlCommand);
            }
          });
        }
      } catch (error) {
        const now = Date.now();
        if (now - controlPollErrorRef.current > 10000) {
          appLog('warn', 'Control endpoint unavailable:', error);
          controlPollErrorRef.current = now;
        }
      } finally {
        if (!cancelled) {
          timerId = window.setTimeout(poll, CONTROL_POLL_INTERVAL_MS);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [handleCalibrate, handleHandCalibrate, handResultsRef]);

  useMediaPipe(videoElement, processResults, selectedDeviceId, setIsLoading, { outputBlendshapes: true });

  return (
    <div className="app-container" style={{ position: 'relative', width: WIDTH, height: HEIGHT, backgroundColor: '#1a1a2e', overflow: 'hidden' }}>
      <Webcam
        key={`${selectedDeviceId}:${cameraRetryNonce}`}
        audio={false}
        style={{ visibility: 'hidden', position: 'absolute' }}
        width={WIDTH}
        height={HEIGHT}
        ref={handleWebcamRef}
        videoConstraints={{
          width: WIDTH,
          height: HEIGHT,
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined
        }}
        onUserMedia={() => {
          if (webcamRef.current?.video) {
            setVideoElement(webcamRef.current.video);
            handleCameraStarted();
          }
        }}
        onUserMediaError={(error) => {
          setVideoElement(null);
          handleCameraError(error);
        }}
      />

      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ position: 'absolute', width: WIDTH, height: HEIGHT, backgroundColor: '#16213e' }}
      />
      <canvas
        ref={threeCanvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ position: 'absolute', width: WIDTH, height: HEIGHT, pointerEvents: 'none' }}
      />

      <LoadingOverlay isVisible={isLoading} width={WIDTH} height={HEIGHT} />
      <CalibrationCountdown countdown={handCalibCountdown} width={WIDTH} height={HEIGHT} />
      <AutoHideNotice visible={showAutoHideNotice} width={WIDTH} height={HEIGHT} />

      <ControlPanel
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={(deviceId) => {
          setVideoElement(null);
          selectDevice(deviceId);
        }}
        onCalibrate={handleCalibrate}
        onHandCalibrate={() => handleHandCalibrate(() => handResultsRef.current)}
        onResetCalibration={handleResetCalibration}
        handCalibCountdown={handCalibCountdown}
        mouthDebug={mouthDebug}
        blendshapeDebug={blendshapeDebug}
        expressionMode={expressionMode}
        onSetMode={handleSetMode}
        autoCalibrate={autoCalibrate}
        onAutoCalibrateChange={(enabled) => {
          setAutoCalibrate(enabled);
          localStorage.setItem('autoCalibrate', String(enabled));
          appLog('info', `Auto calibrate saved: ${enabled}`);
        }}
        blinkSyncEnabled={blinkSyncEnabled}
        onBlinkSyncChange={(enabled) => {
          setBlinkSyncEnabled(enabled);
          localStorage.setItem('blinkSyncEnabled', String(enabled));
          appLog('info', `Blink sync saved: ${enabled}`);
        }}
        setupStatus={setupStatus}
        resoniteUsername={resoniteUsername}
        onResoniteUsernameChange={(name) => {
          setResoniteUsername(name);
          localStorage.setItem('resoniteUsername', name);
        }}
        resonitePort={resonitePort}
        onResonitePortChange={(port) => {
          setResonitePort(port);
          localStorage.setItem('resonitePort', String(port));
        }}
        onSetupFacetrack={handleSetupFacetrack}
      />
    </div>
  );
}

export default App;

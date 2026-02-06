interface CalibrationCountdownProps {
  countdown: number | null;
  width: number;
  height: number;
}

export function CalibrationCountdown({ countdown, width, height }: CalibrationCountdownProps) {
  if (countdown === null) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width,
      height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(26, 26, 46, 0.6)',
      pointerEvents: 'none',
      zIndex: 50
    }}>
      <div style={{
        fontSize: '120px',
        fontWeight: 'bold',
        color: 'white',
        textShadow: '0 0 20px rgba(0, 212, 255, 0.8)'
      }}>
        {countdown}
      </div>
    </div>
  );
}

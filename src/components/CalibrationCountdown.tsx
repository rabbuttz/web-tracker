interface CalibrationCountdownProps {
  countdown: number | null;
}

export function CalibrationCountdown({ countdown }: CalibrationCountdownProps) {
  if (countdown === null) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(26, 26, 46, 0.6)',
      pointerEvents: 'none',
      zIndex: 50,
      borderRadius: 8
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

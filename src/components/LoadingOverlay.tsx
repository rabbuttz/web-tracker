interface LoadingOverlayProps {
  isVisible: boolean;
}

export function LoadingOverlay({ isVisible }: LoadingOverlayProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(26, 26, 46, 0.9)',
      zIndex: 100,
      borderRadius: 8
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#00d4ff',
          marginBottom: '10px'
        }}>
          Loading MediaPipe Models...
        </div>
        <div style={{
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          Downloading face_landmarker and hand_landmarker models (~9MB)
        </div>
      </div>
    </div>
  );
}

interface AutoHideNoticeProps {
  visible: boolean;
  width: number;
  height: number;
}

export function AutoHideNotice({ visible, width, height }: AutoHideNoticeProps) {
  if (!visible) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width,
      height,
      backgroundColor: 'rgba(26, 26, 46, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      pointerEvents: 'none'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '20px 28px',
        background: '#16213e',
        border: '1px solid rgba(0, 212, 255, 0.15)',
        borderRadius: 16,
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
        color: '#fff',
        textAlign: 'center'
      }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: 999,
          background: 'rgba(0, 212, 255, 0.15)',
          border: '2px solid rgba(0, 212, 255, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="30" height="22" viewBox="0 0 30 22" fill="none" aria-hidden="true">
            <path d="M3 11.5L11 19L27 3" stroke="#00d4ff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.4 }}>
          バックグラウンドでトラッキングを続けます
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
          ウィンドウは閉じますが動作は継続します
        </div>
      </div>
    </div>
  );
}

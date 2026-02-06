import { useState, useEffect } from 'react';

const STORAGE_KEY = 'closeHintDismissed';

export function CloseHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== 'true') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 900,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6,
      padding: '8px 12px',
      background: 'rgba(22, 33, 62, 0.92)',
      border: '1px solid rgba(0, 212, 255, 0.25)',
      borderRadius: 10,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 12,
      maxWidth: 260,
      lineHeight: 1.5,
    }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, color: '#00d4ff' }}>Tip:</span>{' '}
        Xボタンで閉じてもアプリはシステムトレイで動作し続けます。
      </div>
      <button
        onClick={dismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.5)',
          cursor: 'pointer',
          padding: '0 2px',
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
        }}
        title="このヒントを非表示にする"
      >
        ✕
      </button>
    </div>
  );
}

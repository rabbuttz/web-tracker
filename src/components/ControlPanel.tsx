import React from 'react';

interface ControlPanelProps {
    devices: MediaDeviceInfo[];
    selectedDeviceId: string;
    onDeviceChange: (deviceId: string) => void;
    onCalibrate: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
    devices,
    selectedDeviceId,
    onDeviceChange,
    onCalibrate,
}) => {
    return (
        <div className="controls-panel">
            <div className="control-group">
                <label htmlFor="camera-select">Camera Source</label>
                <select
                    id="camera-select"
                    value={selectedDeviceId}
                    onChange={(e) => onDeviceChange(e.target.value)}
                    className="glass-select"
                >
                    {devices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                        </option>
                    ))}
                </select>
            </div>

            <div className="control-group">
                <button className="glass-button" onClick={onCalibrate}>
                    Calibrate
                </button>
            </div>

            <style>{`
				.controls-panel {
					position: absolute;
					top: 20px;
					left: 20px;
					background: rgba(20, 20, 25, 0.7);
					backdrop-filter: blur(12px);
					padding: 16px;
					border-radius: 12px;
					border: 1px solid rgba(255, 255, 255, 0.1);
					box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
					z-index: 100;
					min-width: 240px;
					font-family: 'Inter', system-ui, sans-serif;
					color: #eee;
				}
				.control-group {
					display: flex;
					flex-direction: column;
					gap: 8px;
				}
				.control-group label {
					font-size: 12px;
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 0.05em;
					color: #999;
				}
				.glass-select {
					background: rgba(40, 40, 50, 0.5);
					border: 1px solid rgba(255, 255, 255, 0.1);
					border-radius: 6px;
					padding: 8px 12px;
					color: white;
					font-size: 14px;
					outline: none;
					cursor: pointer;
					transition: all 0.2s ease;
				}
				.glass-select:hover {
					border-color: rgba(255, 255, 255, 0.3);
					background: rgba(50, 50, 60, 0.8);
				}
				.glass-select option {
					background: #1a1a1f;
					color: white;
				}
				.glass-button {
					background: rgba(60, 100, 180, 0.5);
					border: 1px solid rgba(100, 150, 255, 0.3);
					border-radius: 6px;
					padding: 10px 16px;
					color: white;
					font-size: 14px;
					font-weight: 600;
					cursor: pointer;
					transition: all 0.2s ease;
				}
				.glass-button:hover {
					background: rgba(80, 120, 200, 0.7);
					border-color: rgba(100, 150, 255, 0.5);
				}
				.glass-button:active {
					transform: scale(0.98);
				}
			`}</style>
        </div>
    );
};

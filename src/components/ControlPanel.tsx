import React, { useState } from 'react';

interface ControlPanelProps {
	devices: MediaDeviceInfo[];
	selectedDeviceId: string;
	onDeviceChange: (deviceId: string) => void;
	onCalibrate: () => void;
	onHandCalibrate: () => void;
	onResetCalibration: () => void;
	handCalibCountdown: number | null;
	mouthDebug: {
		nHeight: number;
		nWidth: number;
		aa: number;
		ih: number;
		ou: number;
		E: number;
		oh: number;
	} | null;
	blendshapeDebug: { name: string; value: number }[] | null;
	expressionMode: 'visemeBlendshape' | 'blendshape';
	onSetMode: (mode: 'visemeBlendshape' | 'blendshape') => void;
	autoCalibrate: boolean;
	onAutoCalibrateChange: (enabled: boolean) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
	devices,
	selectedDeviceId,
	onDeviceChange,
	onCalibrate,
	onHandCalibrate,
	onResetCalibration,
	handCalibCountdown,
	mouthDebug,
	blendshapeDebug,
	expressionMode,
	onSetMode,
	autoCalibrate,
	onAutoCalibrateChange,
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
					Head Calibrate
				</button>
			</div>

			<div className="control-group">
				<label className="checkbox-label">
					<input
						type="checkbox"
						checked={autoCalibrate}
						onChange={(e) => onAutoCalibrateChange(e.target.checked)}
						className="glass-checkbox"
					/>
					<span>Auto Calibrate (5s still)</span>
				</label>
			</div>

			<div className="control-group">
				<button
					className="glass-button hand-calib-button"
					onClick={onHandCalibrate}
					disabled={handCalibCountdown !== null}
				>
					{handCalibCountdown !== null
						? `Hand Calibrate (${handCalibCountdown})`
						: 'Hand Calibrate'}
				</button>
			</div>

			<div className="control-group">
				<button className="glass-button reset-button" onClick={onResetCalibration}>
					Reset All Calibration
				</button>
			</div>

			<div className="control-group">
				<label>Expression Mode</label>
				<div className="mode-toggle-container">
					<div className="mode-button-group">
						<button
							className={`mode-button ${expressionMode === 'visemeBlendshape' ? 'active' : ''}`}
							onClick={() => expressionMode !== 'visemeBlendshape' && onSetMode('visemeBlendshape')}
						>
							Viseme (Standard)
						</button>
						<button
							className={`mode-button ${expressionMode === 'blendshape' ? 'active' : ''}`}
							onClick={() => expressionMode !== 'blendshape' && onSetMode('blendshape')}
						>
							Perfect Sync
						</button>
					</div>
				</div>
				<div className="mode-description">
					{expressionMode === 'visemeBlendshape' && 'Blendshape-based aiueo calculation'}
					{expressionMode === 'blendshape' && 'Direct blendshape parameters'}
				</div>
			</div>

			{expressionMode === 'visemeBlendshape' && mouthDebug && (
				<div className="control-group debug-section">
					<label>Mouth Debug (あいうえお)</label>
					<div className="debug-grid">
						<div className="debug-item">
							<span className="debug-label">Height:</span>
							<span className="debug-value">{mouthDebug.nHeight.toFixed(3)}</span>
						</div>
						<div className="debug-item">
							<span className="debug-label">Width:</span>
							<span className="debug-value">{mouthDebug.nWidth.toFixed(3)}</span>
						</div>
						<div className="debug-item viseme">
							<span className="debug-label">あ (aa):</span>
							<span className="debug-value">{mouthDebug.aa.toFixed(3)}</span>
						</div>
						<div className="debug-item viseme">
							<span className="debug-label">い (ih):</span>
							<span className="debug-value">{mouthDebug.ih.toFixed(3)}</span>
						</div>
						<div className="debug-item viseme">
							<span className="debug-label">う (ou):</span>
							<span className="debug-value">{mouthDebug.ou.toFixed(3)}</span>
						</div>
						<div className="debug-item viseme">
							<span className="debug-label">え (E):</span>
							<span className="debug-value">{mouthDebug.E.toFixed(3)}</span>
						</div>
						<div className="debug-item viseme">
							<span className="debug-label">お (oh):</span>
							<span className="debug-value">{mouthDebug.oh.toFixed(3)}</span>
						</div>
					</div>
				</div>
			)}

			{expressionMode === 'blendshape' && blendshapeDebug && blendshapeDebug.length > 0 && (
				<div className="control-group debug-section">
					<label>Blendshapes ({blendshapeDebug.length})</label>
					<div className="debug-grid blendshape-grid">
						{blendshapeDebug.map((bs, index) => (
							<div key={index} className="debug-item blendshape">
								<span className="debug-label">{bs.name}:</span>
								<span className="debug-value">{bs.value.toFixed(3)}</span>
							</div>
						))}
					</div>
				</div>
			)}

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
				.glass-input {
					background: rgba(40, 40, 50, 0.5);
					border: 1px solid rgba(255, 255, 255, 0.1);
					border-radius: 6px;
					padding: 8px 12px;
					color: white;
					font-size: 14px;
					outline: none;
					transition: all 0.2s ease;
				}
				.glass-input:focus {
					border-color: rgba(100, 150, 255, 0.5);
					background: rgba(50, 50, 60, 0.8);
				}
				.status-text {
					font-size: 11px;
					color: #8cb9ff;
					margin-top: 4px;
					line-height: 1.4;
				}
				.setup-button {
					background: rgba(60, 180, 100, 0.5);
					border-color: rgba(100, 255, 150, 0.3);
				}
				.setup-button:hover {
					background: rgba(80, 200, 120, 0.7);
					border-color: rgba(100, 255, 150, 0.5);
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
				.glass-button:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}
				.hand-calib-button {
					background: rgba(100, 60, 180, 0.5);
					border-color: rgba(150, 100, 255, 0.3);
				}
				.hand-calib-button:hover:not(:disabled) {
					background: rgba(120, 80, 200, 0.7);
					border-color: rgba(150, 100, 255, 0.5);
				}
				.reset-button {
					background: rgba(180, 60, 60, 0.5);
					border-color: rgba(255, 100, 100, 0.3);
				}
				.reset-button:hover {
					background: rgba(200, 80, 80, 0.7);
					border-color: rgba(255, 100, 100, 0.5);
				}
				.checkbox-label {
					display: flex;
					align-items: center;
					gap: 8px;
					cursor: pointer;
					font-size: 13px;
					color: #ddd;
					user-select: none;
				}
				.glass-checkbox {
					width: 18px;
					height: 18px;
					cursor: pointer;
					accent-color: rgba(100, 150, 255, 0.8);
				}
				.debug-section {
					margin-top: 12px;
					padding-top: 12px;
					border-top: 1px solid rgba(255, 255, 255, 0.1);
				}
				.debug-grid {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}
				.debug-item {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 4px 8px;
					background: rgba(30, 30, 40, 0.4);
					border-radius: 4px;
					font-size: 11px;
				}
				.debug-item.viseme {
					background: rgba(100, 60, 180, 0.2);
				}
				.blendshape-grid {
					max-height: 200px;
					overflow-y: auto;
				}
				.debug-item.blendshape {
					background: rgba(60, 180, 120, 0.2);
				}
				.mode-toggle-container {
					margin-top: 8px;
				}
				.mode-button-group {
					display: flex;
					gap: 4px;
					flex-wrap: wrap;
				}
				.mode-button {
					flex: 1;
					min-width: 80px;
					background: rgba(40, 40, 50, 0.6);
					border: 1px solid rgba(255, 255, 255, 0.1);
					border-radius: 6px;
					padding: 8px 6px;
					color: #888;
					font-size: 11px;
					font-weight: 500;
					cursor: pointer;
					transition: all 0.2s ease;
				}
				.mode-button:hover {
					background: rgba(60, 100, 180, 0.4);
					border-color: rgba(100, 150, 255, 0.3);
					color: #ccc;
				}
				.mode-button.active {
					background: rgba(100, 60, 180, 0.6);
					border-color: rgba(150, 100, 255, 0.5);
					color: #fff;
					font-weight: 600;
				}
				.mode-description {
					margin-top: 6px;
					font-size: 10px;
					color: #666;
					font-style: italic;
					text-align: center;
				}
				.debug-label {
					color: #aaa;
					font-weight: 500;
				}
				.debug-value {
					color: #fff;
					font-family: 'Courier New', monospace;
					font-weight: 600;
				}
			`}</style>
		</div>
	);
};

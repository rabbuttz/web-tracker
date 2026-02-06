# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WebCamTracker4Resonite is an Electron-based desktop application that performs webcam-based facial and hand tracking using MediaPipe, then sends tracking data via OSC to Resonite/VRChat. The app uses React + Vite for the UI and includes a Node.js server for ARKit blendshape setup with Resonite.

## Development Commands

```bash
# Install dependencies (use pnpm, specified in package.json)
pnpm install

# Start development mode (runs Vite dev server, Electron, and Node.js server concurrently)
pnpm start

# Build React app only
pnpm run build

# Build Windows distributable (.exe installer + portable)
pnpm run electron:build:win

# Run linter
pnpm run lint

# Preview production build
pnpm preview
```

## Architecture Overview

### Process Architecture

The application runs three processes concurrently during development:

1. **Vite Dev Server** (port 5173): React UI with HMR
2. **Electron Main Process** (`electron-main.cjs`): Desktop window, IPC, OSC sending, logging
3. **Express/WebSocket Server** (`server.mjs`, port 3000): ResoniteLink communication for ARKit setup

### Core Data Flow

```
Webcam → MediaPipe (useMediaPipe hook) → Tracking calculations (App.tsx) → OSC messages → Resonite/VRChat
                                                                         → Canvas visualization
```

### Key Components

**Frontend (React):**
- `src/App.tsx`: Main application logic, tracking state, calibration, OSC data preparation
- `src/components/ControlPanel.tsx`: UI for camera selection, calibration controls, Resonite setup
- `src/hooks/useMediaPipe.ts`: MediaPipe initialization and frame processing (face + hand tracking)
- `src/hooks/useThreeManager.ts`: Three.js setup for 3D visualization
- `src/utils/trackingUtils.ts`: Pose calculation from landmarks (rotation matrices, quaternions)
- `src/utils/drawCanvas.ts`: Canvas drawing utilities for landmark visualization
- `src/constants.ts`: ARKit blendshapes, landmark indices, ARKit-to-Unified mappings

**Backend:**
- `electron-main.cjs`: Electron main process with IPC handlers, OSC client, auto-launch, logging to files
- `server.mjs`: Express + WebSocket server for ResoniteLink protocol (slot discovery, ARKit setup)
- `arkit-setup.mjs`: ARKit blendshape configuration and Resonite avatar setup logic
- `preload.js`: Electron preload script exposing `window.electronAPI` to renderer

### MediaPipe Integration

The app uses MediaPipe Tasks Vision with:
- **FaceLandmarker**: 478 face landmarks + 52 ARKit blendshapes + facial transformation matrix
- **HandLandmarker**: 21 landmarks per hand (up to 2 hands)

Models are loaded from CDN at runtime (`useMediaPipe.ts`).

### OSC Communication

OSC messages are sent via `window.electronAPI.oscSend()` from the renderer to the main process, which forwards them to localhost OSC endpoints (default port 9000 for VRChat, configurable for Resonite).

**Message formats:**
- Face pose: `/tracking/vrcft/head/position` (vec3), `/tracking/vrcft/head/rotation` (quaternion)
- Blendshapes: `/avatar/parameters/<UnifiedBlendshapeName>` (float 0-1)
- Hand tracking: Left/right hand position/rotation + finger tracking

### Calibration System

**Head Calibration**: Captures current head pose and uses it as reference zero point.

**Hand Calibration**: 3-second countdown, then captures hand size for depth normalization.

**Auto-calibration**: Automatically calibrates head position when first face is detected.

**Eye Calibration**: Tracks blink history to dynamically adjust eye open/closed thresholds.

### Resonite Integration (ARKit Setup)

The `server.mjs` provides a web interface to:
1. Connect to Resonite via ResoniteLink WebSocket
2. Discover user slot by username search
3. Create ARKit eye tracking components on the user's avatar
4. Configure all 52 blendshape parameters

This setup is accessed via the "Setup FaceTrack" button in the UI.

## Important Implementation Details

### ESM Modules

The project uses `"type": "module"` in `package.json`:
- `server.mjs`, `arkit-setup.mjs`: ES modules with `import`/`export`
- `electron-main.cjs`, `preload.js`: CommonJS (Electron requirement)
- React app: ES modules via Vite

### Logging

All logs go to both console and Electron log files (in `app.getPath('logs')`). Use the `appLog()` helper in `App.tsx` or `window.electronAPI.log()` to ensure logs are captured in both places.

### Mirroring

The webcam feed is horizontally mirrored (`MIRROR_X = true` in constants) for natural user experience. Tracking calculations account for this.

### Coordinate Systems

- **MediaPipe**: Normalized coordinates (0-1) with origin at top-left
- **OSC (VRChat/Resonite)**: 3D world space coordinates, requires calibration and depth estimation
- **Three.js**: For visualization only, separate from OSC coordinate system

## Common Development Patterns

### Adding New Blendshapes

1. Add to `ARKIT_BLENDSHAPES` array in `src/constants.ts`
2. Add mapping in `ARKIT_TO_UNIFIED_MAP` if using Unified Expressions
3. MediaPipe will automatically provide values in `faceResult.faceBlendshapes`

### Modifying Calibration

Calibration state is stored in `localStorage` and loaded on app start. Default values are defined at the top of `App.tsx`. To reset, use the "Reset Calibration" button or clear `localStorage`.

### IPC Communication

Add new IPC handlers in `electron-main.cjs` via `ipcMain.handle()`, expose them in `preload.js`, and use via `window.electronAPI` in React components.

## Build System

- **Development**: Uses `concurrently` to run all three processes
- **Production**: `electron-builder` packages the app with ASAR (server files are unpacked via `asarUnpack`)
- **Outputs**: `release/` directory contains NSIS installer and portable .exe

## Troubleshooting

### MediaPipe Models Fail to Load

Check network connection and CDN availability. Models are loaded from `storage.googleapis.com` and `unpkg.com`.

### OSC Not Receiving Data

Verify firewall settings and port configuration. Default is localhost:9000 for VRChat, 10534 for ResoniteLink.

### Build Failures

Clean install: `rm -rf node_modules && pnpm install`

### Camera Not Detected

Check browser permissions in DevTools console. Some webcams may require specific resolution settings.

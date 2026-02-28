# Earth Journey

Cinematic 3D Earth flight animation for **RIBA** (Royal Institute of British Architects) — 15 global routes converging on Shenzhen, with offline frame-by-frame video recording.

![Demo](docs/demo.gif)

## Features

- **15 global flight routes** converging on Shenzhen (London, New York, Tokyo, Melbourne, etc.)
- RIBA brand visual scheme — red/white minimalist with origami paper plane
- Log-space Hermite spline camera interpolation for smooth altitude transitions
- Animated flight trails with airplane icons and bilingual city labels
- Theme system: Dark Space / Minimal Light / Transparent (alpha channel for compositing)
- **Offline frame-by-frame recording** — `toBlob()` per frame → server FFmpeg assembly (no more stuttery `captureStream`)
- 1920x1080 @ 60fps output: MP4 (H.264) or ProRes 4444 (with alpha)
- Pause/resume, frame stepping, interactive timeline scrubbing
- Country borders, location markers with destination differentiation
- Deep space nebula background, cloud layer effects

## Demo

The animation flies from **RIBA, 66 Portland Place, London** to **Shenzhen World Exhibition & Convention Center**, with routes from 15 cities worldwide.

## Quick Start

### 1. Get a Cesium Ion Access Token

1. Sign up at [Cesium Ion](https://cesium.com/ion/)
2. Go to **Access Tokens** and create a new token
3. Copy your token

### 2. Setup

```bash
# Clone the repository
git clone https://github.com/RuoqiJin/earth-journey.git
cd earth-journey

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env.local

# Edit .env.local and add your Cesium token
# NEXT_PUBLIC_CESIUM_TOKEN=your_token_here

# Start development server
pnpm dev
```

### 3. Open in browser

Visit [http://localhost:3000](http://localhost:3000)

## Usage

1. Select animation and theme from the panel
2. Click **PREVIEW** to watch the animation in real-time
3. Click **START RECORDING** for offline frame capture (each frame rendered → captured → uploaded)
4. Click **PAUSE** to pause at any time
5. Video auto-downloads when recording completes (MP4 or ProRes 4444)

## Configuration

### Customize Locations

Edit `src/components/globe/types.ts` to change the start and end locations:

```typescript
export const LOCATIONS: Record<string, Location> = {
  london: {
    lat: 51.5214,
    lon: -0.1448,
    name: '66 PORTLAND PLACE',
  },
  shenzhen: {
    lat: 22.6815,
    lon: 113.839,
    name: 'SHENZHEN WORLD EXHIBITION CENTER',
  },
}
```

### Customize Animation

Modify `ANIMATION_CONFIG` in the same file to change:

- `fps`: Frame rate (default: 60)
- `segments`: Flight path segments with duration and camera positions

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [CesiumJS](https://cesium.com/cesiumjs/) - 3D globe rendering
- [Tailwind CSS 4](https://tailwindcss.com/) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type safety

## Requirements

- Node.js 18+
- Cesium Ion account (free tier works)
- FFmpeg (for video assembly from PNG frames)

## License

MIT

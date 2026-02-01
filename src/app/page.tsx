'use client'

import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with Cesium
const GlobeViewer = dynamic(
  () => import('@/components/globe/GlobeViewer'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030712',
        color: '#f8fafc',
        fontFamily: 'monospace',
      }}>
        Loading Cesium...
      </div>
    ),
  }
)

export default function HomePage() {
  return <GlobeViewer />
}

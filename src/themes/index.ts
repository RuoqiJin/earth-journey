// Theme system for Earth Journey

export interface ThemeConfig {
  id: string
  name: string
  nameZh: string

  // Background
  background: string
  transparentBackground?: boolean  // For video compositing (WebM with alpha)
  showSkyBox: boolean
  showNebula: boolean
  showVignette: boolean

  // Globe
  showNightLights: boolean
  showClouds: boolean
  showAtmosphere: boolean
  globeBaseColor?: string   // Optional: solid color for globe
  showGlobeGlow?: boolean   // Show glow around globe edge
  globeGlowColor?: string   // Color of globe glow

  // Flight line
  line: {
    showGlow: boolean
    glowColor: string
    glowAlpha: number
    glowWidth: number
    coreColor: string
    coreWidth: number
  }

  // Labels
  label: {
    color: string
    outlineColor: string
    outlineWidth: number
  }

  // Country borders
  border: {
    color: string
    alpha: number
    width: number
  }

  // Markers
  marker: {
    color: string
    outlineColor: string
  }

  // Destination marker (optional, defaults to marker if missing)
  destinationMarker?: {
    color: string
    outlineColor: string
  }
}

// Dark theme - current style
export const darkTheme: ThemeConfig = {
  id: 'dark',
  name: 'Dark Space',
  nameZh: '深空主题',

  background: '#030712',
  showSkyBox: true,
  showNebula: true,
  showVignette: true,

  showNightLights: true,
  showClouds: true,
  showAtmosphere: true,

  line: {
    showGlow: true,
    glowColor: '#ffffff',
    glowAlpha: 0.6,
    glowWidth: 24,
    coreColor: '#dc2626',
    coreWidth: 3,
  },

  label: {
    color: '#ffffff',
    outlineColor: '#000000',
    outlineWidth: 2,
  },

  border: {
    color: '#ffffff',
    alpha: 0.5,
    width: 1.5,
  },

  marker: {
    color: '#ffffff',
    outlineColor: '#C1272D',
  },

  // Destination marker (Shenzhen hub)
  destinationMarker: {
    color: '#C1272D',
    outlineColor: '#ffffff',
  },
}

// Light theme - minimal white style for compositing
export const lightTheme: ThemeConfig = {
  id: 'light',
  name: 'Minimal Light',
  nameZh: '极简浅色',

  background: '#f5f0eb',
  showSkyBox: false,
  showNebula: false,
  showVignette: false,

  showNightLights: false,
  showClouds: false,
  showAtmosphere: false,
  globeBaseColor: '#ffffff', // White globe
  showGlobeGlow: true,       // Blue glow around globe
  globeGlowColor: '#3b82f6', // Blue

  line: {
    showGlow: true,
    glowColor: '#fecaca', // Light red/pink glow instead of white
    glowAlpha: 0.7,
    glowWidth: 20,
    coreColor: '#dc2626', // Red core
    coreWidth: 3,
  },

  label: {
    color: '#374151',
    outlineColor: '#ffffff',
    outlineWidth: 0,
  },

  border: {
    color: '#9ca3af', // Light gray borders
    alpha: 0.35,
    width: 1,
  },

  marker: {
    color: '#dc2626',
    outlineColor: '#b91c1c',
  },
}

// Transparent theme - for video compositing (WebM with alpha channel)
export const transparentTheme: ThemeConfig = {
  id: 'transparent',
  name: 'Transparent',
  nameZh: '透明背景',

  background: 'transparent',
  transparentBackground: true,
  showSkyBox: false,
  showNebula: false,
  showVignette: false,

  showNightLights: false,
  showClouds: false,
  showAtmosphere: false,
  globeBaseColor: '#ffffff', // White globe
  showGlobeGlow: false,      // No glow for clean compositing

  line: {
    showGlow: true,
    glowColor: '#fecaca',
    glowAlpha: 0.7,
    glowWidth: 20,
    coreColor: '#dc2626',
    coreWidth: 3,
  },

  label: {
    color: '#374151',
    outlineColor: '#ffffff',
    outlineWidth: 2,  // Add outline for visibility on any background
  },

  border: {
    color: '#9ca3af',
    alpha: 0.35,
    width: 1,
  },

  marker: {
    color: '#dc2626',
    outlineColor: '#ffffff',
  },
}

export const themes: ThemeConfig[] = [darkTheme, lightTheme, transparentTheme]

export function getThemeById(id: string): ThemeConfig {
  return themes.find(t => t.id === id) || darkTheme
}

export function getDefaultTheme(): ThemeConfig {
  return darkTheme
}

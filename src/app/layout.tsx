import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Earth Journey - 3D Globe Flight Animation',
  description: 'Cinematic 3D Earth flight animation from London to Shenzhen with video recording capability',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

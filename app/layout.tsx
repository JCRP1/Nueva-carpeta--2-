import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Toaster } from "@/components/ui/sonner"

import './globals.css'

const _inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const _jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'GreenSense - Sistema de Fertirriego Inteligente',
  description: 'Sistema domotico IoT para fertirriego automatico y monitoreo ambiental en invernaderos inteligentes - Invernadero Pedro Castillo, San Jose de Ocoa',
}

export const viewport: Viewport = {
  themeColor: '#1a7a45',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark">
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  )
}

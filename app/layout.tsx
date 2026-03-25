import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GPS Tracker — Следи за автомобилями',
  description: 'WhatsGPS + Supabase + Next.js',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <body className={inter.className}>
        {children}
        <Toaster 
          position="top-center" 
          richColors 
          closeButton 
          duration={4000}
        />
      </body>
    </html>
  )
}
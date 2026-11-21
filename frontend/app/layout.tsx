import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "SwingPulse — Command Center",
  description: "Agent-pipeline swing trading desk",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={inter.className} style={{ fontFamily: "var(--font-sans)" }}>
        {children}
      </body>
    </html>
  )
}

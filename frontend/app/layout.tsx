import type { Metadata } from "next"
import "./globals.css"

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
      <body className="h-full font-sans antialiased">{children}</body>
    </html>
  )
}

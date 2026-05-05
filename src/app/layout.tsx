import type { Metadata, Viewport } from "next"
import "./globals.css"
import Providers from "./providers"

export const metadata: Metadata = {
  title: "Beholder's Call",
  description: "Organizza le sessioni di D&D",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

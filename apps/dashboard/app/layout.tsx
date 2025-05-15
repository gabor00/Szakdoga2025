import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Sidebar } from "@/components/sidebar"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Deployment Management Tool",
  description: "Manage deployments for your microservices",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="flex h-screen">
            <Sidebar />
            <div className="flex-1 overflow-auto">{children}</div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}

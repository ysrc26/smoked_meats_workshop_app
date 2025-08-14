import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "המעשנה בחצר — סדנאות",
  description: "ניהול ורישום לסדנאות",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-dvh bg-background text-foreground">
        <div className="container py-8">
          {children}
        </div>
      </body>
    </html>
  )
}
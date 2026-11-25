import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const display = Inter({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Feels Like",
  description: "How it feels outside and what to wear, now, later today and this week.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

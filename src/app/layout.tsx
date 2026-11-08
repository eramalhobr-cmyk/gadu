import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Michroma } from "next/font/google";
import "./globals.css";

const display = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Gadu",
  description: "Assistente pessoal por voz e texto.",
  manifest: "/manifest.webmanifest",
  applicationName: "Gadu",
  appleWebApp: { capable: true, title: "Gadu", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#05080b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

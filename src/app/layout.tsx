import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Michroma } from "next/font/google";
import "./globals.css";
import "./v2.css";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

const display = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "GaDu",
  description: "Assistente pessoal por voz e texto.",
  manifest: "/manifest.webmanifest",
  applicationName: "GaDu",
  appleWebApp: { capable: true, title: "GaDu", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png?v=3", apple: "/icons/apple-touch-icon.png?v=3" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#05080b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tema escolhido pela pessoa (cookie). Sem cookie, vale o escuro, que é a identidade do GaDu.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="pt-BR" data-theme={theme} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

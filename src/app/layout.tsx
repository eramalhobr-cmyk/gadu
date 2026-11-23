import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Michroma } from "next/font/google";
import "./globals.css";
import "./v2.css";
import "./v2-pages.css";
import "./ux.css";
import "./ux7.css";
import { cookies } from "next/headers";
import { parseTheme, THEME_COLOR, THEME_COOKIE } from "@/lib/theme";
import { parseTextSize, TEXT_COOKIE } from "@/lib/text-size";

const display = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

const BASE_META: Metadata = {
  title: "GaDu",
  description: "Assistente pessoal por voz e texto.",
  manifest: "/manifest.webmanifest",
  applicationName: "GaDu",
  icons: { icon: "/icons/icon-192.png?v=4", apple: "/icons/apple-touch-icon.png?v=4" },
  robots: { index: false, follow: false },
};

async function themeFromCookie() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

// Barra de status do iPhone segue o tema escolhido (claro por padrão).
export async function generateMetadata(): Promise<Metadata> {
  const theme = await themeFromCookie();
  return { ...BASE_META, appleWebApp: { capable: true, title: "GaDu", statusBarStyle: theme === "dark" ? "black-translucent" : "default" } };
}

// Uma cor de barra do sistema por tema (a do tema em uso), não pela preferência do aparelho.
export async function generateViewport(): Promise<Viewport> {
  const theme = await themeFromCookie();
  return { themeColor: THEME_COLOR[theme], colorScheme: theme, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tema escolhido pela pessoa (cookie). Sem cookie, vale o claro (o escuro continua em Configurações e por voz).
  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  // Tamanho do texto escolhido em Configurações (UX-3): 100, 115 ou 130%.
  const texto = parseTextSize(jar.get(TEXT_COOKIE)?.value);
  return (
    <html lang="pt-BR" data-theme={theme} data-texto={texto} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

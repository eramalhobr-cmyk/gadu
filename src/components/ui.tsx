"use client";
// Peças visuais compartilhadas: cores por área, ícones e anel de progresso.

export const COLORS = ["sig", "hot", "violet", "blue", "green", "pink"] as const;
export type ColorName = (typeof COLORS)[number];
export const colorVar = (c: string) => `var(--c-${COLORS.includes(c as ColorName) ? c : "sig"})`;

const PATHS: Record<string, string> = {
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v1.5M12 16v1.5",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5",
  home: "M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14",
  plane: "M3 13l18-8-6 16-3-7zM12 14l3-3",
  music: "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  folder: "M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2.5h7.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  chat: "M4 5h16v11H9l-5 4z",
  mic: "M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3zM5.5 12a6.5 6.5 0 0 0 13 0M12 18.5V21",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5",
  agents: "M12 3l8 4.5-8 4.5-8-4.5zM4 12l8 4.5 8-4.5M4 16.5L12 21l8-4.5",
  cube: "M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2zM4 7.2l8 4.4 8-4.4M12 11.6v9.6",
  gear: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z",
  menu: "M4 7h16M4 12h16M4 17h16",
  x: "M6 6l12 12M18 6L6 18",
  send: "M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5",
  history: "M4 12a8 8 0 1 0 2.6-5.9M4 4.5V9h4.5M12 8v4.5l3 1.8",
  plus: "M12 5v14M5 12h14",
  expand: "M8 14l4-4 4 4",
  panel: "M4 5h16v14H4zM14.5 5v14",
  stop: "M7 7h10v10H7z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13z",
};
export const ICONS = Object.keys(PATHS).filter((k) => !["folder", "check", "chat", "sun", "grid", "user", "agents", "mic", "cube", "gear", "moon", "menu", "x", "send", "history", "plus", "expand", "panel", "stop", "lock"].includes(k));

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.spark} />
    </svg>
  );
}

export function Ring({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`${label}: ${pct}%`}>
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--wash)" strokeWidth="7" />
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--sig)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 42 42)" style={{ transition: "stroke-dashoffset .6s", filter: "drop-shadow(0 0 6px rgba(95,240,220,.5))" }} />
      </svg>
      <span className="ring-pct">{total ? `${pct}%` : "–"}</span>
    </div>
  );
}

/** Data de hoje (Brasília) como AAAA-MM-DD. */
export const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const shortDate = (d: string) => {
  const today = todayKey();
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (d === today) return "hoje";
  if (d === tomorrow) return "amanhã";
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};

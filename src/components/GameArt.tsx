import type { CSSProperties } from "react";

// Semua gambar di src/assets/game/ dimuat otomatis berdasarkan NAMA FILE (tanpa ekstensi).
// Kalau filenya ada -> tampil gambar. Kalau belum ada -> tampil emoji cadangan.
const files = import.meta.glob<string>("../assets/game/*.{png,webp,svg,jpg,jpeg}", { eager: true, import: "default" });

const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const name = path.split("/").pop()?.replace(/\.[^.]+$/, "");
  if (name) byName[name] = url;
}

export function Art({ name, fallback, className, style }: { name: string; fallback: string; className?: string; style?: CSSProperties }) {
  const src = byName[name];
  if (!src) return <>{fallback}</>;
  return <img src={src} alt="" draggable={false} className={className ?? "h-full w-full object-contain"} style={style} />;
}

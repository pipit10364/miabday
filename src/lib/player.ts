// Data pemain (username, progres, waktu) dan leaderboard.

export const MAX_USN = 12;
// Leaderboard muncul 5 detik setelah postcard terakhir ditutup.
export const LEADERBOARD_DELAY_MS = 5000;
// Isi dengan URL Realtime Database Firebase, contoh: "https://nama-project-default-rtdb.firebaseio.com"
// Kalau dikosongkan, leaderboard hanya tersimpan di perangkat ini.
export const FIREBASE_DB_URL = "";

const K = {
  usn: "mia-golden-usn",
  quest: "mia-golden-quest",
  playMs: "mia-golden-play-ms",
  finalMs: "mia-golden-final-ms",
  boardSeen: "mia-golden-board-seen",
  local: "mia-golden-local-board",
  pending: "mia-golden-pending-score",
} as const;

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // penyimpanan penuh atau diblokir: game tetap jalan tanpa simpan
  }
};

export type Entry = { name: string; ms: number; at: number };
export type Saved = { usn: string | null; completed: number; playMs: number; finalMs: number | null; boardSeen: boolean };

export const cleanUsn = (raw: string) => raw.trim().replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, MAX_USN);

export const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const num = (value: string | null) => {
  const n = Number(value);
  return value !== null && Number.isFinite(n) ? n : null;
};

export function loadSaved(): Saved {
  const usn = cleanUsn(read(K.usn) ?? "");
  return {
    usn: usn.length >= 2 ? usn : null,
    completed: Math.min(3, Math.max(0, num(read(K.quest)) ?? 0)),
    playMs: Math.max(0, num(read(K.playMs)) ?? 0),
    finalMs: num(read(K.finalMs)),
    boardSeen: read(K.boardSeen) === "1",
  };
}

export const saveCompleted = (n: number) => write(K.quest, String(n));
export const savePlayMs = (ms: number) => write(K.playMs, String(Math.round(ms)));
export const saveFinalMs = (ms: number) => write(K.finalMs, String(Math.round(ms)));
export const saveBoardSeen = () => write(K.boardSeen, "1");

function clearProgress() {
  [K.quest, K.playMs, K.finalMs, K.boardSeen].forEach((key) => write(key, null));
}
// Pemain baru selalu mulai dari awal.
export function startPlayer(usn: string) {
  clearProgress();
  write(K.usn, usn);
}
export function clearPlayer() {
  clearProgress();
  write(K.usn, null);
}

/* ---------- Leaderboard ---------- */

export const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
// Key Firebase tidak boleh mengandung titik; tidak membedakan huruf besar/kecil.
const keyOf = (name: string) => name.toLowerCase().replace(/\./g, ",");
// Bisa juga diisi lewat environment variable VITE_FIREBASE_DB_URL di Vercel.
const dbUrl = () => String(import.meta.env["VITE_FIREBASE_DB_URL"] ?? FIREBASE_DB_URL).replace(/\/+$/, "");

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${dbUrl()}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const isEntry = (e: unknown): e is Entry =>
  typeof e === "object" && e !== null && typeof (e as Entry).name === "string" && typeof (e as Entry).ms === "number";

export const sortBoard = (list: Entry[]) => [...list].sort((a, b) => a.ms - b.ms || a.at - b.at);

// Satu nama hanya punya satu skor: yang tercepat.
export function upsertBest(list: Entry[], entry: Entry): Entry[] {
  const i = list.findIndex((e) => sameName(e.name, entry.name));
  if (i === -1) return [...list, entry];
  const current = list[i];
  if (current && entry.ms < current.ms) {
    const next = [...list];
    next[i] = entry;
    return next;
  }
  return list;
}

function readLocal(): Entry[] {
  try {
    const parsed: unknown = JSON.parse(read(K.local) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export async function submitScore(entry: Entry): Promise<void> {
  write(K.local, JSON.stringify(upsertBest(readLocal(), entry)));
  if (!dbUrl()) return;
  try {
    const path = `/leaderboard/${encodeURIComponent(keyOf(entry.name))}.json`;
    const current = await request(path);
    if (!isEntry(current) || entry.ms < current.ms) {
      await request(path, { method: "PUT", body: JSON.stringify(entry) });
    }
    write(K.pending, null);
  } catch {
    write(K.pending, JSON.stringify(entry)); // dicoba lagi saat leaderboard dibuka
  }
}

export async function fetchBoard(): Promise<{ entries: Entry[]; online: boolean }> {
  if (!dbUrl()) return { entries: sortBoard(readLocal()), online: false };
  try {
    const pending = read(K.pending);
    if (pending) {
      const parsed: unknown = JSON.parse(pending);
      if (isEntry(parsed)) await submitScore(parsed);
    }
    const data = await request("/leaderboard.json");
    const entries = data && typeof data === "object" ? Object.values(data as Record<string, unknown>).filter(isEntry) : [];
    return { entries: sortBoard(entries), online: true };
  } catch {
    return { entries: sortBoard(readLocal()), online: false };
  }
}

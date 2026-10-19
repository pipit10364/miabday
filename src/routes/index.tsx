import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bike,
  BookOpen,
  Check,
  ChevronLeft,
  Gift,
  Heart,
  LockKeyhole,
  MapPin,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Art } from "@/components/GameArt";
import { EntryGate } from "@/components/EntryGate";
import { Leaderboard } from "@/components/Leaderboard";
import { FlowerWordSearch } from "@/components/quests/FlowerWordSearch";
import { PackingQuest } from "@/components/quests/PackingQuest";
import { PrizePhotoModal, prizePhotoOf, readClaimed, saveClaimed } from "@/components/PrizePhoto";
import { Button } from "@/components/ui/button";
import {
  clearPlayer,
  formatTime,
  loadSaved,
  saveBoardSeen,
  saveCompleted,
  saveFinalMs,
  savePlayMs,
  startPlayer,
  submitScore,
} from "@/lib/player";
import belandaPlace from "@/assets/places/belanda.webp";
import jakartaPlace from "@/assets/places/jakarta.webp";
import jogjaPlace from "@/assets/places/jogja.webp";
import daisyFlower from "@/assets/flowers/daisy.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mia's Golden Quest — Birthday Adventure" },
      {
        name: "description",
        content: "Petualangan ulang tahun interaktif untuk Mia: Jakarta, Jogja, dan Belanda.",
      },
      { property: "og:title", content: "Mia's Golden Quest — Birthday Adventure" },
      {
        property: "og:description",
        content: "Tiga kota, tiga tantangan, dan satu kejutan ulang tahun untuk Mia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BirthdayQuest,
});

type Place = "jakarta" | "jogja" | "belanda";
type View = "map" | Place | "postcards";

const STOPS: Array<{
  id: Place;
  number: string;
  city: string;
  kicker: string;
  photo: string;
  coords: string;
}> = [
  { id: "jakarta", number: "01", city: "Jakarta", kicker: "Packing Koper", photo: jakartaPlace, coords: "06°12′S" },
  { id: "jogja", number: "02", city: "Jogja", kicker: "Taman Kata Bunga", photo: jogjaPlace, coords: "07°48′S" },
  { id: "belanda", number: "03", city: "Belanda", kicker: "Petualangan Mandiri", photo: belandaPlace, coords: "50°51′N" },
];

const postcardModules = import.meta.glob<string>("../assets/postcards/*.webp", { eager: true, import: "default" });
const photosOf = (city: string) =>
  Object.entries(postcardModules)
    .filter(([path]) => path.includes(`/${city}-`))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, url]) => url);

const POSTCARDS = [
  {
    city: "Jakarta",
    stamp: "20 OCT",
    photos: photosOf("jakarta"),
    front: "Dari kota tempat bintang ini bermula",
    letter:
      "Dear Mia, tetaplah bersinar dengan caramu sendiri—berani bicara, hangat pada semua orang, dan selalu punya ruang untuk bunga, buku, musik, serta mimpi baru. Jakarta selalu jadi halaman pertama yang indah.",
  },
  {
    city: "Yogyakarta",
    stamp: "UGM 2023",
    photos: photosOf("jogja"),
    front: "Untuk cerita yang terlalu unik jadi biasa",
    letter:
      "Dear Mia, semoga setiap kekacauan kecil—bahkan nasi goreng hijau dan spatula meleleh—selalu berubah jadi cerita yang bikin tertawa. Terus jalani apa yang sudah kamu mulai, sepenuh hati.",
  },
  {
    city: "Maastricht",
    stamp: "AIR MAIL",
    photos: photosOf("belanda"),
    front: "Jauh dari rumah, tetap membawa hangat",
    letter:
      "Dear Mia, di jalan baru yang kadang sulit, semoga kamu selalu menemukan bahan untuk rasa yang familiar, keberanian untuk terus belajar, dan alasan untuk tersenyum. Senyummu adalah rumah yang ikut bepergian.",
  },
];

function BirthdayQuest() {
  const [view, setView] = useState<View>("map");
  const [completed, setCompleted] = useState(0);
  const [muted, setMuted] = useState(false);
  const [openedCard, setOpenedCard] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [ready, setReady] = useState(false);
  const [usn, setUsn] = useState<string | null>(null);
  const [finalMs, setFinalMs] = useState<number | null>(null);
  const [boardSeen, setBoardSeen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const playMsRef = useRef(0);
  const flushRef = useRef<() => void>(() => {});
  const boardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getMs = useCallback(() => playMsRef.current, []);

  useEffect(() => {
    const saved = loadSaved();
    setUsn(saved.usn);
    setCompleted(saved.completed);
    setFinalMs(saved.finalMs);
    setBoardSeen(saved.boardSeen);
    playMsRef.current = saved.playMs;
    setReady(true);
    return () => { if (boardTimer.current) clearTimeout(boardTimer.current); };
  }, []);

  // Stopwatch: hanya berjalan saat Mia sedang di dalam pos dan tab terlihat.
  const inQuest = view === "jakarta" || view === "jogja" || view === "belanda";
  const playing = inQuest && finalMs === null && openedCard === null && !boardOpen;
  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    const flush = () => {
      const now = Date.now();
      if (!document.hidden) playMsRef.current += now - last;
      last = now;
      savePlayMs(playMsRef.current);
    };
    flushRef.current = flush;
    const id = setInterval(flush, 500);
    return () => {
      clearInterval(id);
      flush();
      flushRef.current = () => {};
    };
  }, [playing]);

  const sound = (kind: "tap" | "win") => {
    if (muted) return;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = audioRef.current ?? new AudioContextCtor();
    audioRef.current = ctx;
    const notes = kind === "win" ? [523, 659, 784, 1047] : [660];
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + index * 0.09 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + index * 0.09 + 0.15);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(ctx.currentTime + index * 0.09);
      oscillator.stop(ctx.currentTime + index * 0.09 + 0.17);
    });
  };

  const finishQuest = (index: number) => {
    const next = Math.max(completed, index + 1);
    setCompleted(next);
    saveCompleted(next);
    if (next === 3 && finalMs === null && usn) {
      flushRef.current();
      const ms = Math.max(1000, Math.round(playMsRef.current));
      setFinalMs(ms);
      saveFinalMs(ms);
      void submitScore({ name: usn, ms, at: Date.now() });
    }
    sound("win");
    setCelebrating(true);
    setOpenedCard(index);
    window.setTimeout(() => setCelebrating(false), 3500);
  };

  const enter = (place: Place, index: number) => {
    if (index > completed) return;
    sound("tap");
    setView(place);
  };

  // Postcard terakhir ditutup untuk pertama kali: stage leaderboard langsung muncul.
  const closeCard = (toMap: boolean) => {
    const firstFinish = openedCard === 2 && finalMs !== null && !boardSeen;
    setOpenedCard(null);
    if (toMap) setView("map");
    if (firstFinish) {
      setBoardSeen(true);
      saveBoardSeen();
      setBoardOpen(true);
    }
  };

  const beginPlayer = (name: string) => {
    startPlayer(name);
    playMsRef.current = 0;
    setUsn(name);
    setCompleted(0);
    setFinalMs(null);
    setBoardSeen(false);
    setView("map");
  };

  const switchPlayer = () => {
    if (!window.confirm("Ganti pemain? Progres dan waktu pemain ini akan direset.")) return;
    if (boardTimer.current) clearTimeout(boardTimer.current);
    clearPlayer();
    playMsRef.current = 0;
    setUsn(null);
    setCompleted(0);
    setFinalMs(null);
    setBoardSeen(false);
    setBoardOpen(false);
    setView("map");
  };

  if (!ready) return <main className="min-h-dvh bg-background" />;
  if (!usn) {
    return (
      <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
        <div className="sun-grid pointer-events-none absolute inset-0" />
      <span className="made-by" aria-hidden="true">made by: joe_pietz</span>
        <EntryGate onEnter={beginPlayer} />
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="sun-grid pointer-events-none absolute inset-0" />
      <span className="made-by" aria-hidden="true">made by: joe_pietz</span>
      {celebrating && <Confetti />}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
        <button className="brand-mark" onClick={() => setView("map")} aria-label="Kembali ke peta">
          <span className="brand-star"><Star fill="currentColor" /></span>
          <span><strong>MIA'S</strong><small>GOLDEN QUEST</small></span>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {inQuest && finalMs === null && <TimerChip getMs={getMs} />}
          <button
            className="sound-button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? "Nyalakan suara" : "Matikan suara"}
            title={muted ? "Nyalakan suara" : "Matikan suara"}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button className="postcard-button" onClick={() => setView("postcards")}>
            <span className="hidden sm:inline">POSTCARD</span>
            <span className="postcard-count">{completed}/3</span>
          </button>
        </div>
      </header>

      {view === "map" && (
        <QuestMap
          completed={completed}
          enter={enter}
          hud={<Dashboard usn={usn} completed={completed} ms={finalMs ?? playMsRef.current} finished={finalMs !== null} onBoard={() => setBoardOpen(true)} onSwitch={switchPlayer} />}
        />
      )}
      {view === "jakarta" && (
        <JakartaQuest
          onBack={() => setView("map")}
          onWin={() => finishQuest(0)}
          usn={usn}
          onPenalty={(ms) => {
            if (finalMs !== null) return; // main ulang setelah selesai tidak mengubah waktu
            playMsRef.current += ms;
            savePlayMs(playMsRef.current);
          }}
        />
      )}
      {view === "jogja" && <JogjaQuest onBack={() => setView("map")} onWin={() => finishQuest(1)} onFound={() => sound("tap")} />}
      {view === "belanda" && <MazeQuest onBack={() => setView("map")} onWin={() => finishQuest(2)} />}
      {view === "postcards" && (
        <PostcardCollection completed={completed} onBack={() => setView("map")} onOpen={setOpenedCard} />
      )}
      {openedCard !== null && (
        <PostcardModal index={openedCard} me={usn} onClose={() => closeCard(false)} onContinue={() => closeCard(true)} />
      )}
      {boardOpen && <Leaderboard me={usn} myMs={finalMs} onClose={() => setBoardOpen(false)} />}
    </main>
  );
}

function QuestMap({ completed, enter, hud }: { completed: number; enter: (place: Place, index: number) => void; hud: React.ReactNode }) {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-8 sm:pt-10">
      <div className="mb-8 text-center sm:mb-12">
        <div className="eyebrow"><Sparkles /> 20 OKTOBER • BIRTHDAY ADVENTURE</div>
        <h1 className="game-title">MIA'S <span className="gold">GOLDEN</span><br />ADVENTURE</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium text-muted-foreground sm:text-base">
          Tiga kota, tiga tantangan, dan kejutan hangat di setiap perjalanan.
        </p>
      </div>
      {hud}

      <div className="quest-map" aria-label="Peta petualangan">
        <div className="route-line" />
        <svg className="route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M26 15 C 62 15, 40 46, 72 46 S 40 77, 27 77" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="9 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {STOPS.map((stop, index) => {
          const locked = index > completed;
          const done = index < completed;
          return (
            <article key={stop.id} className={`quest-stop stop-${index + 1} ${locked ? "is-locked" : ""}`}>
              <div className="stop-coordinate">{stop.coords}</div>
              <button
                className="city-token"
                disabled={locked}
                onClick={() => enter(stop.id, index)}
                aria-label={locked ? `${stop.city} terkunci` : `Mainkan pos ${stop.city}`}
              >
                <img className="city-photo" src={stop.photo} alt="" draggable={false} />
                <span className="city-status">{done ? <Check /> : locked ? <LockKeyhole /> : <MapPin />}</span>
              </button>
              <div className="stop-label">
                <span>POS {stop.number}</span>
                <strong>{stop.city}</strong>
                <small>{locked ? "Selesaikan pos sebelumnya" : done ? "Misi selesai • Main lagi" : stop.kicker}</small>
              </div>
            </article>
          );
        })}
        <div className="map-decoration deco-cloud"><Art name="awan" fallback="☁️" className="h-14 w-14 object-contain" /></div>
        <div className="map-decoration deco-flower"><img src={daisyFlower} alt="" draggable={false} className="h-16 w-16 object-contain drop-shadow-md" /></div>
        <div className="map-decoration deco-plane"><Art name="pesawat" fallback="✈" className="h-14 w-14 object-contain" /></div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-5 text-xs font-bold text-muted-foreground">
        <span>PERJALANAN {completed === 3 ? "SELESAI!" : `${completed + 1} DARI 3`}</span>
        <div className="flex gap-2" aria-label={`${completed} dari 3 pos selesai`}>
          {[0, 1, 2].map((item) => <span key={item} className={`progress-dot ${item < completed ? "done" : ""}`} />)}
        </div>
        <span>{completed}/3 POSTCARD</span>
      </div>
    </section>
  );
}

function TimerChip({ getMs }: { getMs: () => number }) {
  const [ms, setMs] = useState(getMs());
  useEffect(() => {
    const id = setInterval(() => setMs(getMs()), 500);
    return () => clearInterval(id);
  }, [getMs]);
  return <span className="timer-chip" aria-label="Waktu bermain"><Timer />{formatTime(ms)}</span>;
}

function Dashboard({ usn, completed, ms, finished, onBoard, onSwitch }: { usn: string; completed: number; ms: number; finished: boolean; onBoard: () => void; onSwitch: () => void }) {
  return (
    <div className="hud">
      <span className="hud-avatar" aria-hidden="true">{usn.charAt(0).toUpperCase()}</span>
      <div className="hud-name"><small>PEMAIN</small><strong>@{usn}</strong></div>
      <div className="hud-stat"><small>WAKTU</small><strong>{formatTime(ms)}</strong></div>
      <div className="hud-stat"><small>POS</small><strong>{completed}/3</strong></div>
      <div className="hud-actions">
        {finished && <button className="hud-btn" onClick={onBoard} aria-label="Lihat leaderboard" title="Leaderboard"><Trophy /></button>}
        <button className="hud-btn hud-switch" onClick={onSwitch}>GANTI</button>
      </div>
    </div>
  );
}

function GameShell({ title, location, icon, onBack, children }: { title: string; location: string; icon: React.ReactNode; onBack: () => void; children: React.ReactNode }) {
  return (
    <section className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-12 pt-3 sm:px-8 sm:pt-8">
      <Button variant="ghost" className="mb-5 font-bold" onClick={onBack}><ChevronLeft /> Peta Quest</Button>
      <div className="game-panel">
        <div className="game-panel-heading">
          <span className="game-panel-icon">{icon}</span>
          <div><span>{location}</span><h1>{title}</h1></div>
        </div>
        {children}
      </div>
    </section>
  );
}

function JakartaQuest({ onBack, onWin, usn, onPenalty }: { onBack: () => void; onWin: () => void; usn: string; onPenalty: (ms: number) => void }) {
  return (
    <GameShell title="Packing Koper Ajaib" location="POS 01 • JAKARTA" icon={<img src={jakartaPlace} alt="" draggable={false} className="h-12 w-12 rounded-full border-2 border-foreground object-cover" />} onBack={onBack}>
      <div className="game-copy"><span className="round-pill">SIAP BERANGKAT</span><p>Masukkan barang kecil ke pouch, lalu susun semuanya ke koper. Baca Catatan Mia baik-baik: kalau resleting macet, waktumu bertambah.</p></div>
      <PackingQuest onWin={onWin} usn={usn} onPenalty={onPenalty} />
    </GameShell>
  );
}

function JogjaQuest({ onBack, onWin, onFound }: { onBack: () => void; onWin: () => void; onFound: () => void }) {
  return (
    <GameShell title="Taman Kata Bunga" location="POS 02 • JOGJA / UGM" icon={<img src={jogjaPlace} alt="" draggable={false} className="h-12 w-12 rounded-full border-2 border-foreground object-cover" />} onBack={onBack}>
      <div className="game-copy"><span className="round-pill">WORD SEARCH</span><p>Temukan 15 nama bunga yang tersembunyi. Setiap bunga yang mekar membawa bahasa bunga dan pesan penyemangat untuk Mia.</p></div>
      <FlowerWordSearch onWin={onWin} onFound={onFound} />
    </GameShell>
  );
}

/* ---------- Maze Maastricht: labirin berdinding tipis (dibuat acak tapi selalu sama, seed tetap) ---------- */
const N = 13;
const FINISH: [number, number] = [N - 1, N - 1];
const edgeKey = (ax: number, ay: number, bx: number, by: number) => (ax * N + ay < bx * N + by ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`);
const OPEN = new Set<string>();
{
  let seed = 2010;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const seen = new Set<string>(["0,0"]);
  const stack: [number, number][] = [[0, 0]];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1]!;
    const opts = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen.has(`${a},${b}`));
    if (!opts.length) { stack.pop(); continue; }
    const [nx, ny] = opts[Math.floor(rnd() * opts.length)]!;
    OPEN.add(edgeKey(x, y, nx, ny)); seen.add(`${nx},${ny}`); stack.push([nx, ny]);
  }
  for (let i = 0; i < 7; i++) { const x = 1 + Math.floor(rnd() * (N - 2)), y = 1 + Math.floor(rnd() * (N - 2)); if (rnd() < 0.5) OPEN.add(edgeKey(x, y, x + 1, y)); else OPEN.add(edgeKey(x, y, x, y + 1)); }
}
const canGo = (x: number, y: number, dx: number, dy: number) => OPEN.has(edgeKey(x, y, x + dx, y + dy));
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function bfs(from: [number, number]) {
  const dist = new Map<string, number>([[`${from[0]},${from[1]}`, 0]]); const par = new Map<string, string>(); const q = [from];
  while (q.length) { const [x, y] = q.shift()!; for (const [dx, dy] of DIRS) { const k = `${x + dx},${y + dy}`; if (canGo(x, y, dx, dy) && !dist.has(k)) { dist.set(k, dist.get(`${x},${y}`)! + 1); par.set(k, `${x},${y}`); q.push([x + dx, y + dy]); } } }
  const pathTo = (t: [number, number]) => { const out: [number, number][] = []; let k: string | undefined = `${t[0]},${t[1]}`; while (k) { out.unshift(k.split(",").map(Number) as [number, number]); k = par.get(k); } return out; };
  return { dist, pathTo };
}
const START_BFS = bfs([0, 0]);
const FOOD_LIST = [{ art: "nasi", emoji: "🍚" }, { art: "ayam", emoji: "🍗" }, { art: "sayur", emoji: "🥬" }];
const FOODS: Record<string, { art: string; emoji: string }> = {};
{
  const ends = [...START_BFS.dist.entries()].filter(([k]) => { const [x, y] = k.split(",").map(Number) as [number, number]; return k !== "0,0" && k !== `${N - 1},${N - 1}` && DIRS.filter(([dx, dy]) => canGo(x, y, dx, dy)).length === 1; }).sort((a, b) => b[1] - a[1]);
  const picked: [number, number][] = [];
  for (const [k] of ends) { const c = k.split(",").map(Number) as [number, number]; if (picked.every((p) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) >= 6)) picked.push(c); if (picked.length === 3) break; }
  picked.forEach((c, i) => { FOODS[`${c[0]},${c[1]}`] = FOOD_LIST[i]!; });
}
// Merpati hinggap di jalan: 3 kotak di jalur utama + 1 di jalan menuju tiap makanan. Muncul 3 dari 6 detak.
const PIGEONS: { at: [number, number]; offset: number }[] = (() => {
  const main = START_BFS.pathTo(FINISH);
  const cells = [0.3, 0.55, 0.8].map((f) => main[Math.floor(main.length * f)]!);
  Object.keys(FOODS).forEach((k) => { const p = START_BFS.pathTo(k.split(",").map(Number) as [number, number]); cells.push(p[Math.floor(p.length * 0.7)]!); });
  return cells.filter((c, i) => cells.findIndex((d) => d[0] === c[0] && d[1] === c[1]) === i).map((at, i) => ({ at, offset: i * 2 }));
})();
const PIGEON_CYCLE = 6;

function MazeQuest({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  const [position, setPosition] = useState<[number, number]>([0, 0]);
  const [crash, setCrash] = useState<[number, number] | null>(null);
  const crashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [foods, setFoods] = useState<string[]>([]);
  const [trail, setTrail] = useState<string[]>(["0,0"]);
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState("Hati-hati sama merpati 🐦, sekali tertabrak langsung ulang dari awal!");
  const swipe = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 650); return () => clearInterval(id); }, []);
  useEffect(() => () => { if (crashTimer.current) clearTimeout(crashTimer.current); }, []);
  const pigeonOn = (x: number, y: number, t = tick) => PIGEONS.some((p) => p.at[0] === x && p.at[1] === y && (t + p.offset) % PIGEON_CYCLE < 3);
  const die = (at: [number, number]) => {
    if (crash) return;
    setCrash(at);
    setNote("Mia tertabrak merpati! Mulai lagi dari awal 🐦💥");
    crashTimer.current = setTimeout(() => { setPosition([0, 0]); setFoods([]); setTrail(["0,0"]); setCrash(null); }, 900);
  };
  useEffect(() => {
    if (!crash && pigeonOn(position[0], position[1])) die(position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const move = (dx: number, dy: number) => {
    if (crash) return;
    const [x, y] = position;
    if (!canGo(x, y, dx, dy)) return;
    const nx = x + dx, ny = y + dy;
    setPosition([nx, ny]);
    if (pigeonOn(nx, ny)) return die([nx, ny]);
    const key = `${nx},${ny}`;
    setTrail((t) => (t.includes(key) ? t : [...t, key]));
    const food = FOODS[key];
    if (food && !foods.includes(key)) { setFoods([...foods, key]); setNote(`Dapat ${food.emoji}! ${foods.length + 1}/3`); }
    if (nx === FINISH[0] && ny === FINISH[1]) { if (foods.length === 3) onWin(); else setNote("Bahannya belum lengkap, cari lagi ya!"); }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const v = d[e.key]; if (v) { e.preventDefault(); move(v[0], v[1]); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const wall = "2.5px solid var(--ink)";
  return (
    <GameShell title="Gowes Mencari Rasa" location="POS 03 • BELANDA" icon={<img src={belandaPlace} alt="" draggable={false} className="h-12 w-12 rounded-full border-2 border-foreground object-cover" />} onBack={onBack}>
      <div className="game-copy"><span className="round-pill">MAASTRICHT MAZE</span><p>Labirin jalanan Maastricht! Kumpulkan nasi, ayam bakar, dan sayur di ujung-ujung gang, lalu gowes ke dapur Asia. Awas merpati yang hinggap di jalan: sekali tertabrak, Mia mulai lagi dari awal.</p></div>
      <div className="maze-wrap">
        <div
          className="maze-board"
          onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={(e) => {
            const s = swipe.current; swipe.current = null; if (!s) return;
            const dx = e.clientX - s.x, dy = e.clientY - s.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
            if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0); else move(0, Math.sign(dy));
          }}
        >
          {Array.from({ length: N * N }, (_, i) => {
            const x = i % N, y = Math.floor(i / N), key = `${x},${y}`;
            const isMia = position[0] === x && position[1] === y;
            const isFinish = x === FINISH[0] && y === FINISH[1];
            const food = FOODS[key];
            return (
              <div key={key} className={`maze-cell2 ${trail.includes(key) ? "trail" : ""} ${isFinish ? "finish" : ""}`} style={{
                borderTop: y === 0 || !canGo(x, y, 0, -1) ? wall : undefined,
                borderLeft: x === 0 || !canGo(x, y, -1, 0) ? wall : undefined,
                borderRight: x === N - 1 ? wall : undefined,
                borderBottom: y === N - 1 ? wall : undefined,
              }}>
                {crash && crash[0] === x && crash[1] === y ? <span className="mia-crash"><Art name="tabrak" fallback="💥" /></span>
                  : isMia ? <span className="mia-bike"><Art name="sepeda" fallback="🚲" /></span>
                  : pigeonOn(x, y) ? <Art name="merpati" fallback="🐦" />
                  : food && !foods.includes(key) ? <Art name={food.art} fallback={food.emoji} />
                  : isFinish ? <Art name="dapur" fallback="🏠" />
                  : ""}
              </div>
            );
          })}
        </div>
        <div className="maze-side">
          <div className="ingredient-list"><strong>KERANJANG</strong>{Object.entries(FOODS).map(([key, food]) => <span key={key} className={foods.includes(key) ? "found" : ""}><Art name={food.art} fallback={food.emoji} className="h-7 w-7 object-contain" /></span>)}</div>
          <div className="dpad">
            <Button size="icon" variant="outline" className="up" onClick={() => move(0, -1)} aria-label="Atas"><ArrowUp /></Button>
            <Button size="icon" variant="outline" className="left" onClick={() => move(-1, 0)} aria-label="Kiri"><ArrowLeft /></Button>
            <Button size="icon" variant="outline" className="down" onClick={() => move(0, 1)} aria-label="Bawah"><ArrowDown /></Button>
            <Button size="icon" variant="outline" className="right" onClick={() => move(1, 0)} aria-label="Kanan"><ArrowRight /></Button>
          </div>
          <small>{foods.length}/3 bahan • {note}</small>
        </div>
      </div>
    </GameShell>
  );
}

function PostcardCollection({ completed, onBack, onOpen }: { completed: number; onBack: () => void; onOpen: (index: number) => void }) {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-3 sm:px-8 sm:pt-8">
      <Button variant="ghost" className="mb-7 font-bold" onClick={onBack}><ChevronLeft /> Peta Quest</Button>
      <div className="text-center"><div className="eyebrow"><Gift /> KOLEKSI PERJALANAN</div><h1 className="collection-title">Postcard untuk Mia</h1><p className="mt-3 text-muted-foreground">Setiap kota menyimpan satu surat kecil untuk dibawa pulang.</p></div>
      <div className="postcard-grid">
        {POSTCARDS.map((card, index) => (
          <button key={card.city} disabled={index >= completed} className={`postcard-preview postcard-${index + 1}`} onClick={() => onOpen(index)}>
            {index >= completed ? <><LockKeyhole /><strong>Masih terkunci</strong><small>Selesaikan Pos {index + 1}</small></> : <><span className="postcard-stamp">{card.stamp}</span><img className="postcard-thumb" src={STOPS[index]?.photo} alt="" draggable={false} /><small>SALAM DARI</small><strong>{card.city}</strong><p>{card.front}</p><span className="read-card">Buka surat <ArrowRight /></span></>}
          </button>
        ))}
      </div>
    </section>
  );
}

const lastPhoto: Record<string, string> = {};
// Tiap kali kartu dibuka, ambil satu foto acak dari kota itu (tidak sama dengan foto terakhir yang keluar).
function pickPhoto(city: string, photos: string[]) {
  const pool = photos.length > 1 ? photos.filter((photo) => photo !== lastPhoto[city]) : photos;
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? photos[0];
  if (pick) lastPhoto[city] = pick;
  return pick;
}

function PostcardModal({ index, me, onClose, onContinue }: { index: number; me: string; onClose: () => void; onContinue: () => void }) {
  const card = POSTCARDS[index] ?? POSTCARDS[0];
  const [photo] = useState(() => (card ? pickPhoto(card.city, card.photos) : undefined));
  const hasPrize = Boolean(prizePhotoOf(index));
  const [claimed, setClaimed] = useState(() => readClaimed(me, index));
  const [prizeOpen, setPrizeOpen] = useState(false);
  if (!card) return null;
  const openPrize = () => {
    setPrizeOpen(true);
    setClaimed(true);
    saveClaimed(me, index);
  };
  return (
    <div className="postcard-modal" role="dialog" aria-modal="true" aria-label={`Postcard dari ${card.city}`}>
      <button className="modal-close" onClick={onClose} aria-label="Tutup"><X /></button>
      <div className={`postcard-letter postcard-${index + 1}`}>
        <div className="letter-visual">{photo && <img className="letter-photo" src={photo} alt={`Foto ${card.city}`} draggable={false} />}<span className="postcard-stamp">{card.stamp}</span><small>POSTCARD FROM</small><h2>{card.city}</h2></div>
        <div className="letter-copy"><Heart fill="currentColor" /><h3>Untuk Mia,</h3><p>{card.letter}</p><strong>Happy Birthday, Mia!</strong><small>— dengan hangat, dari semua yang sayang Mia</small></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {hasPrize && (
          <Button className={claimed ? undefined : "pp-claim"} variant={claimed ? "outline" : "default"} onClick={openPrize}>
            <Gift /> {claimed ? "Lihat hadiah lagi" : "Klaim hadiah"}
          </Button>
        )}
        <Button variant={hasPrize && !claimed ? "outline" : "default"} onClick={onContinue}>{index === 2 ? "Kembali ke Peta" : "Lanjutkan Petualangan"} <ArrowRight /></Button>
      </div>
      {prizeOpen && <PrizePhotoModal index={index} onClose={() => setPrizeOpen(false)} />}
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 44 }, (_, index) => ({ index, left: (index * 37) % 100, delay: (index % 9) * 0.08, type: index % 4 })), []);
  return <div className="confetti" aria-hidden="true">{pieces.map((piece) => <i key={piece.index} className={`confetti-${piece.type}`} style={{ left: `${piece.left}%`, animationDelay: `${piece.delay}s` }} />)}</div>;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

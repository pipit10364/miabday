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
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FlowerWordSearch } from "@/components/quests/FlowerWordSearch";
import { PackingQuest } from "@/components/quests/PackingQuest";
import { Button } from "@/components/ui/button";

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
  icon: string;
  coords: string;
}> = [
  { id: "jakarta", number: "01", city: "Jakarta", kicker: "Packing Koper", icon: "🏙️", coords: "06°12′S" },
  { id: "jogja", number: "02", city: "Jogja", kicker: "Taman Kata Bunga", icon: "🏛️", coords: "07°48′S" },
  { id: "belanda", number: "03", city: "Belanda", kicker: "Petualangan Mandiri", icon: "🌷", coords: "50°51′N" },
];

const POSTCARDS = [
  {
    city: "Jakarta",
    stamp: "20 OCT",
    icon: "🌇",
    front: "Dari kota tempat bintang ini bermula",
    letter:
      "Dear Mia, tetaplah bersinar dengan caramu sendiri—berani bicara, hangat pada semua orang, dan selalu punya ruang untuk bunga, buku, musik, serta mimpi baru. Jakarta selalu jadi halaman pertama yang indah.",
  },
  {
    city: "Yogyakarta",
    stamp: "UGM 2023",
    icon: "🍳",
    front: "Untuk cerita yang terlalu unik jadi biasa",
    letter:
      "Dear Mia, semoga setiap kekacauan kecil—bahkan nasi goreng hijau dan spatula meleleh—selalu berubah jadi cerita yang bikin tertawa. Terus jalani apa yang sudah kamu mulai, sepenuh hati.",
  },
  {
    city: "Maastricht",
    stamp: "AIR MAIL",
    icon: "🚲",
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
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("mia-golden-quest");
    if (saved) setCompleted(Math.min(3, Number(saved) || 0));
  }, []);

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
    window.localStorage.setItem("mia-golden-quest", String(next));
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

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="sun-grid pointer-events-none absolute inset-0" />
      {celebrating && <Confetti />}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
        <button className="brand-mark" onClick={() => setView("map")} aria-label="Kembali ke peta">
          <span className="brand-star"><Star fill="currentColor" /></span>
          <span><strong>MIA'S</strong><small>GOLDEN QUEST</small></span>
        </button>
        <div className="flex items-center gap-2">
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

      {view === "map" && <QuestMap completed={completed} enter={enter} />}
      {view === "jakarta" && <JakartaQuest onBack={() => setView("map")} onWin={() => finishQuest(0)} />}
      {view === "jogja" && <JogjaQuest onBack={() => setView("map")} onWin={() => finishQuest(1)} onFound={() => sound("tap")} />}
      {view === "belanda" && <MazeQuest onBack={() => setView("map")} onWin={() => finishQuest(2)} />}
      {view === "postcards" && (
        <PostcardCollection completed={completed} onBack={() => setView("map")} onOpen={setOpenedCard} />
      )}
      {openedCard !== null && (
        <PostcardModal index={openedCard} onClose={() => setOpenedCard(null)} onContinue={() => {
          setOpenedCard(null);
          setView("map");
        }} />
      )}
    </main>
  );
}

function QuestMap({ completed, enter }: { completed: number; enter: (place: Place, index: number) => void }) {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-8 sm:pt-10">
      <div className="mb-8 text-center sm:mb-12">
        <div className="eyebrow"><Sparkles /> 20 OKTOBER • BIRTHDAY ADVENTURE</div>
        <h1 className="game-title">MIA'S <span>GOLDEN</span><br />ADVENTURE</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium text-muted-foreground sm:text-base">
          Tiga kota, tiga tantangan, dan kejutan hangat di setiap perjalanan.
        </p>
      </div>

      <div className="quest-map" aria-label="Peta petualangan">
        <div className="route-line" />
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
                <span className="city-art" aria-hidden="true">{stop.icon}</span>
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
        <div className="map-decoration deco-cloud">☁️</div>
        <div className="map-decoration deco-flower">🌼</div>
        <div className="map-decoration deco-plane">✈</div>
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

function GameShell({ title, location, icon, onBack, children }: { title: string; location: string; icon: string; onBack: () => void; children: React.ReactNode }) {
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

function JakartaQuest({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  return (
    <GameShell title="Packing Koper Ajaib" location="POS 01 • JAKARTA" icon="🧳" onBack={onBack}>
      <div className="game-copy"><span className="round-pill">SIAP BERANGKAT</span><p>Masukkan semua barang ke koper tanpa numpuk. Barang kecil wajib masuk pouch transparan (kecuali daleman!). Bongkar pasang sampai semuanya muat.</p></div>
      <PackingQuest onWin={onWin} />
    </GameShell>
  );
}

function JogjaQuest({ onBack, onWin, onFound }: { onBack: () => void; onWin: () => void; onFound: () => void }) {
  return (
    <GameShell title="Taman Kata Bunga" location="POS 02 • JOGJA / UGM" icon="🌻" onBack={onBack}>
      <div className="game-copy"><span className="round-pill">WORD SEARCH</span><p>Temukan 15 nama bunga yang tersembunyi. Setiap bunga yang mekar membawa bahasa bunga dan pesan penyemangat untuk Mia.</p></div>
      <FlowerWordSearch onWin={onWin} onFound={onFound} />
    </GameShell>
  );
}

const MAZE_MAP = [
  "S..#.......",
  ".#.#.###.#.",
  ".#...#R#...",
  ".###.#.#.#.",
  "...#...#..C",
  "~~=~~~~~=~~",
  ".#...#.....",
  ".#.#.###.#.",
  ".#.#...#...",
  "V..###.#..#",
  ".#........F",
];
const MAZE_SIZE = MAZE_MAP.length;
const FOOD_EMOJI: Record<string, string> = { R: "🍚", C: "🍗", V: "🥬" };
const FOODS: Record<string, string> = {};
MAZE_MAP.forEach((row, y) => [...row].forEach((ch, x) => { if (FOOD_EMOJI[ch]) FOODS[`${x},${y}`] = FOOD_EMOJI[ch]; }));
const PIGEONS: [number, number][][] = [
  [[6, 0], [7, 0], [8, 0], [9, 0], [10, 0]],
  [[6, 6], [7, 6], [8, 6], [9, 6], [10, 6]],
  [[4, 6], [4, 7], [4, 8]],
  [[6, 10], [7, 10], [8, 10], [9, 10], [10, 10]],
];
const tile = (x: number, y: number) => MAZE_MAP[y]?.[x] ?? "#";

function MazeQuest({ onBack, onWin }: { onBack: () => void; onWin: () => void }) {
  const [position, setPosition] = useState<[number, number]>([0, 0]);
  const [safePos, setSafePos] = useState<[number, number]>([0, 0]);
  const [foods, setFoods] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState("Hati-hati sama merpati 🐦 dan kanal 🌊 — seberangi lewat jembatan!");
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 650); return () => clearInterval(id); }, []);
  const pigeonAt = (t: number) => PIGEONS.map((path) => { const n = path.length * 2 - 2; const i = t % n; return path[i < path.length ? i : n - i]; });
  const pigeons = pigeonAt(tick);
  const hit = (p: [number, number], list = pigeons) => list.some((q) => q?.[0] === p[0] && q?.[1] === p[1]);
  const bumped = () => { setPosition(safePos); setNote("Merpati kaget! Mia mundur ke tempat aman terakhir (bahan tetap aman) 🐦"); };
  useEffect(() => {
    if (hit(position) && (position[0] !== safePos[0] || position[1] !== safePos[1])) bumped();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const move = (dx: number, dy: number) => {
    const next: [number, number] = [position[0] + dx, position[1] + dy];
    const t = tile(next[0], next[1]);
    if (next.some((v) => v < 0 || v >= MAZE_SIZE) || t === "#") return;
    if (t === "~") return setNote("Itu kanal! Cari jembatan 🌉");
    if (hit(next)) { bumped(); return; }
    setPosition(next);
    if (!hit(next, pigeonAt(tick + 1))) setSafePos(next);
    const key = `${next[0]},${next[1]}`;
    if (FOODS[key] && !foods.includes(key)) { setFoods([...foods, key]); setNote(`Dapat ${FOODS[key]}!`); }
    if (t === "F") { if (foods.length === 3) onWin(); else setNote("Bahannya belum lengkap, cari lagi ya!"); }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      const v = d[e.key]; if (v) { e.preventDefault(); move(v[0], v[1]); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return (
    <GameShell title="Gowes Mencari Rasa" location="POS 03 • BELANDA" icon="🚲" onBack={onBack}>
      <div className="game-copy"><span className="round-pill">MAASTRICHT MAZE</span><p>Kumpulkan nasi, ayam bakar, dan sayur, lalu antar Mia ke dapur Asia. Hindari merpati dan seberangi kanal lewat jembatan.</p></div>
      <div className="maze-wrap">
        <div className="maze-grid" style={{ gridTemplateColumns: `repeat(${MAZE_SIZE},1fr)` }}>
          {Array.from({ length: MAZE_SIZE * MAZE_SIZE }, (_, index) => {
            const x = index % MAZE_SIZE;
            const y = Math.floor(index / MAZE_SIZE);
            const key = `${x},${y}`;
            const t = tile(x, y);
            const isMia = position[0] === x && position[1] === y;
            const cls = t === "#" ? "wall" : t === "~" ? "water" : t === "=" ? "bridge" : t === "F" ? "finish" : "";
            return <div key={key} className={`maze-cell ${cls}`}>
              {isMia ? <span className="mia-bike">🚲</span> : hit([x, y]) ? "🐦" : FOODS[key] && !foods.includes(key) ? FOODS[key] : t === "F" ? "🏠" : ""}
            </div>;
          })}
        </div>
        <div className="maze-side">
          <div className="ingredient-list"><strong>KERANJANG</strong>{Object.entries(FOODS).map(([key, emoji]) => <span key={key} className={foods.includes(key) ? "found" : ""}>{emoji}</span>)}</div>
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
            {index >= completed ? <><LockKeyhole /><strong>Masih terkunci</strong><small>Selesaikan Pos {index + 1}</small></> : <><span className="postcard-stamp">{card.stamp}</span><span className="postcard-icon">{card.icon}</span><small>SALAM DARI</small><strong>{card.city}</strong><p>{card.front}</p><span className="read-card">Buka surat <ArrowRight /></span></>}
          </button>
        ))}
      </div>
    </section>
  );
}

function PostcardModal({ index, onClose, onContinue }: { index: number; onClose: () => void; onContinue: () => void }) {
  const card = POSTCARDS[index] ?? POSTCARDS[0];
  if (!card) return null;
  return (
    <div className="postcard-modal" role="dialog" aria-modal="true" aria-label={`Postcard dari ${card.city}`}>
      <button className="modal-close" onClick={onClose} aria-label="Tutup"><X /></button>
      <div className={`postcard-letter postcard-${index + 1}`}>
        <div className="letter-visual"><span className="postcard-stamp">{card.stamp}</span><span>{card.icon}</span><small>POSTCARD FROM</small><h2>{card.city}</h2></div>
        <div className="letter-copy"><Heart fill="currentColor" /><h3>Untuk Mia,</h3><p>{card.letter}</p><strong>Happy Birthday, Mia!</strong><small>— dengan hangat, dari semua yang sayang Mia</small></div>
      </div>
      <Button className="mt-5" onClick={onContinue}>{index === 2 ? "Kembali ke Peta" : "Lanjutkan Petualangan"} <ArrowRight /></Button>
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
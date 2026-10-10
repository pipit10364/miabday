import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const FLOWERS = [
  { word: "MAWAR", emoji: "🌹", meaning: "Cinta & keberanian", cheer: "Kamu berani mencintai hidupmu sendiri, Mia." },
  { word: "PEONY", emoji: "🌸", meaning: "Kebahagiaan & kemakmuran", cheer: "Semoga tahun ini penuh rezeki dan tawa." },
  { word: "TULIP", emoji: "🌷", meaning: "Cinta yang tulus", cheer: "Hatimu yang tulus selalu kembali dengan kebaikan." },
  { word: "MELATI", emoji: "🤍", meaning: "Kesucian & ketulusan", cheer: "Tetap jadi dirimu yang lembut dan apa adanya." },
  { word: "ANGGREK", emoji: "🪻", meaning: "Kekuatan & keanggunan", cheer: "Kamu kuat, bahkan saat sedang lelah." },
  { word: "LILY", emoji: "⚜️", meaning: "Kemurnian & harapan baru", cheer: "Setiap pagi adalah halaman baru untukmu." },
  { word: "LAVENDER", emoji: "💜", meaning: "Ketenangan", cheer: "Boleh istirahat. Pelan-pelan juga tetap maju." },
  { word: "DAISY", emoji: "🌼", meaning: "Keceriaan & awal baru", cheer: "Senyummu menular ke semua orang di sekitarmu." },
  { word: "LOTUS", emoji: "🪷", meaning: "Bangkit dari kesulitan", cheer: "Apa pun lumpurnya, kamu selalu bisa mekar." },
  { word: "DAHLIA", emoji: "🏵️", meaning: "Keteguhan hati", cheer: "Pegang terus mimpimu, kamu pasti sampai." },
  { word: "MATAHARI", emoji: "🌻", meaning: "Optimisme & kesetiaan", cheer: "Kamu adalah cahaya kuning di hari-hari kami." },
  { word: "IRIS", emoji: "💠", meaning: "Harapan & kebijaksanaan", cheer: "Percaya pada langkahmu sendiri." },
  { word: "ASTER", emoji: "✳️", meaning: "Kesabaran", cheer: "Hal baik sedang tumbuh, meski belum terlihat." },
  { word: "MAGNOLIA", emoji: "🌺", meaning: "Ketahanan & martabat", cheer: "Kamu jauh lebih tangguh dari yang kamu kira." },
  { word: "SAKURA", emoji: "🌸", meaning: "Nikmati setiap momen", cheer: "Rayakan hari ini—kamu pantas bahagia!" },
];

type Cell = [number, number];
type Placement = { word: string; cells: Cell[] };
const DIRS: Cell[] = [[0, 1], [1, 0], [1, 1], [-1, 1]];
const ALPHA = "ABCDEFGHIJKLMNOPRSTUWY";

function generate(size: number) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(""));
    const placements: Placement[] = [];
    const words = [...FLOWERS].sort((a, b) => b.word.length - a.word.length);
    let ok = true;
    for (const { word } of words) {
      let done = false;
      for (let t = 0; t < 400 && !done; t++) {
        const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)] ?? [0, 1];
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        const cells: Cell[] = [];
        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const rr = r + dr * i, cc = c + dc * i;
          const cur = grid[rr]?.[cc];
          if (cur === undefined || (cur !== "" && cur !== word[i])) { fits = false; break; }
          cells.push([rr, cc]);
        }
        if (!fits) continue;
        cells.forEach(([rr, cc], i) => { const row = grid[rr]; if (row) row[cc] = word[i] ?? ""; });
        placements.push({ word, cells });
        done = true;
      }
      if (!done) { ok = false; break; }
    }
    if (!ok) continue;
    for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = ALPHA[Math.floor(Math.random() * ALPHA.length)] ?? "A";
    return { grid, placements };
  }
  return null;
}

function lineBetween(a: Cell, b: Cell): Cell[] | null {
  const dr = b[0] - a[0], dc = b[1] - a[1];
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr), sc = Math.sign(dc);
  return Array.from({ length: len + 1 }, (_, i) => [a[0] + sr * i, a[1] + sc * i] as Cell);
}

export function FlowerWordSearch({ onWin, onFound }: { onWin: () => void; onFound: () => void }) {
  const isMobile = useIsMobile();
  const size = isMobile ? 12 : 15;
  const [board, setBoard] = useState<ReturnType<typeof generate>>(null);
  const [found, setFound] = useState<string[]>([]);
  const [start, setStart] = useState<Cell | null>(null);
  const [end, setEnd] = useState<Cell | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reveal, setReveal] = useState<string | null>(null);
  const [miss, setMiss] = useState(false);

  useEffect(() => { setBoard(generate(size)); setFound([]); }, [size]);

  const selection = start && end ? lineBetween(start, end) ?? [start] : start ? [start] : [];
  const key = (c: Cell) => `${c[0]},${c[1]}`;
  const selKeys = new Set(selection.map(key));
  const foundKeys = new Set(board?.placements.filter((p) => found.includes(p.word)).flatMap((p) => p.cells.map(key)) ?? []);

  const evaluate = (a: Cell, b: Cell) => {
    if (!board) return;
    const cells = lineBetween(a, b);
    if (!cells) return;
    const text = cells.map(([r, c]) => board.grid[r]?.[c] ?? "").join("");
    const rev = text.split("").reverse().join("");
    const hit = board.placements.find((p) => !found.includes(p.word) && (p.word === text || p.word === rev));
    if (hit) { setFound([...found, hit.word]); setReveal(hit.word); onFound(); }
    else { setMiss(true); window.setTimeout(() => setMiss(false), 350); }
  };

  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const r = el?.dataset['r'], c = el?.dataset['c'];
    return r !== undefined && c !== undefined ? [Number(r), Number(c)] : null;
  };

  const onDown = (cell: Cell) => {
    if (start && !dragging && key(start) !== key(cell) && end === null) {
      // tap-tap mode: second tap completes the line
      evaluate(start, cell); setStart(null); return;
    }
    setStart(cell); setEnd(null); setDragging(true);
  };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (start && end && key(start) !== key(end)) { evaluate(start, end); setStart(null); }
    setEnd(null);
  };

  const closeReveal = () => {
    setReveal(null);
    if (found.length === FLOWERS.length) onWin();
  };
  const flower = FLOWERS.find((f) => f.word === reveal);

  return (
    <div className="mt-6 px-2 pb-2 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[560px]">
          <div
            className={cn("grid touch-none select-none gap-[2px] rounded-2xl border-4 border-foreground/80 bg-secondary p-1.5 sm:gap-1 sm:p-2", miss && "shake")}
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0,1fr))` }}
            onPointerMove={(e) => { if (dragging) { const c = cellFromPoint(e.clientX, e.clientY); if (c) setEnd(c); } }}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          >
            {board ? board.grid.flatMap((row, r) => row.map((letter, c) => (
              <div
                key={`${r}-${c}`}
                data-r={r}
                data-c={c}
                onPointerDown={(e) => { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); onDown([r, c]); }}
                className={cn(
                  "flex aspect-square cursor-pointer items-center justify-center rounded-md text-[11px] font-extrabold transition-colors sm:text-sm",
                  selKeys.has(`${r},${c}`) ? "bg-accent scale-110" : foundKeys.has(`${r},${c}`) ? "bg-primary" : "bg-card",
                )}
              >{letter}</div>
            ))) : <div className="col-span-full p-10 text-center font-bold">Menanam bunga…</div>}
          </div>
          <p className="mt-3 text-center text-xs font-bold text-muted-foreground">Geser jari/mouse dari huruf pertama ke terakhir (atau ketuk awal lalu akhir). Kata bisa mendatar, menurun, atau diagonal.</p>
        </div>
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <strong className="text-xs tracking-widest text-muted-foreground">BUKET MIA</strong>
            <span className="round-pill">{found.length}/{FLOWERS.length} BUNGA</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3">
            {FLOWERS.map((f) => {
              const got = found.includes(f.word);
              return (
                <button key={f.word} disabled={!got} onClick={() => setReveal(f.word)} className={cn("rounded-xl border-2 p-2 text-center transition", got ? "border-foreground/70 bg-primary animate-in zoom-in-75" : "border-dashed border-border bg-card")}>
                  <span className="block text-2xl">{got ? f.emoji : "🌱"}</span>
                  <span className="block text-[10px] font-extrabold tracking-wider">{got ? f.word : "?".repeat(f.word.length)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {flower && (
        <div className="postcard-modal" role="dialog" aria-modal="true" aria-label={`Bunga ${flower.word}`}>
          <div className="w-full max-w-sm rounded-3xl border-4 border-foreground/80 bg-card p-6 text-center shadow-2xl animate-in zoom-in-90">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-secondary text-7xl animate-in spin-in-12 duration-700">{flower.emoji}</div>
            <small className="mt-4 block text-xs font-extrabold tracking-widest text-muted-foreground">BAHASA BUNGA</small>
            <h2 className="text-3xl font-black">{flower.word}</h2>
            <p className="mt-1 font-bold text-primary-foreground"><span className="rounded-full bg-primary px-3 py-1">{flower.meaning}</span></p>
            <p className="mt-4 text-lg font-bold">“{flower.cheer}”</p>
            <Button className="mt-5" onClick={closeReveal}>{found.length === FLOWERS.length ? "Buket lengkap! 💐" : "Cari bunga lain"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

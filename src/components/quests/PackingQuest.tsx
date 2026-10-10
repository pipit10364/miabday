import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import aksesorisImg from "@/assets/pack/aksesoris.png";
import alaskakiImg from "@/assets/pack/alaskaki.png";
import bajuImg from "@/assets/pack/baju.png";
import bawahanImg from "@/assets/pack/bawahan.png";
import cemilanImg from "@/assets/pack/cemilan.png";
import dalemanImg from "@/assets/pack/daleman.png";
import jaketImg from "@/assets/pack/jaket.png";
import makeupImg from "@/assets/pack/makeup.png";
import mandiImg from "@/assets/pack/mandi.png";
import olehImg from "@/assets/pack/oleh.png";
import payungImg from "@/assets/pack/payung.png";
import pouchImg from "@/assets/pack/pouch.png";
import pouchWideImg from "@/assets/pack/pouch-wide.png";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const COLS = 6;
const ROWS = 6;
const HALF = 3;

type Block = { id: string; name: string; img: string; w: number; h: number; cap?: number };
type Small = { id: string; name: string; img: string; units: number };

const BIG: Block[] = [
  { id: "baju", name: "Baju", img: bajuImg, w: 2, h: 3 },
  { id: "bawahan", name: "Bawahan", img: bawahanImg, w: 2, h: 3 },
  { id: "jaket", name: "Jaket", img: jaketImg, w: 3, h: 2 },
  { id: "alaskaki", name: "Sepatu", img: alaskakiImg, w: 2, h: 2 },
  { id: "payung", name: "Payung", img: payungImg, w: 1, h: 3 },
  { id: "daleman", name: "Daleman", img: dalemanImg, w: 1, h: 2 },
  { id: "oleh", name: "Oleh-oleh", img: olehImg, w: 2, h: 1 },
];
const POUCHES: Block[] = [
  { id: "pouchL", name: "Pouch besar", img: pouchImg, w: 2, h: 2, cap: 4 },
  { id: "pouchM", name: "Pouch sedang", img: pouchWideImg, w: 2, h: 1, cap: 2 },
  { id: "pouchS", name: "Pouch kecil", img: pouchImg, w: 1, h: 1, cap: 1 },
];
const SMALLS: Small[] = [
  { id: "makeup", name: "Make up", img: makeupImg, units: 2 },
  { id: "mandi", name: "Alat mandi", img: mandiImg, units: 2 },
  { id: "cemilan", name: "Cemilan", img: cemilanImg, units: 2 },
  { id: "aksesoris", name: "Aksesoris", img: aksesorisImg, units: 1 },
];
const BLOCKS = [...BIG, ...POUCHES];
const blockById = (id: string) => BLOCKS.find((b) => b.id === id);
const smallById = (id: string) => SMALLS.find((s) => s.id === id);

type Pos = { x: number; y: number };
type Drag = { id: string; offX: number; offY: number; cw: number; ch: number; lift: number; px: number; py: number; startX: number; startY: number; moved: boolean; from?: Pos | undefined };

// PNG pouch sudah diberi margin transparan ~5.9% di tiap sisi supaya ritsleting tidak terpotong.
// Gambar digambar sedikit lebih besar dari kotaknya supaya bagian pouch tetap pas di grid.
const POUCH_PAD = { left: "-5.9%", top: "-5.9%", width: "111.8%", height: "111.8%" } as const;

export function PackingQuest({ onWin }: { onWin: () => void }) {
  const isMobile = useIsMobile();
  const cell = isMobile ? 44 : 58;
  const gap = Math.round(cell * 0.35);
  const colLeft = (x: number) => x * cell + (x >= HALF ? gap : 0);
  const [placed, setPlaced] = useState<Record<string, Pos>>({});
  const [rotated, setRotated] = useState<Record<string, boolean>>({});
  const [inPouch, setInPouch] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const [message, setMessage] = useState("Seret barang ke dalam koper. Ketuk barang untuk memutarnya.");
  const [zipped, setZipped] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const dims = (id: string, rot = rotated[id]) => {
    const b = blockById(id);
    if (!b) return { w: 1, h: 1 };
    return rot ? { w: b.h, h: b.w } : { w: b.w, h: b.h };
  };

  const occupancy = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(placed).forEach(([id, p]) => {
      const { w, h } = dims(id);
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) map.set(`${p.x + dx},${p.y + dy}`, id);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, rotated]);

  const fits = (id: string, x: number, y: number, rot = rotated[id]) => {
    const { w, h } = dims(id, rot);
    if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return false;
    if (x < HALF && x + w > HALF) return false;
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) {
      const o = occupancy.get(`${x + dx},${y + dy}`);
      if (o && o !== id) return false;
    }
    return true;
  };

  const pouchUsed = (pid: string) =>
    Object.entries(inPouch).filter(([, p]) => p === pid).reduce((s, [sid]) => s + (smallById(sid)?.units ?? 0), 0);

  // Cari kotak valid TERDEKAT dari posisi lepas (bukan harus pas banget), jadi melepas di
  // tengah / dekat engsel tetap "nempel" ke sisi yang muat.
  const dropTarget = (d: Drag) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || !blockById(d.id)) return null;
    // Posisi barang (bukan jari): di HP barang diangkat sedikit di atas jari supaya tidak tertutup.
    const tlX = d.px - d.offX - rect.left;
    const tlY = d.py - d.offY - d.lift - rect.top;
    const cx = tlX + d.cw / 2;
    const cy = tlY + d.ch / 2;
    const m = cell * 0.5;
    const inside = cx >= -m && cx <= rect.width + m && cy >= -m && cy <= rect.height + m;
    let relX = tlX;
    if (relX > HALF * cell + gap / 2) relX -= gap;
    const raw = { x: Math.round(relX / cell), y: Math.round(tlY / cell) };
    if (!inside) return { ...raw, ok: false, inside: false };
    let best: { x: number; y: number; dist: number } | null = null;
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!fits(d.id, x, y)) continue;
        const dist = Math.hypot(colLeft(x) - tlX, y * cell - tlY);
        if (!best || dist < best.dist) best = { x, y, dist };
      }
    }
    // toleransi besar: lepas di dekat engsel / di antara dua sisi tetap nempel ke tempat yang muat
    if (best && best.dist <= cell * 2.5) return { x: best.x, y: best.y, ok: true, inside: true };
    return { ...raw, ok: false, inside: true };
  };

  const startDrag = (id: string, e: React.PointerEvent) => {
    if (zipped) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDrag({ id, offX: e.clientX - r.left, offY: e.clientY - r.top, cw: r.width, ch: r.height, lift: e.pointerType === "touch" ? 44 : 0, px: e.clientX, py: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, from: placed[id] });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) =>
      setDrag((d) => d && { ...d, px: e.clientX, py: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6 });
    const up = (e: PointerEvent) => {
      const d = drag;
      setDrag(null);
      const final = { ...d, px: e.clientX, py: e.clientY };
      const small = smallById(d.id);
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) <= 6) {
        if (small) { if (inPouch[small.id]) { const n = { ...inPouch }; delete n[small.id]; setInPouch(n); setMessage(`${small.name} dikeluarkan dari pouch.`); } return; }
        // tap = rotate
        const rot = !rotated[d.id];
        if (d.from && !fits(d.id, d.from.x, d.from.y, rot)) return setMessage("Nggak bisa diputar di situ, sempit!");
        setRotated({ ...rotated, [d.id]: rot });
        return;
      }
      const gx = e.clientX - d.offX + d.cw / 2;
      const gy = e.clientY - d.offY - d.lift + d.ch / 2;
      const under = (document.elementFromPoint(gx, gy) ?? document.elementFromPoint(e.clientX, e.clientY))?.closest<HTMLElement>("[data-pouch]");
      const pouchId = under?.dataset["pouch"];
      if (small) {
        if (!pouchId) return setMessage("Barang kecil harus masuk pouch transparan dulu ya.");
        const pouch = blockById(pouchId);
        if (!pouch?.cap) return;
        const used = pouchUsed(pouchId) - (inPouch[small.id] === pouchId ? small.units : 0);
        if (used + small.units > pouch.cap) return setMessage(`${pouch.name} sudah penuh untuk ${small.name}.`);
        setInPouch({ ...inPouch, [small.id]: pouchId });
        return setMessage(`${small.name} masuk ${pouch.name} 👝`);
      }
      if (d.id === "daleman" && pouchId) return setMessage("Daleman nggak boleh masuk pouch ya 🙈");
      const t = dropTarget(final);
      if (t?.ok) {
        setPlaced({ ...placed, [d.id]: { x: t.x, y: t.y } });
        setMessage(`${blockById(d.id)?.name} masuk koper ✨`);
      } else if (t?.inside) {
        // dilepas di dalam koper tapi nggak ada tempat yang muat: barang tetap di posisi semula
        setMessage("Belum muat di situ. Coba putar (ketuk barang) atau geser ke tempat lain ya!");
      } else if (d.from) {
        const n = { ...placed }; delete n[d.id]; setPlaced(n);
        setMessage(`${blockById(d.id)?.name} dikeluarkan dari koper.`);
      }
    };
    const cancel = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.startX, drag?.startY]);

  const allDone = BLOCKS.every((b) => placed[b.id]) && SMALLS.every((s) => inPouch[s.id]);
  const target = drag && drag.moved ? dropTarget(drag) : null;
  const reset = () => { setPlaced({}); setRotated({}); setInPouch({}); setMessage("Koper dikosongkan. Yuk susun ulang!"); };

  const art = (id: string, ghost = false) => {
    const b = blockById(id);
    if (b) {
      const { w, h } = dims(id);
      const contents = SMALLS.filter((s) => inPouch[s.id] === id);
      return (
        <div
          data-pouch={b.cap && !ghost ? b.id : undefined}
          className="relative"
          style={{ width: w * cell, height: h * cell }}
          title={b.name}
        >
          {b.cap ? (
            <>
              {rotated[id] && b.w !== b.h ? (
                <img src={b.img} alt={b.name} draggable={false} className="absolute left-1/2 top-1/2 max-w-none object-fill" style={{ width: b.w * cell * 1.118, height: b.h * cell * 1.118, transform: "translate(-50%,-50%) rotate(90deg)" }} />
              ) : (
                <img src={b.img} alt={b.name} draggable={false} className="absolute max-w-none object-fill" style={POUCH_PAD} />
              )}
              <div className={cn("absolute flex flex-wrap content-center items-center justify-center gap-0.5", rotated[id] && b.w !== b.h ? "inset-y-[10%] left-[8%] right-[24%]" : "inset-x-[9%] bottom-[8%] top-[24%]")}>
                {contents.map((s) => (
                  <img key={s.id} src={s.img} alt={s.name} draggable={false} onPointerDown={(e) => { e.stopPropagation(); startDrag(s.id, e); }} className="cursor-grab touch-none object-contain" style={{ width: cell * 0.48, height: cell * 0.48 }} />
                ))}
              </div>
            </>
          ) : (
            <img
              src={b.img}
              alt={b.name}
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none object-contain drop-shadow-md transition-transform"
              style={{ width: b.w * cell * 0.94, height: b.h * cell * 0.94, transform: `translate(-50%,-50%) rotate(${rotated[id] ? 90 : 0}deg)` }}
            />
          )}
        </div>
      );
    }
    const s = smallById(id);
    return s ? <img src={s.img} alt={s.name} title={s.name} draggable={false} className="object-contain drop-shadow-md" style={{ width: cell * 1.1, height: cell * 1.1 }} /> : null;
  };

  const draggingId = drag?.moved ? drag.id : null;

  return (
    <div className="mt-6 select-none px-2 pb-2 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
        {/* Suitcase */}
        <div className="mx-auto flex flex-col items-center">
          {zipped ? <ClosedSuitcase /> : (
          <div className="relative mt-2">
            <div className="relative rounded-[28px] border-4 border-foreground/85 bg-primary p-3 shadow-[0_10px_0_var(--foreground)]">
              <div className="pointer-events-none absolute inset-1.5 rounded-[22px] border-2 border-dashed border-foreground/40" />
              <div ref={boardRef} className="relative" style={{ width: COLS * cell + gap, height: ROWS * cell }}>
                {[0, 1].map((side) => (
                  <div
                    key={side}
                    className="pointer-events-none absolute top-0 rounded-2xl border-2 border-foreground/60"
                    style={{
                      left: side ? HALF * cell + gap : 0,
                      width: HALF * cell,
                      height: ROWS * cell,
                      backgroundColor: "var(--sun-pale)",
                      backgroundImage: `repeating-linear-gradient(45deg, transparent 0 10px, color-mix(in oklab, var(--secondary) 45%, transparent) 10px 12px)`,
                    }}
                  />
                ))}
                {/* hinge + zipper */}
                <div className="pointer-events-none absolute top-2 bottom-2 flex flex-col items-center justify-evenly" style={{ left: HALF * cell, width: gap }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} className="h-1.5 w-2 rounded-sm bg-foreground/70" />
                  ))}
                </div>
                {target && target.inside && blockById(drag?.id ?? "") && (
                  <div
                    className={cn("pointer-events-none absolute rounded-lg border-2 border-dashed", target.ok ? "border-foreground bg-accent/40" : "border-destructive bg-destructive/20")}
                    style={{ left: colLeft(target.x), top: target.y * cell, width: dims(drag!.id).w * cell, height: dims(drag!.id).h * cell }}
                  />
                )}
                {Object.entries(placed).map(([id, p]) => (
                  <div
                    key={id}
                    onPointerDown={(e) => startDrag(id, e)}
                    className={cn("absolute cursor-grab touch-none animate-in zoom-in-90", draggingId === id && "opacity-30")}
                    style={{ left: colLeft(p.x), top: p.y * cell }}
                  >
                    {art(id)}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between px-6">
              {[0, 1].map((side) => (
                <div key={side} className="flex gap-10" style={{ width: HALF * cell - 12, justifyContent: "space-between" }}>
                  <span className="h-5 w-5 rounded-full border-4 border-foreground/85 bg-card" />
                  <span className="h-5 w-5 rounded-full border-4 border-foreground/85 bg-card" />
                </div>
              ))}
            </div>
          </div>
          )}
          <p className="mt-2 min-h-10 max-w-sm text-center text-sm font-bold text-muted-foreground">{message}</p>
        </div>

        {/* Tray */}
        <div className="space-y-5">
          <Shelf title="Barang">
            {BIG.filter((b) => !placed[b.id]).map((b) => (
              <div key={b.id} onPointerDown={(e) => startDrag(b.id, e)} className={cn("cursor-grab touch-none rounded-xl transition hover:-translate-y-0.5", draggingId === b.id && "opacity-30")}>{art(b.id)}</div>
            ))}
          </Shelf>
          <Shelf title="Pouch transparan">
            {POUCHES.filter((b) => !placed[b.id]).map((b) => (
              <div key={b.id} onPointerDown={(e) => startDrag(b.id, e)} className={cn("cursor-grab touch-none", draggingId === b.id && "opacity-30")}>{art(b.id)}</div>
            ))}
          </Shelf>
          <Shelf title="Barang kecil → masukkan ke pouch">
            {SMALLS.filter((s) => !inPouch[s.id]).map((s) => (
              <div key={s.id} onPointerDown={(e) => startDrag(s.id, e)} className={cn("cursor-grab touch-none", draggingId === s.id && "opacity-30")}>{art(s.id)}</div>
            ))}
          </Shelf>
          <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
            <Button variant="secondary" onClick={reset} disabled={zipped}>Bongkar semua</Button>
            {!zipped ? (
              <Button disabled={!allDone} onClick={() => setZipped(true)}>Resleting koper <Sparkles /></Button>
            ) : (
              <Button onClick={onWin}>Berangkat! ✈️</Button>
            )}
          </div>
        </div>
      </div>

      {drag?.moved && (
        <div className="pointer-events-none fixed z-50 rotate-2 scale-105 opacity-90" style={{ left: drag.px - drag.offX, top: drag.py - drag.offY - drag.lift }}>
          {art(drag.id, true)}
        </div>
      )}
    </div>
  );
}

function Shelf({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <strong className="mb-2 block text-xs tracking-widest text-muted-foreground">{title.toUpperCase()}</strong>
      <div className="flex min-h-14 flex-wrap items-end gap-3 rounded-2xl border-2 border-dashed border-border bg-card/60 p-3">{children}</div>
    </div>
  );
}

function ClosedSuitcase() {
  return (
    <div className="relative mt-2 flex flex-col items-center animate-in zoom-in-75 fade-in duration-700">
      {/* telescopic handle */}
      <div className="relative h-24 w-28 animate-in slide-in-from-bottom-8 duration-1000">
        <div className="absolute inset-x-0 top-0 h-5 rounded-t-xl border-4 border-foreground/85 bg-foreground/80" />
        <div className="absolute bottom-0 left-3 top-4 w-3 border-x-4 border-foreground/85 bg-muted" />
        <div className="absolute bottom-0 right-3 top-4 w-3 border-x-4 border-foreground/85 bg-muted" />
      </div>
      <div
        className="relative h-80 w-56 rounded-[32px] border-4 border-foreground/85 bg-primary shadow-[0_10px_0_var(--foreground)] sm:h-96 sm:w-64"
        style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0 22px, color-mix(in oklab, var(--foreground) 14%, transparent) 22px 26px)" }}
      >
        <div className="absolute inset-x-6 top-3 h-3 rounded-full border-2 border-foreground/70 bg-foreground/20" />
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -rotate-6 rounded-xl border-4 border-foreground/85 bg-card px-3 py-2 text-center shadow-md">
          <span className="block text-xs font-black tracking-widest">MIA'S JOURNEY</span>
          <span className="block text-sm font-black">Ready to Fly! ✈️</span>
        </div>
        <div className="absolute bottom-8 right-5 grid h-10 w-10 rotate-12 place-items-center rounded-full border-4 border-foreground/85 bg-secondary text-lg">🌻</div>
        <div className="absolute left-4 top-1/2 h-16 w-3 -translate-y-1/2 rounded-full border-2 border-foreground/70 bg-foreground/30" />
      </div>
      <div className="flex w-48 justify-between sm:w-56">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("-mt-1 h-5 w-5 rounded-full border-4 border-foreground/85 bg-card", (i === 1 || i === 2) && "opacity-60")} />
        ))}
      </div>
      <span className="mt-3 rounded-full bg-card px-4 py-1 text-lg font-black shadow">PACKED & READY! ✈️</span>
    </div>
  );
}

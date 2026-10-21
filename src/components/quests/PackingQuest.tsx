import { Sparkles } from "lucide-react";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import aksesoris from "@/assets/pack3d/aksesoris.webp";
import baju from "@/assets/pack3d/baju.webp";
import bawahan from "@/assets/pack3d/bawahan.webp";
import cemilan from "@/assets/pack3d/cemilan.webp";
import daleman from "@/assets/pack3d/daleman.webp";
import jaket from "@/assets/pack3d/jaket.webp";
import makeup from "@/assets/pack3d/makeup.webp";
import mandi from "@/assets/pack3d/mandi.webp";
import oleh from "@/assets/pack3d/oleh.webp";
import payung from "@/assets/pack3d/payung.webp";
import pouchSqBase from "@/assets/pack3d/pouch-sq-base.webp";
import pouchSqRim from "@/assets/pack3d/pouch-sq-rim.webp";
import pouchSq from "@/assets/pack3d/pouch-sq.webp";
import pouchWideBase from "@/assets/pack3d/pouch-wide-base.webp";
import pouchWideRim from "@/assets/pack3d/pouch-wide-rim.webp";
import pouchWide from "@/assets/pack3d/pouch-wide.webp";
import sepatu from "@/assets/pack3d/sepatu.webp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type Assignment, BLOCKS, BLOCK_IDS, type BlockId, COLS, DEPTH, HALF, POUCHES, POUCH_IDS, type Placed, type PouchId,
  ROWS, SMALLS, SMALL_IDS, type Small, brokenRules, contentsOf, dimsOf, hasAbove, isPouch, nearestDrop, settle, sortProblems,
  usedCap, variantFor, hashString,
} from "./packing/puzzle";

const ART: Record<string, string> = { sepatu, jaket, baju, bawahan, payung, oleh, makeup, mandi, cemilan, aksesoris, daleman };
const POUCH_ART = {
  wide: { top: pouchWide, base: pouchWideBase, rim: pouchWideRim },
  sq: { top: pouchSq, base: pouchSqBase, rim: pouchSqRim },
};
const TILT = 46;
const SORT_PENALTY_MS = 10_000;
const ZIP_PENALTY_MS = 15_000;

type Orient = 0 | 1;
type Phase = "sort" | "pack" | "zipped";
type Drag = {
  kind: "small" | "block";
  id: string;
  px: number;
  py: number;
  sx: number;
  sy: number;
  touch: boolean;
  moved: boolean;
  from: string | null; // small: id pouch asal; block: "table" | "board"
  rot: Orient;
  hover: string | null; // small: pouch di bawah jari
  target: Placed | null; // block: tempat mendarat
  overBoard: boolean;
};

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setNarrow(mq.matches);
    update();
    // Safari lama dan WebView lama belum punya addEventListener di MediaQueryList
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return narrow;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Posisi acak tapi tetap untuk tiap pemain: barang "bercecer" di meja. */
function scatter(ids: string[], seed: number, cols: number) {
  const rnd = mulberry32(seed);
  const order = [...ids].sort(() => rnd() - 0.5);
  const rows = Math.ceil(ids.length / cols);
  const out: Record<string, { left: number; top: number; rot: number }> = {};
  order.forEach((id, i) => {
    out[id] = {
      left: ((i % cols) + 0.5) / cols * 100 + (rnd() - 0.5) * 8,
      top: (Math.floor(i / cols) + 0.5) / rows * 100 + (rnd() - 0.5) * 10,
      rot: (rnd() - 0.5) * 18,
    };
  });
  return { pos: out, rows };
}

/* ---------- Slot di dalam pouch: tiap kotak = 1 slot, barang 2 slot selebar 2 kotak ---------- */
const POUCH_GRID: Record<PouchId, { cols: number; rows: number }> = { pa: { cols: 2, rows: 1 }, pb: { cols: 2, rows: 1 }, pc: { cols: 2, rows: 2 } };
// Bagian dalam gambar pouch (rasio) yang dipakai untuk kotak slot.
const POUCH_INSET = { wide: { l: 0.09, r: 0.09, t: 0.26, b: 0.1 }, sq: { l: 0.11, r: 0.11, t: 0.2, b: 0.1 } };
type SlotBox = { id: Small; x: number; y: number; w: number; h: number };
function slotLayout(p: PouchId, items: Small[], w: number, h: number) {
  const { cols, rows } = POUCH_GRID[p];
  const ins = POUCH_INSET[p === "pc" ? "sq" : "wide"];
  const ix = w * ins.l, iy = h * ins.t, iw = w * (1 - ins.l - ins.r), ih = h * (1 - ins.t - ins.b);
  const cw = iw / cols, ch = ih / rows;
  const cells: { x: number; y: number; w: number; h: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: ix + c * cw, y: iy + r * ch, w: cw, h: ch });
  const taken = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const boxes: SlotBox[] = [];
  // barang 2 slot dulu (satu baris penuh), lalu barang 1 slot mengisi sisa kotak
  const order = [...items].sort((a, b) => SMALLS[b].size - SMALLS[a].size);
  for (const id of order) {
    const span = SMALLS[id].size;
    search: for (let r = 0; r < rows; r++) {
      for (let c = 0; c + span <= cols; c++) {
        if (taken[r]!.slice(c, c + span).some(Boolean)) continue;
        for (let k = 0; k < span; k++) taken[r]![c + k] = true;
        boxes.push({ id, x: ix + c * cw, y: iy + r * ch, w: span * cw, h: ch });
        break search;
      }
    }
  }
  return { cells, boxes };
}

const pouchKind = (id: PouchId) => (id === "pc" ? "sq" : "wide");
const nameOf = (id: string, assign: Assignment) => {
  if (id in SMALLS) return SMALLS[id as Small].name;
  const b = BLOCKS[id as BlockId];
  if (isPouch(id as BlockId)) {
    const c = contentsOf(assign, id as PouchId);
    return c.length ? `${b.name}: ${c.map((s) => SMALLS[s].name).join(" + ")}` : b.name;
  }
  return b.name;
};

/* ---------- Gambar datar (meja, pouch fase 1, bayangan jari) ---------- */
function FlatSmall({ id, size, className, style, onPointerDown }: { id: Small; size: number; className?: string; style?: CSSProperties; onPointerDown?: (e: ReactPointerEvent) => void }) {
  return (
    <div className={cn("pk-flat", className)} style={{ width: size, height: size, ...style }} onPointerDown={onPointerDown} data-small={id} title={SMALLS[id].name}>
      <img src={ART[id]} alt={SMALLS[id].name} draggable={false} className="h-full w-full object-contain" />
      <span className="pk-pips">{SMALLS[id].size} slot</span>
    </div>
  );
}

function FlatBlock({ id, assign, px, rot, className, style, onPointerDown, label = true }: { id: BlockId; assign: Assignment; px: number; rot: Orient; className?: string; style?: CSSProperties; onPointerDown?: (e: ReactPointerEvent) => void; label?: boolean }) {
  const b = BLOCKS[id];
  const d = dimsOf(id, rot);
  const w = b.w * px, h = b.l * px;
  return (
    <div className={cn("pk-flat", className)} style={{ width: d.w * px, height: d.l * px, ...style }} onPointerDown={onPointerDown} data-block={id} title={nameOf(id, assign)}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: w, height: h, transform: `translate(-50%,-50%) rotate(${rot * 90}deg)` }}>
        {isPouch(id) ? (
          <>
            <img src={POUCH_ART[pouchKind(id)].top} alt="" draggable={false} className="h-full w-full object-contain" />
            {slotLayout(id as PouchId, contentsOf(assign, id), w, h).boxes.map((c) => (
              <img key={c.id} src={ART[c.id]} alt="" draggable={false} className="absolute object-contain" style={{ left: c.x + c.w * 0.05, top: c.y + c.h * 0.05, width: c.w * 0.9, height: c.h * 0.9 }} />
            ))}
          </>
        ) : (
          <img src={ART[id]} alt="" draggable={false} className="h-full w-full object-contain" />
        )}
      </div>
      {label && <span className="pk-label">{isPouch(id) ? `Pouch (${contentsOf(assign, id).length})` : b.name}</span>}
    </div>
  );
}

/* ---------- Balok 3D di dalam koper: lapisan gambar yang ditumpuk supaya punya tebal ---------- */
function Block3D({ p, assign, cell, unit, gap, dim, onPointerDown }: { p: Placed; assign: Assignment; cell: number; unit: number; gap: number; dim: boolean; onPointerDown: (e: ReactPointerEvent) => void }) {
  const b = BLOCKS[p.id];
  const d = dimsOf(p.id, p.rot);
  const pouch = isPouch(p.id);
  const base = p.z * unit;
  const height = (pouch ? 0.9 : b.t) * unit;
  const w = b.w * cell, h = b.l * cell;
  const n = Math.max(3, Math.round(height / 2));
  const left = p.x * cell + (p.x >= HALF ? gap : 0);
  const art = pouch ? POUCH_ART[pouchKind(p.id as PouchId)] : null;
  const items = pouch ? contentsOf(assign, p.id as PouchId) : [];
  const pad = pouch ? 0.04 : p.id === "jaket" ? 0.03 : 0.08;

  return (
    <div className="pk3-item" data-block={p.id} onPointerDown={onPointerDown} title={nameOf(p.id, assign)}
      style={{ left, top: p.y * cell, width: d.w * cell, height: d.l * cell, opacity: dim ? 0.35 : 1 }}>
      <div className="pk3-orient" style={{ width: w, height: h, transform: `translate(-50%,-50%) rotate(${p.rot * 90}deg)` }}>
        <img className="pk3-layer pk3-shadow" draggable={false} src={art ? art.top : ART[p.id]} alt="" style={{ transform: `translateZ(${base + 0.6}px) translate(${4 + base / 8}px,${5 + base / 7}px) scale(${1 - pad})` }} />
        {Array.from({ length: n + 1 }, (_, i) => {
          const f = i / n;
          const top = i === n, bottom = i === 0;
          const s = pouch ? 1 - 0.075 * Math.pow(Math.abs(2 * f - 1), 2.2) : 1;
          const src = art ? (top ? art.top : bottom ? art.base : art.rim) : ART[p.id];
          return (
            <img key={i} className="pk3-layer" draggable={false} src={src} alt=""
              style={{ transform: `translateZ(${base + height * f}px) scale(${s * (1 - pad)})`, filter: top ? undefined : `brightness(${0.7 + 0.2 * f}) saturate(.92)`, opacity: pouch && !top && !bottom ? 0.9 : 1 }} />
          );
        })}
        {pouch && slotLayout(p.id as PouchId, items, w, h).boxes.map((c) => (
          <img key={c.id} className="pk3-layer" draggable={false} src={ART[c.id]} alt="" style={{ left: c.x + c.w * 0.05, top: c.y + c.h * 0.05, width: c.w * 0.9, height: c.h * 0.9, right: "auto", bottom: "auto", transform: `translateZ(${base + height * 0.42}px)`, filter: "drop-shadow(2px 3px 0 rgba(60,35,0,.28))" }} />
        ))}
      </div>
      {pouch && items.length > 0 && (
        <div className="pk3-badge" style={{ transform: `translateZ(${base + height + 6}px) rotateX(-${TILT}deg)` }}>{items.length}</div>
      )}
    </div>
  );
}

export function PackingQuest({ onWin, usn, onPenalty }: { onWin: () => void; usn?: string | null; onPenalty?: (ms: number) => void }) {
  const narrow = useNarrow();
  const cell = narrow ? 46 : 70;
  const unit = narrow ? 17 : 26;
  const gap = narrow ? 14 : 24;
  const floorW = COLS * cell + gap;
  const floorH = ROWS * cell;
  const stageH = Math.round((floorH + 36) * 0.72 + DEPTH * unit + 20);
  const tableScale = narrow ? 0.56 : 0.6;

  const variant = useMemo(() => variantFor(usn), [usn]);
  const seed = useMemo(() => hashString(`${usn ?? ""}-pack`), [usn]);
  const smallScatter = useMemo(() => scatter(SMALL_IDS, seed, narrow ? 3 : 5), [seed, narrow]);
  const blockScatter = useMemo(() => scatter(BLOCK_IDS, seed + 7, narrow ? 3 : 5), [seed, narrow]);

  const [phase, setPhase] = useState<Phase>("sort");
  const [assign, setAssign] = useState<Assignment>({});
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [rots, setRots] = useState<Partial<Record<BlockId, Orient>>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const [msg, setMsg] = useState("");
  const [shaking, setShaking] = useState(false);

  const S = useRef({ phase, assign, placed, rots, drag, cell });
  S.current = { phase, assign, placed, rots, drag, cell };
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (shakeTimer.current) clearTimeout(shakeTimer.current); }, []);

  const shake = () => {
    setShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 520);
  };

  /* ----- hit test ----- */
  const computeSmallHover = (px: number, py: number) => {
    const el = document.elementsFromPoint(px, py).find((e) => e instanceof HTMLElement && e.dataset["pouch"]);
    return el instanceof HTMLElement ? (el.dataset["pouch"] ?? null) : null;
  };
  const computeTarget = (d: Drag): { target: Placed | null; overBoard: boolean } => {
    const ay = d.py - (d.touch ? 60 : 0);
    const el = document.elementsFromPoint(d.px, ay).find((e) => e instanceof HTMLElement && e.dataset["cell"]);
    if (!(el instanceof HTMLElement)) return { target: null, overBoard: false };
    const [cx, cy] = (el.dataset["cell"] ?? "0,0").split(",").map(Number) as [number, number];
    const r = el.getBoundingClientRect();
    const fx = cx + Math.min(1, Math.max(0, (d.px - r.left) / r.width));
    const fy = cy + Math.min(1, Math.max(0, (ay - r.top) / r.height));
    const others = settle(S.current.placed.filter((p) => p.id !== d.id));
    return { target: nearestDrop(others, d.id as BlockId, d.rot, fx, fy), overBoard: true };
  };

  /* ----- mulai seret ----- */
  const beginSmall = (e: ReactPointerEvent, id: Small, from: PouchId | null) => {
    if (S.current.phase !== "sort") return;
    e.preventDefault();
    setMsg("");
    const d: Drag = { kind: "small", id, px: e.clientX, py: e.clientY, sx: e.clientX, sy: e.clientY, touch: e.pointerType === "touch", moved: false, from, rot: 0, hover: null, target: null, overBoard: false };
    S.current.drag = d;
    setDrag(d);
  };
  const beginBlock = (e: ReactPointerEvent, id: BlockId, from: "table" | "board") => {
    if (S.current.phase !== "pack") return;
    e.preventDefault();
    const cur = S.current.placed.find((p) => p.id === id);
    if (from === "board" && cur && hasAbove(S.current.placed, cur)) {
      setMsg("Ada barang di atasnya. Angkat yang di atas dulu.");
      return;
    }
    setMsg("");
    const rot = from === "board" && cur ? cur.rot : (S.current.rots[id] ?? 0);
    const d: Drag = { kind: "block", id, px: e.clientX, py: e.clientY, sx: e.clientX, sy: e.clientY, touch: e.pointerType === "touch", moved: false, from, rot, hover: null, target: null, overBoard: false };
    S.current.drag = d;
    setDrag(d);
  };

  /* ----- selesai seret ----- */
  const finishSmall = (d: Drag) => {
    const id = d.id as Small;
    const { assign: cur } = S.current;
    if (!d.moved) {
      if (d.from) setAssign((a) => { const n = { ...a }; delete n[id]; return n; }); // ketuk isi pouch = keluarkan
      return;
    }
    if (d.hover) {
      const p = d.hover as PouchId;
      const without = { ...cur };
      delete without[id];
      if (usedCap(without, p) + SMALLS[id].size > POUCHES[p].cap) {
        setMsg(`${POUCHES[p].name} tinggal ${POUCHES[p].cap - usedCap(without, p)} slot, sedangkan ${SMALLS[id].name} butuh ${SMALLS[id].size} slot.`);
        shake();
        return;
      }
      setAssign({ ...without, [id]: p });
    } else if (d.from) {
      setAssign((a) => { const n = { ...a }; delete n[id]; return n; });
    }
  };

  const rotateInPlace = (id: BlockId) => {
    const cur = S.current.placed.find((p) => p.id === id);
    if (!cur) return;
    if (hasAbove(S.current.placed, cur)) { setMsg("Ada barang di atasnya, tidak bisa diputar."); return; }
    const d = dimsOf(id, cur.rot);
    const others = settle(S.current.placed.filter((p) => p.id !== id));
    const next = nearestDrop(others, id, (1 - cur.rot) as Orient, cur.x + d.w / 2, cur.y + d.l / 2);
    if (!next) { setMsg("Tidak muat kalau diputar di sini."); shake(); return; }
    setPlaced(settle([...others, next]));
    setRots((r) => ({ ...r, [id]: next.rot }));
    setMsg("");
  };

  const finishBlock = (d: Drag) => {
    const id = d.id as BlockId;
    if (!d.moved) {
      if (d.from === "table") setRots((r) => ({ ...r, [id]: (1 - (r[id] ?? 0)) as Orient }));
      else rotateInPlace(id);
      return;
    }
    const others = settle(S.current.placed.filter((p) => p.id !== id));
    if (d.target) {
      setPlaced(settle([...others, d.target]));
      setRots((r) => ({ ...r, [id]: d.rot }));
      setMsg("");
    } else if (d.overBoard) {
      setMsg("Tidak muat di situ. Coba arah lain (tekan R atau ketuk barang untuk memutar), atau tumpuk di tempat lain.");
      shake();
    } else if (d.from === "board") {
      setPlaced(others); // dibawa keluar koper
    }
  };

  /* ----- listener global selama menyeret ----- */
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = S.current.drag;
      if (!d) return;
      const moved = d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6;
      let next: Drag = { ...d, px: e.clientX, py: e.clientY, moved };
      if (moved) {
        if (d.kind === "small") next = { ...next, hover: computeSmallHover(e.clientX, e.clientY) };
        else next = { ...next, ...computeTarget(next) };
      }
      S.current.drag = next;
      setDrag(next);
    };
    const up = () => {
      const d = S.current.drag;
      S.current.drag = null;
      setDrag(null);
      if (!d) return;
      if (d.kind === "small") finishSmall(d); else finishBlock(d);
    };
    const key = (e: KeyboardEvent) => {
      const d = S.current.drag;
      if (!d || d.kind !== "block" || !(e.key === "r" || e.key === "R" || e.key === " ")) return;
      e.preventDefault();
      let next: Drag = { ...d, rot: (1 - d.rot) as Orient };
      if (next.moved) next = { ...next, ...computeTarget(next) };
      S.current.drag = next;
      setDrag(next);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  /* ----- tombol ----- */
  const allSorted = SMALL_IDS.every((s) => assign[s]);
  const closePouches = () => {
    const pr = sortProblems(assign, variant);
    if (pr.broken > 0) {
      onPenalty?.(SORT_PENALTY_MS);
      setMsg(`${pr.broken} catatan Mia soal pouch belum terpenuhi. Waktu bertambah 10 detik.`);
      shake();
      return;
    }
    setPlaced([]);
    setRots({});
    setMsg("Pouch beres! Sekarang susun semuanya ke koper.");
    setPhase("pack");
  };
  const reopenPouches = () => {
    setPlaced([]);
    setRots({});
    setMsg("");
    setPhase("sort");
  };
  const zip = () => {
    const broken = brokenRules(placed, variant, assign);
    if (broken > 0) {
      onPenalty?.(ZIP_PENALTY_MS);
      setMsg(`Resleting macet! ${broken} dari ${variant.rules.length} catatan Mia belum terpenuhi. Waktu bertambah 15 detik.`);
      shake();
      return;
    }
    setMsg("");
    setPhase("zipped");
  };

  /* ----- layar bersih setelah diresletingkan ----- */
  if (phase === "zipped") {
    return (
      <div className="mt-6 flex min-h-[62vh] select-none flex-col items-center justify-center px-2 pb-6">
        <div className="packed-zoom"><ClosedSuitcase /></div>
        <Button className="packed-cta mt-7" size="lg" onClick={onWin}>Berangkat! ✈️</Button>
      </div>
    );
  }

  const unplaced = BLOCK_IDS.filter((id) => !placed.some((p) => p.id === id));
  const unassigned = SMALL_IDS.filter((s) => !assign[s]);
  const draggedId = drag?.moved ? drag.id : null;
  const smallSize = narrow ? 62 : 84;
  const smallTableH = narrow ? 210 : 190;
  const blockTableH = narrow ? 300 : 300;
  const notes = phase === "sort"
    ? ["Setiap kotak di dalam pouch = 1 slot. Pouch kecil punya 2 slot, pouch besar punya 4 slot.", "Alat mandi, cemilan, dan daleman butuh 2 slot (selebar 2 kotak). Makeup dan aksesoris butuh 1 slot.", ...variant.banTexts]
    : variant.rules.map((r) => r.text);

  return (
    <div className="pk mt-2 select-none">
      <div className="pk-layout">
        <div className="pk-main">
          {phase === "sort" ? (
            <>
              <div className="pk-section">1. Masukkan barang kecil ke pouch</div>
              <div className="pk-pouches">
                {POUCH_IDS.map((p) => {
                  const items = contentsOf(assign, p);
                  const w = 2 * (narrow ? 62 : 82);
                  const h = (p === "pc" ? 2 : 1) * (narrow ? 62 : 82);
                  const { cells, boxes } = slotLayout(p, items, w, h);
                  const dragSmall = drag?.kind === "small" && drag.moved && drag.hover === p ? (drag.id as Small) : null;
                  const withoutDragged = { ...assign };
                  if (dragSmall) delete withoutDragged[dragSmall];
                  const hoverFit = dragSmall ? usedCap(withoutDragged, p) + SMALLS[dragSmall].size <= POUCHES[p].cap : null;
                  return (
                    <div key={p} data-pouch={p} className={cn("pk-pouch", hoverFit === true && "pk-hover", hoverFit === false && "pk-nofit")} style={{ width: w, height: h }}>
                      <img src={POUCH_ART[pouchKind(p)].top} alt={POUCHES[p].name} draggable={false} className="pointer-events-none h-full w-full object-contain" />
                      {cells.map((c, i) => <span key={i} className="pk-slot" style={{ left: c.x, top: c.y, width: c.w, height: c.h }} />)}
                      {boxes.map((c) => (
                        <span key={c.id} className="pk-slotbg" style={{ left: c.x + 2, top: c.y + 2, width: c.w - 4, height: c.h - 4 }} />
                      ))}
                      {boxes.map((c) => (
                        <img key={c.id} src={ART[c.id]} alt={SMALLS[c.id].name} title={SMALLS[c.id].name} draggable={false} className="pk-incontent" data-small={c.id}
                          style={{ left: c.x + c.w * 0.06, top: c.y + c.h * 0.06, width: c.w * 0.88, height: c.h * 0.88, opacity: draggedId === c.id ? 0.25 : 1 }}
                          onPointerDown={(e) => beginSmall(e, c.id, p)} />
                      ))}
                      <span className={cn("pk-cap", hoverFit === false && "pk-cap-bad")}>{hoverFit === false ? "slot kurang" : `${usedCap(assign, p)}/${POUCHES[p].cap} slot`}</span>
                    </div>
                  );
                })}
              </div>
              <div className={cn("pk-table", shaking && "pk-shake")} style={{ height: unassigned.length === 0 ? 64 : smallTableH }}>
                {unassigned.length === 0 && <span className="pk-empty">Semua barang sudah masuk pouch</span>}
                {unassigned.map((s) => {
                  const pos = smallScatter.pos[s];
                  return pos ? (
                    <FlatSmall key={s} id={s} size={smallSize} onPointerDown={(e) => beginSmall(e, s, null)}
                      style={{ left: `${pos.left}%`, top: `${pos.top}%`, transform: `translate(-50%,-50%) rotate(${pos.rot}deg)`, opacity: draggedId === s ? 0.25 : 1 }} />
                  ) : null;
                })}
              </div>
            </>
          ) : (
            <>
              <div className="pk-section">2. Susun semuanya ke koper (bisa ditumpuk 2 lapis)</div>
              <div className="pk3-stage" style={{ height: stageH, ["--cell" as string]: `${cell}px`, ["--unit" as string]: `${unit}px`, ["--gap" as string]: `${gap}px`, ["--tilt" as string]: `${TILT}deg` } as CSSProperties}>
                <div className="pk3-tilt">
                  <div className={cn("pk3-case", shaking && "pk-shake")}>
                    <div className="pk3-floor" style={{ width: floorW, height: floorH }}>
                      {[0, 1].map((side) => (
                        <div key={side} className="pk3-half" style={{ left: side ? HALF * cell + gap : 0, width: HALF * cell, height: floorH }} />
                      ))}
                      <div className="pk3-hinge" style={{ left: HALF * cell, width: gap }}>{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>
                      <div className="pk3-wall pk3-back" /><div className="pk3-wall pk3-left" /><div className="pk3-wall pk3-right" />
                      {Array.from({ length: COLS * ROWS }, (_, i) => {
                        const x = i % COLS, y = Math.floor(i / COLS);
                        return <div key={i} className="pk3-cell" data-cell={`${x},${y}`} style={{ left: x * cell + (x >= HALF ? gap : 0), top: y * cell, width: cell, height: cell }} />;
                      })}
                      {placed.map((p) => (
                        <Block3D key={p.id} p={p} assign={assign} cell={cell} unit={unit} gap={gap} dim={draggedId === p.id} onPointerDown={(e) => beginBlock(e, p.id, "board")} />
                      ))}
                      {drag?.kind === "block" && drag.moved && (() => {
                        const t = drag.target;
                        const d = t ? dimsOf(t.id, t.rot) : null;
                        return t && d ? (
                          <div className="pk3-landing" style={{ left: t.x * cell + (t.x >= HALF ? gap : 0), top: t.y * cell, width: d.w * cell, height: d.l * cell, transform: `translateZ(${(t.z + d.t) * unit}px)` }} />
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pk-table" style={{ height: unplaced.length === 0 ? 64 : blockTableH }}>
                {unplaced.length === 0 && <span className="pk-empty">Semua barang sudah di dalam koper</span>}
                {unplaced.map((id) => {
                  const pos = blockScatter.pos[id];
                  return pos ? (
                    <FlatBlock key={id} id={id} assign={assign} px={cell * tableScale} rot={rots[id] ?? 0} onPointerDown={(e) => beginBlock(e, id, "table")}
                      style={{ left: `${pos.left}%`, top: `${pos.top}%`, transform: `translate(-50%,-50%) rotate(${pos.rot}deg)`, opacity: draggedId === id ? 0.25 : 1 }} />
                  ) : null;
                })}
              </div>
            </>
          )}
          <p className="pk-msg" role="status" aria-live="polite">{msg || (phase === "sort" ? "Seret barang ke pouch. Ketuk isi pouch untuk mengeluarkannya." : "Seret barang ke koper. Ketuk barang atau tekan R untuk memutar.")}</p>
          <div className="pk-actions">
            {phase === "sort" ? (
              <Button disabled={!allSorted} onClick={closePouches}>Tutup semua pouch <Sparkles /></Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => { setPlaced([]); setRots({}); setMsg(""); }}>Bongkar semua</Button>
                <Button variant="secondary" onClick={reopenPouches}>Ubah isi pouch</Button>
                <Button disabled={placed.length < BLOCK_IDS.length} onClick={zip}>Resleting koper <Sparkles /></Button>
              </>
            )}
          </div>
        </div>
        <aside className="pk-notes">
          <h3>CATATAN MIA</h3>
          <ol>{notes.map((n, i) => <li key={i}>{n}</li>)}</ol>
        </aside>
      </div>
      {drag?.moved && createPortal(
        <div className="pk-ghost" style={{ left: drag.px, top: drag.py - (drag.touch ? 60 : 0) }}>
          {drag.kind === "small"
            ? <FlatSmall id={drag.id as Small} size={smallSize} />
            : <FlatBlock id={drag.id as BlockId} assign={assign} px={cell * 0.62} rot={drag.rot} label={false} />}
          <span className="pk-ghost-name">{nameOf(drag.id, assign)}</span>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ClosedSuitcase() {
  return (
    <div className="relative mt-2 flex flex-col items-center">
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

// Logika puzzle packing: murni TypeScript (tanpa React) supaya bisa diuji dan diverifikasi dengan solver.

export const COLS = 6;
export const ROWS = 4;
export const HALF = 3; // kolom 0-2 = sisi kiri koper, kolom 3-5 = sisi kanan (lipatan di tengah)
export const DEPTH = 2; // koper bisa ditumpuk sampai 2 lapis

export type Tag =
  | "kotor" | "tebal" | "bersih" | "basah" | "rapuh"
  | "kosmetik" | "perhiasan" | "cairan" | "makanan" | "pribadi";

/* ---------- Barang kecil yang harus masuk pouch dulu ---------- */
export type Small = "makeup" | "mandi" | "cemilan" | "aksesoris" | "daleman";
export const SMALL_IDS: Small[] = ["makeup", "mandi", "cemilan", "aksesoris", "daleman"];
export const SMALLS: Record<Small, { name: string; size: number; tag: Tag }> = {
  makeup: { name: "Makeup", size: 1, tag: "kosmetik" },
  aksesoris: { name: "Aksesoris", size: 1, tag: "perhiasan" },
  mandi: { name: "Alat mandi", size: 2, tag: "cairan" },
  cemilan: { name: "Cemilan", size: 2, tag: "makanan" },
  daleman: { name: "Daleman", size: 2, tag: "pribadi" },
};

export type PouchId = "pa" | "pb" | "pc";
export const POUCH_IDS: PouchId[] = ["pa", "pb", "pc"];
export const POUCHES: Record<PouchId, { name: string; cap: number }> = {
  pa: { name: "Pouch kecil A", cap: 2 },
  pb: { name: "Pouch kecil B", cap: 2 },
  pc: { name: "Pouch besar", cap: 4 },
};
export type Assignment = Partial<Record<Small, PouchId>>;

/* ---------- Blok yang disusun di koper ---------- */
export type BlockId = "sepatu" | "jaket" | "baju" | "bawahan" | "payung" | "oleh" | PouchId;
export const BLOCK_IDS: BlockId[] = ["sepatu", "jaket", "baju", "bawahan", "payung", "oleh", "pa", "pb", "pc"];
export const BLOCKS: Record<BlockId, { name: string; w: number; l: number; t: number; tags: Tag[] }> = {
  sepatu: { name: "Sepatu", w: 2, l: 2, t: 2, tags: ["kotor"] },
  jaket: { name: "Jaket tebal", w: 3, l: 2, t: 2, tags: ["tebal"] },
  baju: { name: "Baju", w: 2, l: 3, t: 1, tags: ["bersih"] },
  bawahan: { name: "Bawahan", w: 2, l: 3, t: 1, tags: ["bersih"] },
  payung: { name: "Payung", w: 3, l: 1, t: 1, tags: ["basah"] },
  oleh: { name: "Oleh-oleh", w: 2, l: 1, t: 1, tags: ["rapuh"] },
  pa: { name: "Pouch kecil A", w: 2, l: 1, t: 1, tags: [] },
  pb: { name: "Pouch kecil B", w: 2, l: 1, t: 1, tags: [] },
  pc: { name: "Pouch besar", w: 2, l: 2, t: 1, tags: [] },
};

export const isPouch = (id: BlockId): id is PouchId => id === "pa" || id === "pb" || id === "pc";

export const contentsOf = (assign: Assignment, pouch: PouchId): Small[] => SMALL_IDS.filter((s) => assign[s] === pouch);

export function tagsOf(id: BlockId, assign: Assignment): Tag[] {
  if (!isPouch(id)) return BLOCKS[id].tags;
  return contentsOf(assign, id).map((s) => SMALLS[s].tag);
}

/* ---------- Aturan (catatan Mia) ---------- */
export type Rule =
  | { k: "floor"; tag: Tag; text: string }
  | { k: "free"; tag: Tag; text: string }
  | { k: "high"; tag: Tag; text: string }
  | { k: "apart"; a: Tag; b: Tag; text: string }
  | { k: "side"; tag: Tag; half: "kiri" | "kanan"; text: string };

export type Variant = {
  id: number;
  bans: [Small, Small][]; // pasangan yang tidak boleh sekantong pouch
  banTexts: string[];
  rules: Rule[];
};

const BAN = {
  "mandi|cemilan": "Alat mandi jangan sekantong dengan cemilan, nanti bocor dan lengket.",
  "mandi|daleman": "Daleman jangan satu pouch dengan alat mandi, takut basah.",
  "mandi|makeup": "Makeup dan alat mandi pisahkan ya, botolnya suka tumpah.",
  "mandi|aksesoris": "Aksesoris jangan campur dengan cairan, nanti kusam.",
  "cemilan|daleman": "Cemilan dan daleman tidak boleh satu pouch, bau makanannya nempel.",
  "cemilan|makeup": "Cemilan jangan sepouch dengan makeup, remahnya ke mana-mana.",
  "cemilan|aksesoris": "Aksesoris jangan ketemu cemilan, nanti lengket.",
  "daleman|makeup": "Makeup dan daleman dipisah saja, biar rapi.",
  "daleman|aksesoris": "Aksesoris jangan disatukan dengan daleman, gampang tersangkut.",
} as const;
const ban = (a: Small, b: Small): [Small, Small] => [a, b];
const banText = (a: Small, b: Small) => (BAN as Record<string, string>)[`${a}|${b}`] ?? (BAN as Record<string, string>)[`${b}|${a}`] ?? "";

const R = {
  sepatuDasar: { k: "floor", tag: "kotor", text: "Sepatuku berat dan kotor, simpan di dasar koper ya." } as Rule,
  jaketDasar: { k: "floor", tag: "tebal", text: "Jaket tebalnya berat, taruh paling bawah." } as Rule,
  jaketKiri: { k: "side", tag: "tebal", half: "kiri", text: "Jaket tebal di sisi kiri koper biar seimbang." } as Rule,
  jaketKanan: { k: "side", tag: "tebal", half: "kanan", text: "Jaket tebal di sisi kanan koper, kiri mau kupakai buat yang lain." } as Rule,
  cairanBebas: { k: "free", tag: "cairan", text: "Pouch yang ada cairannya jangan ditindih apa pun, nanti bocor." } as Rule,
  rapuhBebas: { k: "free", tag: "rapuh", text: "Oleh-oleh batik itu rapuh, jangan sampai ada yang menimpa." } as Rule,
  kosmetikBebas: { k: "free", tag: "kosmetik", text: "Pouch makeup gampang pecah, jangan ditindih." } as Rule,
  payungAtas: { k: "high", tag: "basah", text: "Payung masih basah, taruh di atas biar gampang diambil." } as Rule,
  kotorJauh: { k: "apart", a: "kotor", b: "bersih", text: "Sepatu kotor jangan sampai nempel baju atau bawahan bersih." } as Rule,
  basahJauh: { k: "apart", a: "basah", b: "bersih", text: "Payung basah jangan sampai kena pakaian bersih." } as Rule,
  cairanJauhMakan: { k: "apart", a: "cairan", b: "makanan", text: "Pouch cairan jangan nempel pouch makanan." } as Rule,
  pribadiKanan: { k: "side", tag: "pribadi", half: "kanan", text: "Pouch daleman di sisi kanan, biar gampang dicari." } as Rule,
  makananAtas: { k: "high", tag: "makanan", text: "Pouch cemilan taruh di atas, nanti kuambil di jalan." } as Rule,
  perhiasanBebas: { k: "free", tag: "perhiasan", text: "Pouch aksesoris jangan ditindih, takut penyok." } as Rule,
};

export const VARIANTS: Variant[] = [
  { id: 0, bans: [ban("mandi", "cemilan"), ban("mandi", "daleman"), ban("cemilan", "daleman")], banTexts: [], rules: [R.sepatuDasar, R.cairanBebas, R.rapuhBebas, R.payungAtas, R.kotorJauh] },
  { id: 1, bans: [ban("mandi", "makeup"), ban("cemilan", "aksesoris"), ban("mandi", "daleman")], banTexts: [], rules: [R.jaketDasar, R.kosmetikBebas, R.rapuhBebas, R.basahJauh, R.pribadiKanan] },
  { id: 2, bans: [ban("mandi", "cemilan"), ban("daleman", "makeup"), ban("cemilan", "aksesoris")], banTexts: [], rules: [R.sepatuDasar, R.jaketKiri, R.cairanBebas, R.makananAtas, R.kotorJauh] },
  { id: 3, bans: [ban("mandi", "aksesoris"), ban("cemilan", "daleman"), ban("mandi", "makeup")], banTexts: [], rules: [R.jaketDasar, R.perhiasanBebas, R.rapuhBebas, R.payungAtas, R.cairanJauhMakan] },
  { id: 4, bans: [ban("cemilan", "makeup"), ban("mandi", "daleman"), ban("daleman", "aksesoris")], banTexts: [], rules: [R.sepatuDasar, R.jaketKanan, R.kosmetikBebas, R.basahJauh, R.makananAtas] },
  { id: 5, bans: [ban("mandi", "cemilan"), ban("cemilan", "daleman"), ban("mandi", "aksesoris")], banTexts: [], rules: [R.jaketDasar, R.cairanBebas, R.perhiasanBebas, R.payungAtas, R.kotorJauh] },
].map((v) => ({ ...v, banTexts: v.bans.map(([a, b]) => banText(a, b)) }));

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export const variantFor = (usn: string | null | undefined): Variant => VARIANTS[hashString((usn ?? "").toLowerCase()) % VARIANTS.length] ?? VARIANTS[0]!;

/* ---------- Fase 1: memilah ke pouch ---------- */
export function sortProblems(assign: Assignment, variant: Variant): { overfull: boolean; unassigned: boolean; broken: number } {
  const unassigned = SMALL_IDS.some((s) => !assign[s]);
  let overfull = false;
  for (const p of POUCH_IDS) {
    const used = contentsOf(assign, p).reduce((n, s) => n + SMALLS[s].size, 0);
    if (used > POUCHES[p].cap) overfull = true;
  }
  const broken = variant.bans.filter(([a, b]) => assign[a] && assign[a] === assign[b]).length;
  return { overfull, unassigned, broken };
}
export const usedCap = (assign: Assignment, p: PouchId) => contentsOf(assign, p).reduce((n, s) => n + SMALLS[s].size, 0);

/* ---------- Fase 2: susun koper ---------- */
export type Placed = { id: BlockId; x: number; y: number; rot: 0 | 1; z: number };

export const dimsOf = (id: BlockId, rot: 0 | 1) => {
  const b = BLOCKS[id];
  return rot === 0 ? { w: b.w, l: b.l, t: b.t } : { w: b.l, l: b.w, t: b.t };
};

export function heightMap(placed: Placed[]): number[] {
  const h = new Array<number>(COLS * ROWS).fill(0);
  for (const p of placed) {
    const d = dimsOf(p.id, p.rot);
    for (let yy = p.y; yy < p.y + d.l; yy++) for (let xx = p.x; xx < p.x + d.w; xx++) h[yy * COLS + xx] = Math.max(h[yy * COLS + xx] ?? 0, p.z + d.t);
  }
  return h;
}

/** Hasil jatuh blok ke koper: null kalau tidak muat. */
export function drop(placed: Placed[], id: BlockId, x: number, y: number, rot: 0 | 1): Placed | null {
  const d = dimsOf(id, rot);
  if (x < 0 || y < 0 || x + d.w > COLS || y + d.l > ROWS) return null;
  if (x < HALF && x + d.w > HALF) return null; // tidak boleh menyeberangi lipatan
  const h = heightMap(placed);
  let z = 0;
  for (let yy = y; yy < y + d.l; yy++) for (let xx = x; xx < x + d.w; xx++) z = Math.max(z, h[yy * COLS + xx] ?? 0);
  if (z + d.t > DEPTH) return null;
  return { id, x, y, rot, z };
}

/** Setelah ada yang diangkat, barang di atasnya turun lagi. */
export function settle(placed: Placed[]): Placed[] {
  const order = [...placed].sort((a, b) => a.z - b.z || BLOCK_IDS.indexOf(a.id) - BLOCK_IDS.indexOf(b.id));
  const out: Placed[] = [];
  for (const p of order) {
    const r = drop(out, p.id, p.x, p.y, p.rot);
    if (!r) return placed; // tidak seharusnya terjadi
    out.push(r);
  }
  return out;
}

export const hasAbove = (placed: Placed[], target: Placed) => placed.some((o) => o.id !== target.id && isOnTop(o, target));

const rect = (p: Placed) => {
  const d = dimsOf(p.id, p.rot);
  return { x0: p.x, x1: p.x + d.w, y0: p.y, y1: p.y + d.l, z0: p.z, z1: p.z + d.t };
};
const overlap1 = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/** a bertumpu di atas b (footprint beririsan dan a berada di atas permukaan b). */
export function isOnTop(a: Placed, b: Placed): boolean {
  const ra = rect(a), rb = rect(b);
  return overlap1(ra.x0, ra.x1, rb.x0, rb.x1) && overlap1(ra.y0, ra.y1, rb.y0, rb.y1) && ra.z0 >= rb.z1;
}

/** Bersentuhan: bertumpuk langsung, atau bersisian di lapisan yang sama (lipatan koper memisahkan kedua sisi). */
export function touching(a: Placed, b: Placed): boolean {
  const ra = rect(a), rb = rect(b);
  const xy = overlap1(ra.x0, ra.x1, rb.x0, rb.x1) && overlap1(ra.y0, ra.y1, rb.y0, rb.y1);
  if (xy) return ra.z1 === rb.z0 || rb.z1 === ra.z0;
  if (!overlap1(ra.z0, ra.z1, rb.z0, rb.z1)) return false;
  const sideX = (ra.x1 === rb.x0 && rb.x0 !== HALF || rb.x1 === ra.x0 && ra.x0 !== HALF) && overlap1(ra.y0, ra.y1, rb.y0, rb.y1);
  const sideY = (ra.y1 === rb.y0 || rb.y1 === ra.y0) && overlap1(ra.x0, ra.x1, rb.x0, rb.x1);
  return sideX || sideY;
}

const has = (id: BlockId, tag: Tag, assign: Assignment) => tagsOf(id, assign).includes(tag);

/** Apakah aturan ini dilanggar oleh penempatan `n` terhadap blok-blok `others` (dipakai solver & validasi akhir). */
export function violates(rule: Rule, n: Placed, others: Placed[], assign: Assignment): boolean {
  switch (rule.k) {
    case "floor": return has(n.id, rule.tag, assign) && n.z !== 0;
    case "high": return has(n.id, rule.tag, assign) && n.z < 1;
    case "side": {
      if (!has(n.id, rule.tag, assign)) return false;
      const r = rect(n);
      return rule.half === "kiri" ? r.x1 > HALF : r.x0 < HALF;
    }
    case "free": return others.some((o) => has(o.id, rule.tag, assign) && isOnTop(n, o));
    case "apart":
      return others.some((o) => ((has(n.id, rule.a, assign) && has(o.id, rule.b, assign)) || (has(n.id, rule.b, assign) && has(o.id, rule.a, assign))) && touching(n, o));
  }
}

/** Jumlah catatan Mia yang belum terpenuhi pada susunan akhir. */
export function brokenRules(layout: Placed[], variant: Variant, assign: Assignment): number {
  const ordered = [...layout].sort((a, b) => a.z - b.z || BLOCK_IDS.indexOf(a.id) - BLOCK_IDS.indexOf(b.id));
  return variant.rules.filter((rule) => ordered.some((n, i) => violates(rule, n, ordered.filter((_, j) => j !== i), assign))).length;
}

/** Cari posisi valid terdekat dari titik jatuh (pembulatan toleran supaya tidak susah dilepas). */
export function nearestDrop(placed: Placed[], id: BlockId, rot: 0 | 1, fx: number, fy: number): Placed | null {
  const d = dimsOf(id, rot);
  const cx = fx - d.w / 2, cy = fy - d.l / 2;
  let best: { p: Placed; dist: number } | null = null;
  for (let y = Math.floor(cy) - 1; y <= Math.ceil(cy) + 1; y++) {
    for (let x = Math.floor(cx) - 1; x <= Math.ceil(cx) + 1; x++) {
      const p = drop(placed, id, x, y, rot);
      if (!p) continue;
      const dist = (x - cx) ** 2 + (y - cy) ** 2;
      if (dist <= 2.6 && (!best || dist < best.dist)) best = { p, dist };
    }
  }
  return best?.p ?? null;
}

/* ---------- Solver (untuk verifikasi puzzle & pengujian) ---------- */
export function validAssignments(variant: Variant): Assignment[] {
  const out: Assignment[] = [];
  const walk = (i: number, cur: Assignment) => {
    if (i === SMALL_IDS.length) {
      const pr = sortProblems(cur, variant);
      if (!pr.unassigned && !pr.overfull && pr.broken === 0) out.push({ ...cur });
      return;
    }
    const s = SMALL_IDS[i]!;
    for (const p of POUCH_IDS) {
      cur[s] = p;
      if (usedCap(cur, p) <= POUCHES[p].cap) walk(i + 1, cur);
    }
    delete cur[s];
  };
  walk(0, {});
  return out;
}

export function solveLayouts(variant: Variant, assign: Assignment, cap = 2000): Placed[][] {
  const solutions: Placed[][] = [];
  const total = BLOCK_IDS.length;
  const search = (placed: Placed[], used: Set<BlockId>, lastZ: number, lastIdx: number) => {
    if (solutions.length >= cap) return;
    if (placed.length === total) { solutions.push(placed); return; }
    BLOCK_IDS.forEach((id, idx) => {
      if (used.has(id)) return;
      const rots: (0 | 1)[] = BLOCKS[id].w === BLOCKS[id].l ? [0] : [0, 1];
      for (const rot of rots) {
        const d = dimsOf(id, rot);
        for (let y = 0; y + d.l <= ROWS; y++) {
          for (let x = 0; x + d.w <= COLS; x++) {
            const p = drop(placed, id, x, y, rot);
            if (!p) continue;
            if (p.z < lastZ || (p.z === lastZ && idx < lastIdx)) continue;
            if (variant.rules.some((r) => violates(r, p, placed, assign))) continue;
            used.add(id);
            search([...placed, p], used, p.z, idx);
            used.delete(id);
          }
        }
      }
    });
  };
  search([], new Set(), 0, -1);
  return solutions;
}

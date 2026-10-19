import { Gift, Play, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { type Entry, fetchBoard, formatTime, sameName } from "@/lib/player";

const TOP = 100;
// Video hadiah. Taruh file videonya di folder public/ dengan nama hadiah.mp4 (paling rapi, tanpa nama channel YouTube).
const PRIZE_MP4 = "/hadiah.mp4";
// Cadangan kalau hadiah.mp4 tidak ada: YouTube (tidak publik). Ganti ID-nya kalau videonya diganti. Pastikan "Izinkan penyematan" aktif di YouTube Studio.
const PRIZE_VIDEO_ID = "6p-5HDIFzGs";
const PRIZE_EMBED = `https://www.youtube-nocookie.com/embed/${PRIZE_VIDEO_ID}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
const PRIZE_LINK = `https://youtube.com/shorts/${PRIZE_VIDEO_ID}`;

const rankLabel = (index: number) => (index >= TOP ? `${TOP}+` : String(index + 1));
const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank));

const prizeKey = (me: string) => `mia-golden-prize-seen:${me.toLowerCase()}`;
const readPrizeSeen = (me: string) => {
  try {
    return window.localStorage.getItem(prizeKey(me)) === "1";
  } catch {
    return false;
  }
};
const savePrizeSeen = (me: string) => {
  try {
    window.localStorage.setItem(prizeKey(me), "1");
  } catch {
    // penyimpanan diblokir: tombol tetap jalan, hanya tidak diingat
  }
};

function PrizeModal({ onClose }: { onClose: () => void }) {
  // Utamakan file video sendiri (bersih, tanpa nama channel). Kalau filenya belum ada / gagal dimuat, pakai YouTube.
  const [useYoutube, setUseYoutube] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // Kalau browser menahan autoplay, tombol play di video tetap bisa ditekan.
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <div className="prize-stage" role="dialog" aria-modal="true" aria-label="Hadiah">
      <div className="prize-card">
        <button className="prize-close" onClick={onClose} aria-label="Tutup"><X /></button>
        <small>SELAMAT! 3 POS SELESAI</small>
        <h3><Gift className="inline h-6 w-6 align-[-3px]" /> Hadiahmu</h3>
        <div className="prize-frame">
          {useYoutube ? (
            <iframe
              src={PRIZE_EMBED}
              title="Video hadiah"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <video ref={videoRef} src={PRIZE_MP4} controls autoPlay playsInline preload="auto" onError={() => setUseYoutube(true)} />
          )}
        </div>
        {useYoutube && <a className="prize-link" href={PRIZE_LINK} target="_blank" rel="noreferrer">Video tidak muncul? Buka di YouTube</a>}
        <Button onClick={onClose}>Kembali ke Leaderboard</Button>
      </div>
    </div>
  );
}

export function Leaderboard({ me, myMs, onClose }: { me: string; myMs: number | null; onClose: () => void }) {
  const [board, setBoard] = useState<{ entries: Entry[]; online: boolean } | null>(null);
  const [prizeOpen, setPrizeOpen] = useState(false);
  const [prizeSeen, setPrizeSeen] = useState(() => readPrizeSeen(me));
  const meRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchBoard().then((result) => {
      if (alive) setBoard(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Daftar panjang: langsung gulung ke baris pemain sendiri.
  useEffect(() => {
    if (board) meRef.current?.scrollIntoView?.({ block: "center" });
  }, [board]);

  const openPrize = () => {
    setPrizeOpen(true);
    setPrizeSeen(true);
    savePrizeSeen(me);
  };

  const entries = board?.entries ?? [];
  const myIndex = entries.findIndex((e) => sameName(e.name, me));
  const myEntry = myIndex >= 0 ? entries[myIndex] : undefined;
  const rows = entries.slice(0, TOP);
  const myTime = myEntry?.ms ?? myMs;

  return (
    <div className="board-stage" role="dialog" aria-modal="true" aria-label="Leaderboard">
      <div className="board-card">
        <div className="board-head">
          <small>STAGE FINAL</small>
          <h2><Trophy className="inline h-6 w-6 align-[-2px]" /> Leaderboard</h2>
          <small>WAKTU TERCEPAT MENYELESAIKAN 3 POS</small>
        </div>
        <div className="board-list">
          {!board && <p className="board-note">Memuat peringkat…</p>}
          {board && rows.length === 0 && <p className="board-note">Belum ada yang finis. Kamu yang pertama!</p>}
          {rows.map((entry, i) => (
            <div key={entry.name} ref={sameName(entry.name, me) ? meRef : undefined} className={`board-row ${sameName(entry.name, me) ? "me" : ""}`}>
              <span className="board-rank">{medal(i + 1)}</span>
              <span className="board-name">@{entry.name}</span>
              <span className="board-time">{formatTime(entry.ms)}</span>
            </div>
          ))}
          {myIndex >= TOP && <p className="board-gap">⋯</p>}
        </div>
        {/* Baris pemain sendiri selalu terlihat di bawah, seperti peringkat di Shopee. */}
        {myTime !== null && (
          <div className="board-mebar">
            <span className="board-mebar-label">PERINGKATMU</span>
            <span className="board-rank">{myIndex >= 0 ? rankLabel(myIndex) : "–"}</span>
            <span className="board-name">@{me}</span>
            <span className="board-time">{formatTime(myTime)}</span>
          </div>
        )}
        {board && !board.online && <p className="board-note">Menampilkan peringkat di perangkat ini.</p>}
        <div className="board-foot">
          <Button className="board-claim" onClick={openPrize}>
            {prizeSeen ? <><Play /> Tonton hadiah lagi</> : <><Gift /> Claim your prize</>}
          </Button>
          <Button variant="outline" onClick={onClose}>Kembali ke Peta</Button>
        </div>
      </div>
      {prizeOpen && <PrizeModal onClose={() => setPrizeOpen(false)} />}
    </div>
  );
}

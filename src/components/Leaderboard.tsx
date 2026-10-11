import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { type Entry, fetchBoard, formatTime, sameName } from "@/lib/player";

const TOP = 10;
const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank));

export function Leaderboard({ me, myMs, onClose }: { me: string; myMs: number | null; onClose: () => void }) {
  const [board, setBoard] = useState<{ entries: Entry[]; online: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchBoard().then((result) => {
      if (alive) setBoard(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  const entries = board?.entries ?? [];
  const myIndex = entries.findIndex((e) => sameName(e.name, me));
  const myEntry = myIndex >= 0 ? entries[myIndex] : undefined;
  const rows = entries.slice(0, TOP);
  const outside = myEntry && myIndex >= TOP ? myEntry : null;

  return (
    <div className="board-stage" role="dialog" aria-modal="true" aria-label="Leaderboard">
      <div className="board-card">
        <div className="board-head">
          <small>STAGE FINAL</small>
          <h2><Trophy className="inline h-6 w-6 align-[-2px]" /> Leaderboard</h2>
          <small>WAKTU TERCEPAT MENYELESAIKAN 3 POS</small>
        </div>
        {myMs !== null && (
          <p className="board-me">
            Waktumu {formatTime(myMs)}
            {myIndex >= 0 ? ` • Peringkat #${myIndex + 1}` : ""}
          </p>
        )}
        <div className="board-list">
          {!board && <p className="board-note">Memuat peringkat…</p>}
          {board && rows.length === 0 && <p className="board-note">Belum ada yang finis. Kamu yang pertama!</p>}
          {rows.map((entry, i) => (
            <div key={entry.name} className={`board-row ${sameName(entry.name, me) ? "me" : ""}`}>
              <span className="board-rank">{medal(i + 1)}</span>
              <span className="board-name">@{entry.name}</span>
              <span className="board-time">{formatTime(entry.ms)}</span>
            </div>
          ))}
          {outside && (
            <>
              <p className="board-gap">⋯</p>
              <div className="board-row me">
                <span className="board-rank">{myIndex + 1}</span>
                <span className="board-name">@{outside.name}</span>
                <span className="board-time">{formatTime(outside.ms)}</span>
              </div>
            </>
          )}
        </div>
        {board && !board.online && <p className="board-note">Menampilkan peringkat di perangkat ini.</p>}
        <div className="board-foot"><Button onClick={onClose}>Kembali ke Peta</Button></div>
      </div>
    </div>
  );
}

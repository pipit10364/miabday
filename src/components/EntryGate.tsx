import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MAX_USN, checkName, cleanUsn, formatTime, registerName } from "@/lib/player";

export function EntryGate({ onEnter }: { onEnter: (usn: string) => void }) {
  const [usn, setUsn] = useState("");
  const [checking, setChecking] = useState(false);
  const [taken, setTaken] = useState<{ ms: number | null } | null>(null);
  const valid = usn.length >= 2;

  const submit = async () => {
    if (!valid || checking) return;
    setChecking(true);
    const result = await checkName(usn);
    setChecking(false);
    if (result.taken) {
      setTaken({ ms: result.ms });
      return;
    }
    void registerName(usn);
    onEnter(usn);
  };

  return (
    <section className="gate">
      <div className="gate-inner">
        <div className="eyebrow"><Sparkles /> 20 OKTOBER • BIRTHDAY ADVENTURE</div>
        <h1 className="gate-title">MIA'S <span className="gold">GOLDEN</span><br />ADVENTURE</h1>
        {taken ? (
          <div className="gate-card" role="alertdialog" aria-label="Username sudah dipakai">
            <p className="gate-kicker">USERNAME SUDAH DIPAKAI</p>
            <p className="gate-confirm">
              <strong>@{usn}</strong> sudah pernah dipakai
              {taken.ms !== null ? ` dan sudah finis dengan waktu ${formatTime(taken.ms)}` : ""}. Apakah ini kamu yang main dari perangkat lain?
            </p>
            <div className="gate-actions">
              <Button className="w-full font-black" onClick={() => onEnter(usn)}>YA, INI AKU</Button>
              <Button
                variant="outline"
                className="w-full font-black"
                onClick={() => {
                  setTaken(null);
                  setUsn("");
                }}
              >
                BUKAN, GANTI USERNAME
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="gate-card"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label htmlFor="usn">USERNAME</label>
            <div className="gate-field">
              <span aria-hidden="true">@</span>
              <input
                id="usn"
                value={usn}
                maxLength={MAX_USN}
                onChange={(e) => setUsn(cleanUsn(e.target.value))}
                placeholder="username singkat"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
              />
            </div>
            <p className="gate-hint">Maksimal {MAX_USN} karakter, boleh huruf, angka, titik, dan garis bawah. Nama ini yang tampil di leaderboard.</p>
            <Button type="submit" className="mt-4 w-full font-black" disabled={!valid || checking}>
              {checking ? "MENGECEK…" : "MULAI PETUALANGAN"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

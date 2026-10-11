import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MAX_USN, cleanUsn } from "@/lib/player";

export function EntryGate({ onEnter }: { onEnter: (usn: string) => void }) {
  const [usn, setUsn] = useState("");
  const valid = usn.length >= 2;

  return (
    <section className="gate">
      <div className="gate-inner">
        <div className="eyebrow"><Sparkles /> 20 OKTOBER • BIRTHDAY ADVENTURE</div>
        <h1 className="gate-title">MIA'S <span className="gold">GOLDEN</span><br />ADVENTURE</h1>
        <form
          className="gate-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onEnter(usn);
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
          <Button type="submit" className="mt-4 w-full font-black" disabled={!valid}>MULAI PETUALANGAN</Button>
        </form>
      </div>
    </section>
  );
}

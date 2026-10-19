import { Download, Gift, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// Foto hadiah per pos: hadiah-1 (Jakarta), hadiah-2 (Jogja), hadiah-3 (Belanda).
// Cukup taruh filenya (hadiah-1.jpg, hadiah-2.jpg, hadiah-3.jpg) di mana saja di dalam src/assets/.
// Kalau filenya belum ada, tombol hadiah foto tidak muncul dan game tetap jalan.
const files = import.meta.glob<string>("../assets/**/hadiah-*.{jpg,jpeg,png,webp}", { eager: true, import: "default" });
const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const name = path.split("/").pop()?.replace(/\.[^.]+$/, "");
  if (name) byName[name] = url;
}

export const prizePhotoOf = (index: number): string | undefined => byName[`hadiah-${index + 1}`];

const claimKey = (me: string, index: number) => `mia-golden-photo-claimed:${me.toLowerCase()}:${index}`;
export const readClaimed = (me: string, index: number) => {
  try {
    return window.localStorage.getItem(claimKey(me, index)) === "1";
  } catch {
    return false;
  }
};
export const saveClaimed = (me: string, index: number) => {
  try {
    window.localStorage.setItem(claimKey(me, index), "1");
  } catch {
    // penyimpanan diblokir: hadiah tetap bisa dilihat, hanya statusnya tidak diingat
  }
};

export function PrizePhotoModal({ index, onClose }: { index: number; onClose: () => void }) {
  const src = prizePhotoOf(index);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pp-stage" role="dialog" aria-modal="true" aria-label="Hadiah foto">
      <div className="pp-card">
        <button className="pp-close" onClick={onClose} aria-label="Tutup"><X /></button>
        <small>HADIAH POS {index + 1}</small>
        <h3><Gift className="inline h-6 w-6 align-[-3px]" /> Foto untukmu</h3>
        <div className="pp-frame">
          {src ? <img className="pp-photo" src={src} alt={`Hadiah foto pos ${index + 1}`} draggable={false} /> : <p>Fotonya menyusul ya 🎁</p>}
        </div>
        {src && (
          <a className="pp-save" href={src} download={`mia-hadiah-${index + 1}.jpg`}>
            <Download /> Simpan foto
          </a>
        )}
        {src && <p className="pp-hint">Di iPhone: tahan lama fotonya, lalu pilih Simpan ke Foto.</p>}
        <Button variant="outline" onClick={onClose}>Tutup</Button>
      </div>
    </div>
  );
}

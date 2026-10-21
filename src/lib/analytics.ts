// Google Analytics 4 (Firebase Analytics). Tanpa npm: script gtag dimuat dari browser.
// Username pemain sengaja TIDAK dikirim ke Analytics.
export const GA_ID = "G-D9ECWNH9JB";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let started = false;

export function initAnalytics() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag wajib memasukkan objek `arguments`, bukan array biasa.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
  } catch {
    // diblokir (adblock dsb): game tetap jalan
  }
}

export function track(event: string, params?: Record<string, string | number>) {
  try {
    window.gtag?.("event", event, params);
  } catch {
    // abaikan
  }
}

import { useEffect, useState } from 'react';

const storageKey = 'paperpilot-ad-consent';

export function CookieConsent() {
  const [consent, setConsent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const configured = Boolean(import.meta.env.VITE_ADSENSE_CLIENT?.trim());

  useEffect(() => {
    setConsent(window.localStorage.getItem(storageKey));
    const showPreferences = () => setOpen(true);
    window.addEventListener('paperpilot-cookie-preferences', showPreferences);
    return () => window.removeEventListener('paperpilot-cookie-preferences', showPreferences);
  }, []);

  function choose(value: 'accepted' | 'declined') {
    window.localStorage.setItem(storageKey, value);
    setConsent(value);
    setOpen(false);
    window.dispatchEvent(new Event('paperpilot-ad-consent-change'));
  }

  if (!configured) return null;

  return (
    <>
      {open || consent === null ? (
        <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" aria-label="Advertising consent">
          <h2 className="font-bold text-slate-900">Advertising preferences</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            If you accept, configured Google AdSense scripts may use cookies or similar technologies. Declining keeps advertising scripts disabled. You can change this choice later.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => choose('accepted')} className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white">Accept advertising</button>
            <button type="button" onClick={() => choose('declined')} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Decline</button>
            <a href="/cookies-and-ads" className="inline-flex items-center px-2 text-sm font-medium text-primary-700 underline">More information</a>
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-3 left-3 z-40 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow"
        >
          Cookie preferences
        </button>
      )}
    </>
  );
}

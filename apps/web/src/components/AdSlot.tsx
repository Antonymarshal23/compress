import { useEffect, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

type AdSlotProps = {
  slot?: string;
};

export function AdSlot({ slot }: AdSlotProps) {
  const client = import.meta.env.VITE_ADSENSE_CLIENT?.trim();
  const adSlot = slot?.trim() || import.meta.env.VITE_ADSENSE_SLOT?.trim();
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const updateConsent = () => setConsent(window.localStorage.getItem('paperpilot-ad-consent') === 'accepted');
    updateConsent();
    window.addEventListener('paperpilot-ad-consent-change', updateConsent);
    return () => window.removeEventListener('paperpilot-ad-consent-change', updateConsent);
  }, []);

  useEffect(() => {
    if (!client || !adSlot || !consent) return;

    const scriptId = 'paperpilot-adsense';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      document.head.appendChild(script);
    }

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers and unavailable ad scripts should not affect page use.
    }
  }, [adSlot, client, consent]);

  if (!client || !adSlot || !consent) return null;

  return (
    <aside className="mx-auto my-8 max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Advertisement">
      <ins
        className="adsbygoogle block min-h-24"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

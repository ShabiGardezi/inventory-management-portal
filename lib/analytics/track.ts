type GtagFn = (command: 'event', eventName: string, params?: Record<string, unknown>) => void;

function getGtag(): GtagFn | undefined {
  const w = window as unknown as { gtag?: GtagFn };
  return w.gtag;
}

function getDataLayer(): Array<Record<string, unknown>> | undefined {
  const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  return w.dataLayer;
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  try {
    const gtag = getGtag();
    if (gtag) gtag('event', eventName, params);
    const dl = getDataLayer();
    if (dl) dl.push({ event: eventName, ...params });
    window.dispatchEvent(new CustomEvent('analytics:event', { detail: { eventName, params } }));
  } catch {
    // never block conversion UX
  }
}


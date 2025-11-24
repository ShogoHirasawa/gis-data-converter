declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export const initGA = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  
  if (!measurementId) return;
  if (import.meta.env.MODE !== 'production') return;
  if (typeof window === 'undefined') return;
  if (window.gtag) return;

  // Initialize dataLayer first
  window.dataLayer = window.dataLayer ?? [];
  const dataLayer = window.dataLayer;
  function gtag(...args: any[]) {
    dataLayer.push(args);
  }
  window.gtag = gtag;
  gtag('js', new Date());

  // Load the script and wait for it to load before calling config
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  
  script.onload = () => {
    // Script is loaded, now configure GA
    gtag('config', measurementId);
  };
  
  script.onerror = () => {
    console.error('Failed to load Google Analytics script');
  };
  
  document.head.appendChild(script);
};

export const trackEvent = (
  eventName: string,
  params?: Record<string, any>
) => {
  if (!import.meta.env.VITE_GA_MEASUREMENT_ID) return;
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', eventName, params);
};

export const trackPageView = (path: string) => {
  if (!import.meta.env.VITE_GA_MEASUREMENT_ID) return;
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID, {
    page_path: path,
  });
};


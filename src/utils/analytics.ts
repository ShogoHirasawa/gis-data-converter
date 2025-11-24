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

  // Initialize dataLayer (Google Analytics standard way)
  window.dataLayer = window.dataLayer || [];
  
  // Define gtag function using arguments (matches Google's official implementation)
  function gtag(...args: any[]) {
    window.dataLayer!.push(args);
  }
  window.gtag = gtag as any;
  
  gtag('js', new Date());
  // Call config BEFORE script loads - this is the official way
  // The script will process dataLayer commands when it loads
  gtag('config', measurementId);

  // Load the script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
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


declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Track page view
 * @param path - Page path (e.g., '/', '/how-to-use', '/supported-formats', '/contact')
 */
export const trackPageView = (path: string) => {
  if (!import.meta.env.VITE_GA_MEASUREMENT_ID) return;
  if (import.meta.env.MODE !== 'production') return;
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID, {
    page_path: path,
  });
};

/**
 * Track custom event
 * @param eventName - Event name
 * @param params - Event parameters
 */
export const trackEvent = (
  eventName: string,
  params?: Record<string, any>
) => {
  if (!import.meta.env.VITE_GA_MEASUREMENT_ID) return;
  if (import.meta.env.MODE !== 'production') return;
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', eventName, params);
};


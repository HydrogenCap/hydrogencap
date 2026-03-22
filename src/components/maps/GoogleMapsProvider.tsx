/* eslint-disable react-refresh/only-export-components -- mixed exports are intentional in this shared module */
/// <reference types="google.maps" />
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    google?: typeof google;
    initGoogleMaps?: () => void;
  }
}

interface GoogleMapsContextValue {
  isLoaded: boolean;
  loadError: string | null;
}

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: null,
});

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}

interface GoogleMapsProviderProps {
  children: ReactNode;
}

// Store the API key from edge function
let cachedApiKey: string | null = null;

async function fetchApiKey(): Promise<string | null> {
  if (cachedApiKey) return cachedApiKey;

  // First check client-side env var
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey) {
    cachedApiKey = envKey;
    return envKey;
  }

  // Fallback: fetch from edge function using the user's session token
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return null;

    const res = await fetch(`${supabaseUrl}/functions/v1/get-maps-key`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.key) {
      cachedApiKey = data.key;
      return data.key;
    }
    return null;
  } catch {
    return null;
  }
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already loaded
    if (window.google?.maps?.places) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsLoaded(true));
      existingScript.addEventListener('error', () => setLoadError('Failed to load Google Maps'));
      return;
    }

    // Load the script
    const loadScript = async () => {
      const apiKey = await fetchApiKey();
      
      if (!apiKey) {
        // If no client-side key, we'll use server-side geocoding only
        console.info('Google Maps client key not available, using server-side geocoding');
        setIsLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;

      window.initGoogleMaps = () => {
        setIsLoaded(true);
        delete window.initGoogleMaps;
      };

      script.onerror = () => {
        setLoadError('Failed to load Google Maps');
        delete window.initGoogleMaps;
      };

      document.head.appendChild(script);
    };

    loadScript();
  }, []);

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

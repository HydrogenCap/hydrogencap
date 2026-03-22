/* eslint-disable react-refresh/only-export-components -- provider, hook, and helpers are intentionally co-located */
import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { PropertyWithFinancials } from '@/hooks/useProperties';

export type LifecycleFilter = 'core_rental' | 'development' | 'all';
export type LifecycleType = 'core_rental' | 'development';

interface LifecycleFilterContextValue {
  lifecycleFilter: LifecycleFilter;
  setLifecycleFilter: (filter: LifecycleFilter) => void;
  filterProperties: <T extends { lifecycle_type?: string | null }>(properties: T[]) => T[];
  isCoreRental: (property: { lifecycle_type?: string | null }) => boolean;
  isDevelopment: (property: { lifecycle_type?: string | null }) => boolean;
}

const LifecycleFilterContext = createContext<LifecycleFilterContextValue | undefined>(undefined);

interface LifecycleFilterProviderProps {
  children: ReactNode;
}

export function LifecycleFilterProvider({ children }: LifecycleFilterProviderProps) {
  // Default to 'core_rental' as per requirements
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('core_rental');

  const filterProperties = useMemo(() => {
    return <T extends { lifecycle_type?: string | null }>(properties: T[]): T[] => {
      if (lifecycleFilter === 'all') return properties;
      return properties.filter(p => (p.lifecycle_type ?? 'development') === lifecycleFilter);
    };
  }, [lifecycleFilter]);

  const isCoreRental = (property: { lifecycle_type?: string | null }): boolean => {
    return (property.lifecycle_type ?? 'development') === 'core_rental';
  };

  const isDevelopment = (property: { lifecycle_type?: string | null }): boolean => {
    return (property.lifecycle_type ?? 'development') === 'development';
  };

  const value = useMemo(() => ({
    lifecycleFilter,
    setLifecycleFilter,
    filterProperties,
    isCoreRental,
    isDevelopment,
  }), [lifecycleFilter, filterProperties]);

  return (
    <LifecycleFilterContext.Provider value={value}>
      {children}
    </LifecycleFilterContext.Provider>
  );
}

export function useLifecycleFilter() {
  const context = useContext(LifecycleFilterContext);
  if (!context) {
    throw new Error('useLifecycleFilter must be used within a LifecycleFilterProvider');
  }
  return context;
}

// Utility function for checking lifecycle (can be used outside React context)
export function isPropertyCoreRental(property: { lifecycle_type?: string | null }): boolean {
  return (property.lifecycle_type ?? 'development') === 'core_rental';
}

export function isPropertyDevelopment(property: { lifecycle_type?: string | null }): boolean {
  return (property.lifecycle_type ?? 'development') === 'development';
}

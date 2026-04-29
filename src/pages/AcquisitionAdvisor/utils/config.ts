import { TrendingUp, Shield, AlertTriangle } from 'lucide-react';

export const PROPERTY_TYPES = [
  { value: 'terraced', label: 'Terraced' },
  { value: 'semi_detached', label: 'Semi-Detached' },
  { value: 'detached', label: 'Detached' },
  { value: 'flat', label: 'Flat / Apartment' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'hmo', label: 'HMO' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed Use' },
];

export const RECOMMENDATION_CONFIG = {
  strong_buy: { label: 'Strong Buy', severity: 'success' as const, icon: TrendingUp },
  buy: { label: 'Buy', severity: 'info' as const, icon: TrendingUp },
  hold: { label: 'Hold', severity: 'warning' as const, icon: Shield },
  avoid: { label: 'Avoid', severity: 'critical' as const, icon: AlertTriangle },
};

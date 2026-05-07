import {
  ShieldCheck, AlertTriangle, Clock, FileText, Home, Users, Gavel,
} from 'lucide-react';
import type { DecentHomesItem } from './types';

export const DECENT_HOMES_TEMPLATE: Omit<DecentHomesItem, 'confirmed' | 'confirmed_date'>[] = [
  { key: 'hazard_free', label: 'Category 1 Hazard Free (HHSRS)', description: 'No Category 1 hazards under the Housing Health & Safety Rating System (e.g. damp, excess cold, falls).' },
  { key: 'reasonable_repair', label: 'Reasonable State of Repair', description: 'Key building components (roof, windows, doors, plumbing, heating) not in a state of disrepair.' },
  { key: 'modern_facilities', label: 'Modern Facilities & Services', description: 'Kitchen ≤ 20 years old, bathroom ≤ 30 years old, adequate noise insulation.' },
  { key: 'thermal_comfort', label: 'Thermal Comfort', description: 'Effective and efficient fixed heating with appropriate insulation (loft, walls).' },
  { key: 'clean_on_entry', label: 'Clean & Safe on Entry', description: 'Property provided in a clean condition with working smoke/CO alarms and secure entry points.' },
];

export const PROVISIONS = [
  { icon: Gavel, title: 'Section 21 Abolition', detail: '"No-fault" evictions banned. Landlords may only evict using Section 8 grounds.', status: 'In force — 2025' },
  { icon: Home, title: 'Property Portal', detail: 'All landlords must register on the government Property Portal before letting. Failure is a criminal offence.', status: 'In force — 2025' },
  { icon: Users, title: 'Private Rented Sector Ombudsman', detail: 'Mandatory membership of the new PRS Ombudsman for all landlords. Tenants can escalate complaints.', status: 'In force — 2025' },
  { icon: Clock, title: "Awaab's Law", detail: 'Investigate damp/mould within 14 days. Emergency fixes within 24 hours. All repairs within a reasonable timeframe.', status: 'In force — 2025' },
  { icon: FileText, title: 'Decent Homes Standard', detail: 'Category 1 hazard-free, reasonable repair, modern facilities, thermal comfort — now applies to private rentals.', status: 'Commencement date TBC' },
  { icon: AlertTriangle, title: 'Rental Bidding Ban', detail: 'Landlords and agents cannot invite or accept bids above the advertised rent.', status: 'In force — 2025' },
  { icon: ShieldCheck, title: 'Pets', detail: 'Landlords cannot unreasonably refuse a tenant\'s written request to keep a pet.', status: 'In force — 2025' },
  { icon: FileText, title: 'Fixed-term Tenancies Abolished', detail: 'All new and existing tenancies become periodic. Minimum 2-month notice to quit by tenant.', status: 'In force — 2025' },
];

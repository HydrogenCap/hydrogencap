export interface AwaaabComplaint {
  id: string;
  property: string;
  description: string;
  reported_date: string;
}

export interface DecentHomesItem {
  key: string;
  label: string;
  description: string;
  confirmed: boolean;
  confirmed_date?: string;
}

export const ROOM_TYPE_BG: Record<string, string> = {
  single: 'bg-slate-100 text-slate-700', double: 'bg-blue-100 text-blue-700',
  ensuite: 'bg-indigo-100 text-indigo-700', studio: 'bg-purple-100 text-purple-700',
  bedsit: 'bg-teal-100 text-teal-700', communal: 'bg-muted text-muted-foreground',
};

export const OCCUPANCY_BG: Record<string, string> = {
  occupied: 'bg-emerald-100 text-emerald-700', vacant: 'bg-red-100 text-red-700',
  under_offer: 'bg-amber-100 text-amber-700', unavailable: 'bg-muted text-muted-foreground',
  refurbishment: 'bg-orange-100 text-orange-700',
};

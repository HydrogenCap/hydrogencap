import { useSyncExternalStore } from 'react';

export type ActivityTab = 'notifications' | 'inbox' | 'actions' | 'audit';

interface ActivitySidebarState {
  open: boolean;
  tab: ActivityTab;
}

let state: ActivitySidebarState = { open: false, tab: 'notifications' };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot() {
  return state;
}

export function openSidebar(tab: ActivityTab) {
  state = { open: true, tab };
  emit();
}

export function setActivityTab(tab: ActivityTab) {
  state = { ...state, tab };
  emit();
}

export function closeSidebar() {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

export function useActivitySidebar() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    open: snap.open,
    tab: snap.tab,
    openSidebar,
    setTab: setActivityTab,
    close: closeSidebar,
  };
}

import { useState, useEffect, useMemo } from 'react';
import { useAppSettings, useUpdateAppSetting } from '@/hooks/useAppSettings';
import { useToast } from '@/hooks/use-toast';
import type { AwaaabComplaint, DecentHomesItem } from '../utils/types';
import { loadAwaaab, saveAwaaab, loadDecent, saveDecent } from '../utils/storage';

export function useRentersRightsBillState() {
  const { toast } = useToast();
  const { data: settings, isLoading: settingsLoading } = useAppSettings();
  const updateSetting = useUpdateAppSetting();

  const [editingOmbudsman, setEditingOmbudsman] = useState(false);
  const [ombudsmanDraft, setOmbudsmanDraft] = useState('');
  const [editingPortal, setEditingPortal] = useState(false);
  const [portalDraft, setPortalDraft] = useState('');

  const [complaints, setComplaints] = useState<AwaaabComplaint[]>([]);
  const [showAddComplaint, setShowAddComplaint] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ property: '', description: '', reported_date: new Date().toISOString().split('T')[0] });

  const [decentItems, setDecentItems] = useState<DecentHomesItem[]>([]);

  useEffect(() => {
    setComplaints(loadAwaaab());
    setDecentItems(loadDecent());
  }, []);

  const ombudsmanNumber = settings?.['rrb_ombudsman_number'] || '';
  const portalNumber = settings?.['rrb_property_portal_number'] || '';

  const saveOmbudsman = async () => {
    await updateSetting.mutateAsync({ key: 'rrb_ombudsman_number', value: ombudsmanDraft });
    setEditingOmbudsman(false);
  };
  const savePortal = async () => {
    await updateSetting.mutateAsync({ key: 'rrb_property_portal_number', value: portalDraft });
    setEditingPortal(false);
  };

  const addComplaint = () => {
    if (!newComplaint.property || !newComplaint.reported_date) return;
    const updated = [...complaints, { ...newComplaint, id: crypto.randomUUID() }];
    setComplaints(updated);
    saveAwaaab(updated);
    setNewComplaint({ property: '', description: '', reported_date: new Date().toISOString().split('T')[0] });
    setShowAddComplaint(false);
    toast({ title: 'Complaint logged' });
  };

  const removeComplaint = (id: string) => {
    const updated = complaints.filter(c => c.id !== id);
    setComplaints(updated);
    saveAwaaab(updated);
  };

  const toggleDecent = (key: string) => {
    const updated = decentItems.map(item =>
      item.key === key
        ? { ...item, confirmed: !item.confirmed, confirmed_date: !item.confirmed ? new Date().toISOString().split('T')[0] : undefined }
        : item,
    );
    setDecentItems(updated);
    saveDecent(updated);
  };

  const decentScore = useMemo(() => decentItems.filter(i => i.confirmed).length, [decentItems]);
  const decentPct = decentItems.length ? Math.round((decentScore / decentItems.length) * 100) : 0;

  return {
    settingsLoading, updateSettingPending: updateSetting.isPending,
    ombudsmanNumber, portalNumber,
    editingOmbudsman, setEditingOmbudsman, ombudsmanDraft, setOmbudsmanDraft, saveOmbudsman,
    editingPortal, setEditingPortal, portalDraft, setPortalDraft, savePortal,
    complaints, showAddComplaint, setShowAddComplaint,
    newComplaint, setNewComplaint, addComplaint, removeComplaint,
    decentItems, toggleDecent, decentScore, decentPct,
  };
}

export type RentersRightsBillState = ReturnType<typeof useRentersRightsBillState>;

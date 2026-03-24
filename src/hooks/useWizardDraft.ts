import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import type { WizardDraft, WizardType, WizardPayload } from '@/lib/wizard/types';

const AUTO_SAVE_INTERVAL_MS = 10_000;

export function useWizardDraft(wizardType: WizardType) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const payloadRef = useRef<WizardPayload>({});
  const dirtyRef = useRef(false);

  // Load or create draft on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function init() {
      setIsLoading(true);
      try {
        // Check for existing in-progress draft
        const { data: existing } = await supabase
          .from('wizard_drafts')
          .select('*')
          .eq('user_id', user!.id)
          .eq('wizard_type', wizardType)
          .eq('status', 'in_progress')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (existing) {
          const d = existing as unknown as WizardDraft;
          setDraft(d);
          payloadRef.current = (d.payload || {}) as WizardPayload;
        }
        // Don't auto-create — let the page create on first interaction
      } catch (err) {
        console.error('Failed to load wizard draft:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [user, wizardType]);

  const saveDraftFn = useCallback(async () => {
    if (!draft?.id) return;
    setIsSaving(true);
    try {
      await supabase
        .from('wizard_drafts')
        .update({
          payload: payloadRef.current as unknown as Json,
          current_step: draft.current_step,
        })
        .eq('id', draft.id);
      dirtyRef.current = false;
      setLastSaved(new Date());
    } catch (err) {
      console.error('Draft save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [draft?.id, draft?.current_step]);

  // Auto-save interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (dirtyRef.current && draft) {
        saveDraftFn();
      }
    }, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [draft, saveDraftFn]);

  // Save on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.hidden && dirtyRef.current && draft) {
        saveDraftFn();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [draft, saveDraftFn]);

  const saveDraft = useCallback(async () => {
    if (!draft?.id) return;
    setIsSaving(true);
    try {
      await supabase
        .from('wizard_drafts')
        .update({
          payload: payloadRef.current as unknown as Json,
          current_step: draft.current_step,
        })
        .eq('id', draft.id);
      dirtyRef.current = false;
      setLastSaved(new Date());
    } catch (err) {
      console.error('Draft save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [draft?.id, draft?.current_step]);

  const createDraft = useCallback(async () => {
    if (!user) return null;
    const orgId = await fetchUserOrgId();
    const { data, error } = await supabase
      .from('wizard_drafts')
      .insert({
        org_id: orgId,
        user_id: user.id,
        wizard_type: wizardType,
        current_step: 0,
        payload: {},
        status: 'in_progress',
      })
      .select()
      .single();

    if (error) throw error;
    const d = data as unknown as WizardDraft;
    setDraft(d);
    payloadRef.current = {};
    return d;
  }, [user, wizardType]);

  const updatePayload = useCallback(
    (partial: Partial<WizardPayload>) => {
      payloadRef.current = { ...payloadRef.current, ...partial };
      dirtyRef.current = true;
      setDraft((prev) => prev ? { ...prev, payload: payloadRef.current } : prev);
    },
    []
  );

  const setStep = useCallback(
    async (step: number) => {
      setDraft((prev) => prev ? { ...prev, current_step: step } : prev);
      // Save on step change
      if (draft?.id) {
        setIsSaving(true);
        try {
          await supabase
            .from('wizard_drafts')
            .update({
              payload: payloadRef.current as unknown as Json,
              current_step: step,
            })
            .eq('id', draft.id);
          dirtyRef.current = false;
          setLastSaved(new Date());
        } finally {
          setIsSaving(false);
        }
      }
    },
    [draft?.id]
  );

  const discardDraft = useCallback(async () => {
    if (!draft?.id) return;
    await supabase
      .from('wizard_drafts')
      .update({ status: 'discarded' })
      .eq('id', draft.id);

    // Clean up orphaned entities if created mid-wizard
    if (draft.property_id) {
      await supabase.from('properties_v2').delete().eq('id', draft.property_id);
    }
    if (draft.entity_id) {
      // Only delete if entity was created by this wizard (check if it has properties)
      const { count } = await supabase
        .from('properties_v2')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', draft.entity_id);
      if (!count || count === 0) {
        await supabase.from('legal_entities').delete().eq('id', draft.entity_id);
      }
    }

    setDraft(null);
    payloadRef.current = {};
  }, [draft?.id, draft?.property_id, draft?.entity_id]);

  const markSubmitted = useCallback(async (propertyId?: string, entityId?: string) => {
    if (!draft?.id) return;
    await supabase
      .from('wizard_drafts')
      .update({
        status: 'submitted',
        property_id: propertyId || draft.property_id,
        entity_id: entityId || draft.entity_id,
      })
      .eq('id', draft.id);
  }, [draft?.id, draft?.property_id, draft?.entity_id]);

  return {
    draft,
    isLoading,
    isSaving,
    lastSaved,
    payload: draft?.payload || {},
    createDraft,
    updatePayload,
    setStep,
    saveDraft,
    discardDraft,
    markSubmitted,
  };
}

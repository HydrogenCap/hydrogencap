import { useState } from 'react';
import {
  useAcquisitionAnalyses,
  useRunAcquisitionAnalysis,
  type AcquisitionInput,
  type AcquisitionAnalysis,
} from '@/hooks/useAcquisitionAnalysis';

export function useAcquisitionAdvisorState() {
  const [form, setForm] = useState<AcquisitionInput>({ address: '' });
  const [selectedAnalysis, setSelectedAnalysis] = useState<AcquisitionAnalysis | null>(null);
  const { data: pastAnalyses, isLoading: loadingPast } = useAcquisitionAnalyses();
  const runAnalysis = useRunAcquisitionAnalysis();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim()) return;

    runAnalysis.mutate(form, {
      onSuccess: (data) => {
        const result = data.analysis || data;
        setSelectedAnalysis(result as AcquisitionAnalysis);
        setForm({ address: '' });
      },
    });
  };

  const updateForm = (field: keyof AcquisitionInput, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return {
    form, updateForm, selectedAnalysis, setSelectedAnalysis,
    pastAnalyses, loadingPast, runAnalysis, handleSubmit,
  };
}

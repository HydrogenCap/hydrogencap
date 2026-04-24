 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase, supabaseAny } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export interface JobNote {
   id: string;
   job_id: string;
   note: string;
   created_by: string | null;
   created_at: string;
 }
 
 export function useJobNotes(jobId: string | undefined) {
   return useQuery({
     queryKey: ['job-notes', jobId],
     queryFn: async () => {
       if (!jobId) return [];
 
       const { data, error } = await supabaseAny
         .from('job_notes')
         .select('*')
         .eq('job_id', jobId)
         .order('created_at', { ascending: false });
 
       if (error) throw error;
       return data as JobNote[];
     },
     enabled: !!jobId,
   });
 }
 
 export function useAddJobNote() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ jobId, note }: { jobId: string; note: string }) => {
       const { data: { user } } = await supabase.auth.getUser();
 
       const { data, error } = await supabaseAny
         .from('job_notes')
         .insert({
           job_id: jobId,
           note,
           created_by: user?.id,
         })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['job-notes', variables.jobId] });
       toast({ title: 'Note added' });
     },
   });
 }
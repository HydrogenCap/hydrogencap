UPDATE public.documents
SET category = 'surveys'
WHERE ai_suggested_doc_type = 'asbestos_survey'
  AND (category IS NULL OR category = 'other');

UPDATE public.documents
SET category = 'planning'
WHERE ai_suggested_doc_type = 'planning_building_control'
  AND (category IS NULL OR category = 'other');
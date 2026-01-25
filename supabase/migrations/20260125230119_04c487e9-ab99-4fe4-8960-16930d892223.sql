-- Add shares_confirmed field to share_classes to track if issued shares have been verified
ALTER TABLE public.share_classes 
ADD COLUMN shares_confirmed boolean DEFAULT false;

-- Comment for clarity
COMMENT ON COLUMN public.share_classes.shares_confirmed IS 'Whether the issued_shares count has been explicitly confirmed by user (vs default 100)';
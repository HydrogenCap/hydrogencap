-- Add room_id column to void_periods for room-level void tracking (HMOs)
ALTER TABLE public.void_periods ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms_v2(id);

-- Add index for room-level lookups
CREATE INDEX IF NOT EXISTS idx_void_periods_room_id ON public.void_periods(room_id);

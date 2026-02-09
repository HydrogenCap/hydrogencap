-- Create payment method enum
CREATE TYPE public.payment_method AS ENUM ('bank_transfer', 'standing_order', 'direct_debit', 'cash', 'cheque');

-- Add payment_method column to tenancies
ALTER TABLE public.tenancies
ADD COLUMN payment_method public.payment_method DEFAULT NULL;

-- Add optional reference field for bank details / DD reference
ALTER TABLE public.tenancies
ADD COLUMN payment_reference text DEFAULT NULL;
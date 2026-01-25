import React from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePropertyLookup, PropertyLookupResult } from '@/hooks/usePropertyLookup';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AutoPopulateButtonProps {
  postcode: string | undefined;
  addressLine: string | undefined;
  onDataReceived: (data: PropertyLookupResult) => void;
  disabled?: boolean;
}

export function AutoPopulateButton({
  postcode,
  addressLine,
  onDataReceived,
  disabled,
}: AutoPopulateButtonProps) {
  const { lookupProperty, isLooking } = usePropertyLookup();

  const handleClick = async () => {
    if (!postcode) return;
    
    const result = await lookupProperty(postcode, addressLine);
    if (result) {
      onDataReceived(result);
    }
  };

  const canLookup = !!postcode && postcode.length >= 5;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={disabled || isLooking || !canLookup}
            className="gap-2"
          >
            {isLooking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking up...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Auto-populate
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {canLookup
            ? 'Fetch EPC rating, property type, local authority, and more from public registers'
            : 'Enter a valid postcode first'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

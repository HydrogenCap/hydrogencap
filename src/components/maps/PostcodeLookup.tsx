import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostcodeLookupAddress {
  line1: string;
  line2: string | null;
  city: string;
  county: string | null;
  postcode: string;
}

interface PostcodeLookupProps {
  onSelect: (address: PostcodeLookupAddress) => void;
  className?: string;
}

export function PostcodeLookup({ onSelect, className }: PostcodeLookupProps) {
  const [postcode, setPostcode] = useState('');
  const [addresses, setAddresses] = useState<PostcodeLookupAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const lookupPostcode = async () => {
    const cleaned = postcode.trim().replace(/\s+/g, '');
    if (cleaned.length < 5) {
      setError('Please enter a valid UK postcode');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAddresses([]);

    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`);
      if (!res.ok) {
        setError('Postcode not found');
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      const result = data.result;
      if (!result) {
        setError('Postcode not found');
        setIsLoading(false);
        return;
      }

      // Postcodes.io returns location data for the postcode, not individual addresses.
      // We'll use it to provide the location context and let the user type their house number.
      const baseAddress: PostcodeLookupAddress = {
        line1: '',
        line2: null,
        city: result.admin_ward || result.parish || '',
        county: result.admin_county || result.region || null,
        postcode: result.postcode,
      };

      // Try to get nearby addresses using the bulk endpoint or just return the postcode data
      // For richer results, try the places endpoint
      const nearbyRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}/nearest`);
      
      if (nearbyRes.ok) {
        const nearbyData = await nearbyRes.json();
        if (nearbyData.result && nearbyData.result.length > 0) {
          // Use the primary result for city/county
          const primary = nearbyData.result[0];
          baseAddress.city = primary.admin_ward || primary.parish || primary.admin_district || '';
          baseAddress.county = primary.admin_county || primary.region || null;
        }
      }

      setAddresses([baseAddress]);
      setShowResults(true);
    } catch {
      setError('Failed to look up postcode. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookupPostcode();
    }
  };

  return (
    <div ref={wrapperRef} className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={postcode}
            onChange={e => { setPostcode(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder="Enter postcode, e.g. SW1A 2AA"
            className="pr-9"
          />
          <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <Button type="button" size="sm" onClick={lookupPostcode} disabled={isLoading || !postcode.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {showResults && addresses.length > 0 && (
        <div className="rounded-md border border-border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Found: {addresses[0].postcode} — {addresses[0].city}{addresses[0].county ? `, ${addresses[0].county}` : ''}
          </p>
          <AddressEntryForm
            postcode={addresses[0].postcode}
            city={addresses[0].city}
            county={addresses[0].county}
            onSelect={(line1) => {
              onSelect({
                ...addresses[0],
                line1,
              });
              setShowResults(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function AddressEntryForm({ postcode, city, county, onSelect }: {
  postcode: string;
  city: string;
  county: string | null;
  onSelect: (line1: string) => void;
}) {
  const [line1, setLine1] = useState('');

  return (
    <div className="space-y-2">
      <Input
        value={line1}
        onChange={e => setLine1(e.target.value)}
        placeholder="House number and street, e.g. 11 Holmer Road"
        autoFocus
      />
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={!line1.trim()}
        onClick={() => onSelect(line1.trim())}
      >
        Use this address
      </Button>
    </div>
  );
}

import { useMemo } from 'react';
import { PropertyWithFinancials } from './useProperties';

export interface DuplicateCandidate {
  property1: PropertyWithFinancials;
  property2: PropertyWithFinancials;
  reason: 'place_id' | 'proximity' | 'address_similarity';
  confidence: 'high' | 'medium';
  distance?: number; // in meters
}

// Haversine formula to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Levenshtein distance for text similarity
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

function calculateAddressSimilarity(addr1: string, addr2: string): number {
  const normalized1 = addr1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalized2 = addr2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const maxLen = Math.max(normalized1.length, normalized2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(normalized1, normalized2);
  return 1 - distance / maxLen;
}

const PROXIMITY_THRESHOLD_METERS = 30;
const ADDRESS_SIMILARITY_THRESHOLD = 0.8;

export function useDuplicateDetection(properties: PropertyWithFinancials[] | undefined) {
  return useMemo(() => {
    if (!properties || properties.length < 2) return [];

    const duplicates: DuplicateCandidate[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < properties.length; i++) {
      for (let j = i + 1; j < properties.length; j++) {
        const p1 = properties[i];
        const p2 = properties[j];
        const pairKey = `${p1.id}-${p2.id}`;
        
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        // 1. Exact place_id match (highest confidence)
        if (p1.place_id && p2.place_id && p1.place_id === p2.place_id) {
          duplicates.push({
            property1: p1,
            property2: p2,
            reason: 'place_id',
            confidence: 'high',
          });
          continue;
        }

        // 2. Proximity check (within 30m) + same postcode + address similarity
        if (p1.latitude && p1.longitude && p2.latitude && p2.longitude) {
          const distance = calculateDistance(
            Number(p1.latitude),
            Number(p1.longitude),
            Number(p2.latitude),
            Number(p2.longitude)
          );

          if (distance <= PROXIMITY_THRESHOLD_METERS) {
            // Check postcode match
            const samePostcode = p1.postcode && p2.postcode && 
              p1.postcode.toUpperCase().replace(/\s/g, '') === 
              p2.postcode.toUpperCase().replace(/\s/g, '');

            // Check address similarity
            const similarity = calculateAddressSimilarity(p1.address_line, p2.address_line);

            if (samePostcode && similarity >= ADDRESS_SIMILARITY_THRESHOLD) {
              duplicates.push({
                property1: p1,
                property2: p2,
                reason: 'proximity',
                confidence: 'high',
                distance: Math.round(distance),
              });
              continue;
            } else if (similarity >= ADDRESS_SIMILARITY_THRESHOLD) {
              duplicates.push({
                property1: p1,
                property2: p2,
                reason: 'proximity',
                confidence: 'medium',
                distance: Math.round(distance),
              });
              continue;
            }
          }
        }

        // 3. Address similarity check (for properties without coordinates)
        const similarity = calculateAddressSimilarity(p1.address_line, p2.address_line);
        const samePostcode = p1.postcode && p2.postcode && 
          p1.postcode.toUpperCase().replace(/\s/g, '') === 
          p2.postcode.toUpperCase().replace(/\s/g, '');

        if (similarity >= 0.9 && samePostcode) {
          duplicates.push({
            property1: p1,
            property2: p2,
            reason: 'address_similarity',
            confidence: 'medium',
          });
        }
      }
    }

    return duplicates;
  }, [properties]);
}

// Check a single property against existing properties for duplicates
export function checkForDuplicate(
  newProperty: {
    place_id?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    postcode?: string | null;
    address_line: string;
  },
  existingProperties: PropertyWithFinancials[]
): DuplicateCandidate | null {
  for (const existing of existingProperties) {
    // 1. Exact place_id match
    if (newProperty.place_id && existing.place_id && newProperty.place_id === existing.place_id) {
      return {
        property1: existing,
        property2: existing, // Will be the new property once created
        reason: 'place_id',
        confidence: 'high',
      };
    }

    // 2. Proximity check
    if (
      newProperty.latitude &&
      newProperty.longitude &&
      existing.latitude &&
      existing.longitude
    ) {
      const distance = calculateDistance(
        newProperty.latitude,
        newProperty.longitude,
        Number(existing.latitude),
        Number(existing.longitude)
      );

      if (distance <= PROXIMITY_THRESHOLD_METERS) {
        const samePostcode =
          newProperty.postcode &&
          existing.postcode &&
          newProperty.postcode.toUpperCase().replace(/\s/g, '') ===
            existing.postcode.toUpperCase().replace(/\s/g, '');

        const similarity = calculateAddressSimilarity(
          newProperty.address_line,
          existing.address_line
        );

        if (samePostcode && similarity >= ADDRESS_SIMILARITY_THRESHOLD) {
          return {
            property1: existing,
            property2: existing,
            reason: 'proximity',
            confidence: 'high',
            distance: Math.round(distance),
          };
        }
      }
    }

    // 3. High address similarity with same postcode
    const similarity = calculateAddressSimilarity(
      newProperty.address_line,
      existing.address_line
    );
    const samePostcode =
      newProperty.postcode &&
      existing.postcode &&
      newProperty.postcode.toUpperCase().replace(/\s/g, '') ===
        existing.postcode.toUpperCase().replace(/\s/g, '');

    if (similarity >= 0.9 && samePostcode) {
      return {
        property1: existing,
        property2: existing,
        reason: 'address_similarity',
        confidence: 'medium',
      };
    }
  }

  return null;
}

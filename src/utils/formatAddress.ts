/**
 * Joins address_line and town_city, avoiding duplication
 * when address_line already ends with the city name.
 */
export function formatPropertyAddress(
  addressLine: string | null | undefined,
  townCity: string | null | undefined
): string {
  if (!addressLine) return townCity || '';
  if (!townCity) return addressLine;
  // If address_line already ends with the city, don't append it again
  if (addressLine.toLowerCase().endsWith(townCity.toLowerCase())) {
    return addressLine;
  }
  return `${addressLine}, ${townCity}`;
}

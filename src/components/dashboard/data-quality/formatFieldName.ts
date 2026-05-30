// Field name formatter
export function formatFieldName(field: string): string {
  const formatted = field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
  
  // Special cases for abbreviations
  const specialCases: Record<string, string> = {
    'Epc Rating': 'EPC Rating',
    'Epc Expiry': 'EPC Expiry',
    'Hmo License': 'HMO License',
    'Ltv': 'LTV',
  };
  
  return specialCases[formatted] || formatted;
}

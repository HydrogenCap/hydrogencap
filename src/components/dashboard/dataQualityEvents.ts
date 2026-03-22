export const PROPERTY_UPDATED_EVENT = 'propertyUpdated';

export function notifyPropertyUpdated(propertyId?: string) {
  window.dispatchEvent(new CustomEvent(PROPERTY_UPDATED_EVENT, { detail: { propertyId } }));
}

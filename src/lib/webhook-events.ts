export const WEBHOOK_EVENTS = {
  'property.created': 'A new property was added',
  'property.updated': 'Property details were changed',
  'compliance.expired': 'A compliance certificate has expired',
  'compliance.expiring': 'A certificate is expiring within 30 days',
  'compliance.uploaded': 'A new certificate was uploaded',
  'rent.payment_received': 'A rent payment was recorded',
  'rent.payment_overdue': 'A rent payment is overdue',
  'tenant.created': 'A new tenant was added',
  'tenant.moved_in': 'Tenant moved in',
  'tenant.moved_out': 'Tenant moved out',
  'tenant.notice_served': 'A notice was served',
  'maintenance.request_created': 'A maintenance request was submitted',
  'maintenance.request_completed': 'A maintenance request was completed',
  'maintenance.awaabs_deadline_warning': 'Awaab\'s Law deadline approaching',
  'maintenance.awaabs_deadline_breach': 'Awaab\'s Law deadline breached',
  'distribution.created': 'A distribution was created',
  'distribution.completed': 'A distribution was completed',
  'document.uploaded': 'A document was uploaded',
} as const;

export type WebhookEventType = keyof typeof WEBHOOK_EVENTS;

export const WEBHOOK_EVENT_CATEGORIES = {
  Property: ['property.created', 'property.updated'],
  Compliance: ['compliance.expired', 'compliance.expiring', 'compliance.uploaded'],
  Rent: ['rent.payment_received', 'rent.payment_overdue'],
  Tenants: ['tenant.created', 'tenant.moved_in', 'tenant.moved_out', 'tenant.notice_served'],
  Maintenance: ['maintenance.request_created', 'maintenance.request_completed', 'maintenance.awaabs_deadline_warning', 'maintenance.awaabs_deadline_breach'],
  Financial: ['distribution.created', 'distribution.completed'],
  Documents: ['document.uploaded'],
} as const;

import type { WizardPayload, TaskTemplate, ComplianceItem } from './types';

export function generatePropertyTasks(data: WizardPayload, address: string): TaskTemplate[] {
  const tasks: TaskTemplate[] = [];

  // Missing valuation
  if (!data.current_valuation) {
    tasks.push({
      title: `Obtain current property valuation for ${address}`,
      category: 'incomplete_data',
      priority: 'medium',
      due_days_from_now: 14,
    });
  }

  // Asbestos survey for pre-2000 builds
  if (data.year_built && (data.year_built as number) < 2000) {
    tasks.push({
      title: `Consider asbestos survey for ${address}`,
      category: 'missing_document',
      priority: 'medium',
      due_days_from_now: 30,
    });
  }

  // Mortgage rate expiry
  if (data.has_mortgage && !data.rate_expiry_date) {
    tasks.push({
      title: 'Record mortgage rate expiry date',
      category: 'incomplete_data',
      priority: 'medium',
      due_days_from_now: 7,
    });
  }

  if (data.rate_expiry_date) {
    const days = Math.floor(
      (new Date(data.rate_expiry_date as string).getTime() - Date.now()) / 86400000
    );
    if (days < 90 && days > 0) {
      tasks.push({
        title: `Review refinance options — rate expires ${data.rate_expiry_date}`,
        category: 'financial_review',
        priority: 'high',
        due_days_from_now: Math.max(days - 30, 7),
      });
    }
  }

  // Compliance items without evidence
  const complianceItems = (data.compliance_items as ComplianceItem[]) || [];
  for (const item of complianceItems) {
    if (!item.is_required) continue;

    if (!item.expiry_date) {
      tasks.push({
        title: `Upload ${item.display_name} for ${address}`,
        category: 'missing_document',
        priority: 'high',
        due_days_from_now: 14,
      });
    } else {
      const daysUntil = Math.floor(
        (new Date(item.expiry_date).getTime() - Date.now()) / 86400000
      );
      if (daysUntil < 0) {
        tasks.push({
          title: `Renew expired ${item.display_name} for ${address}`,
          category: 'expiring_compliance',
          priority: 'critical',
          due_days_from_now: 0,
        });
      } else if (daysUntil < item.lead_time_days) {
        tasks.push({
          title: `Book ${item.display_name} renewal — expires ${item.expiry_date}`,
          category: 'expiring_compliance',
          priority: 'high',
          due_days_from_now: Math.max(daysUntil - item.lead_time_days, 0),
        });
      }
    }
  }

  // Entity without company number
  if (data._entity_created_without_number) {
    tasks.push({
      title: `Add company number for ${data._entity_name || 'new entity'}`,
      category: 'incomplete_data',
      priority: 'medium',
      due_days_from_now: 14,
    });
  }

  return tasks;
}

 import { useMemo } from 'react';
 import { useAllCompliance } from './useCompliance';
 import { useContractorJobs } from './useContractorJobs';
 import { useProperties } from './useProperties';
 import { differenceInDays, format } from 'date-fns';
 
 export type CalendarEventType = 'compliance' | 'job' | 'mortgage';
 export type CalendarEventUrgency = 'overdue' | 'urgent' | 'warning' | 'upcoming' | 'scheduled' | 'normal';
 
 export interface CalendarEvent {
   id: string;
   eventType: CalendarEventType;
   propertyId: string;
   propertyAddress: string;
   title: string;
   date: Date;
   urgency: CalendarEventUrgency;
   relatedJobId?: string | null;
   complianceType?: string;
   daysUntil: number;
 }
 
 const URGENCY_THRESHOLDS = {
   compliance: { urgent: 14, warning: 30 },
   mortgage: { urgent: 30, warning: 90 },
 };
 
 export function useCalendarEvents(startDate?: string, endDate?: string) {
   const { data: complianceData, isLoading: complianceLoading } = useAllCompliance();
   const { data: jobsData, isLoading: jobsLoading } = useContractorJobs();
   const { data: properties, isLoading: propertiesLoading } = useProperties();
   const complianceItems = complianceData?.items;
   const jobs = jobsData?.items;
 
   const isLoading = complianceLoading || jobsLoading || propertiesLoading;
 
   const propertyMap = useMemo(() => {
     const map = new Map<string, string>();
     properties?.forEach(p => map.set(p.id, p.address_line));
     return map;
   }, [properties]);
 
   const events = useMemo<CalendarEvent[]>(() => {
     const allEvents: CalendarEvent[] = [];
     const today = new Date();
 
     // 1. Compliance expiries
     complianceItems?.forEach(item => {
       if (!item.expiry_date) return;
       
       const expiryDate = new Date(item.expiry_date);
       const daysUntil = differenceInDays(expiryDate, today);
       
       let urgency: CalendarEventUrgency = 'upcoming';
       if (daysUntil < 0) urgency = 'overdue';
       else if (daysUntil <= URGENCY_THRESHOLDS.compliance.urgent) urgency = 'urgent';
       else if (daysUntil <= URGENCY_THRESHOLDS.compliance.warning) urgency = 'warning';
 
       allEvents.push({
         id: `compliance-${item.id}`,
         eventType: 'compliance',
         propertyId: item.property_id,
         propertyAddress: propertyMap.get(item.property_id) || 'Unknown',
         title: item.compliance_type,
         date: expiryDate,
         urgency,
         relatedJobId: (item as any).auto_job_id ?? null,
         complianceType: item.compliance_type,
         daysUntil,
       });
     });
 
     // 2. Booked contractor jobs
     jobs?.forEach(job => {
       if (!job.booked_date || ['completed', 'verified', 'cancelled'].includes(job.status)) return;
       
       const bookedDate = new Date(job.booked_date);
       const daysUntil = differenceInDays(bookedDate, today);
       
       let urgency: CalendarEventUrgency = 'scheduled';
       if (job.status === 'in_progress') urgency = 'scheduled';
       else if (daysUntil < 0) urgency = 'overdue';
 
       const contractorName = (job as any).contractor?.name || 'No contractor';
       
       allEvents.push({
         id: `job-${job.id}`,
         eventType: 'job',
         propertyId: job.property_id,
         propertyAddress: propertyMap.get(job.property_id) || 'Unknown',
         title: `${job.job_type} - ${contractorName}`,
         date: bookedDate,
         urgency,
         relatedJobId: job.id,
         daysUntil,
       });
     });
 
     // 3. Mortgage rate expiries
     properties?.forEach(property => {
       const loan = property.loans?.[0];
       if (!loan?.fixed_rate_expires) return;
       
       const expiryDate = new Date(loan.fixed_rate_expires);
       const daysUntil = differenceInDays(expiryDate, today);
       
       // Only show within 12 months window
       if (daysUntil < -30 || daysUntil > 365) return;
       
       let urgency: CalendarEventUrgency = 'upcoming';
       if (daysUntil < 0) urgency = 'overdue';
       else if (daysUntil <= URGENCY_THRESHOLDS.mortgage.urgent) urgency = 'urgent';
       else if (daysUntil <= URGENCY_THRESHOLDS.mortgage.warning) urgency = 'warning';
 
       allEvents.push({
         id: `mortgage-${property.id}`,
         eventType: 'mortgage',
         propertyId: property.id,
         propertyAddress: property.address_line,
         title: 'Mortgage rate expires',
         date: expiryDate,
         urgency,
         daysUntil,
       });
     });
 
     // Filter by date range if provided
     let filtered = allEvents;
     if (startDate) {
       const start = new Date(startDate);
       filtered = filtered.filter(e => e.date >= start);
     }
     if (endDate) {
       const end = new Date(endDate);
       filtered = filtered.filter(e => e.date <= end);
     }
 
     return filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
   }, [complianceItems, jobs, properties, propertyMap, startDate, endDate]);
 
   // Group events by date key
   const eventsByDate = useMemo(() => {
     const map = new Map<string, CalendarEvent[]>();
     events.forEach(event => {
       const key = format(event.date, 'yyyy-MM-dd');
       if (!map.has(key)) map.set(key, []);
       map.get(key)!.push(event);
     });
     return map;
   }, [events]);
 
   return {
     events,
     eventsByDate,
     isLoading,
   };
 }
 
 export function useUpcomingComplianceEvents(days: number = 60) {
   const startDate = new Date().toISOString().split('T')[0];
   const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
   
   const { events, isLoading } = useCalendarEvents(startDate, endDate);
   
   // Filter to only compliance events + include overdue
   const complianceEvents = useMemo(() => {
     const today = new Date();
     const cutoffPast = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000); // past 30 days
     
     return events.filter(e => 
       e.eventType === 'compliance' && 
       e.date >= cutoffPast
     ).sort((a, b) => {
       // Sort: overdue first, then by date
       if (a.urgency === 'overdue' && b.urgency !== 'overdue') return -1;
       if (b.urgency === 'overdue' && a.urgency !== 'overdue') return 1;
       return a.date.getTime() - b.date.getTime();
     });
   }, [events]);
 
   return { events: complianceEvents, isLoading };
 }
 import React from 'react';
 import { Calendar, Download } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
 import { useAllCompliance } from '@/hooks/useCompliance';
 import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
 import { useToast } from '@/hooks/use-toast';
 
 interface CalendarEvent {
   title: string;
   date: Date;
   description: string;
   location?: string;
 }
 
 function generateICS(events: CalendarEvent[]): string {
   const formatDate = (date: Date) => {
     return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
   };
 
   const escapeText = (text: string) => {
     return text.replace(/[\\;,\n]/g, (match) => {
       if (match === '\n') return '\\n';
       return '\\' + match;
     });
   };
 
   let ics = `BEGIN:VCALENDAR
 VERSION:2.0
 PRODID:-//HydrogenCap//Compliance Calendar//EN
 CALSCALE:GREGORIAN
 METHOD:PUBLISH
 X-WR-CALNAME:HydrogenCap Compliance
 `;
 
   events.forEach((event, index) => {
     const uid = `compliance-${index}-${Date.now()}@hydrogencap.com`;
     const dtstamp = formatDate(new Date());
     
     // All-day event (date only, no time)
     const dtend = new Date(event.date);
     dtend.setDate(dtend.getDate() + 1);
 
     ics += `BEGIN:VEVENT
 UID:${uid}
 DTSTAMP:${dtstamp}
 DTSTART;VALUE=DATE:${event.date.toISOString().split('T')[0].replace(/-/g, '')}
 DTEND;VALUE=DATE:${dtend.toISOString().split('T')[0].replace(/-/g, '')}
 SUMMARY:${escapeText(event.title)}
 DESCRIPTION:${escapeText(event.description)}
 ${event.location ? `LOCATION:${escapeText(event.location)}` : ''}
 BEGIN:VALARM
 TRIGGER:-P7D
 ACTION:DISPLAY
 DESCRIPTION:Compliance expiring in 7 days
 END:VALARM
 BEGIN:VALARM
 TRIGGER:-P30D
 ACTION:DISPLAY
 DESCRIPTION:Compliance expiring in 30 days
 END:VALARM
 END:VEVENT
 `;
   });
 
   ics += 'END:VCALENDAR';
   return ics;
 }
 
 export function CalendarExportButton() {
   const { data: complianceData } = useAllCompliance();
   const complianceItems = complianceData?.items;
   const { data: properties } = useProperties();
   const { toast } = useToast();
 
   const propertyMap = React.useMemo(() => {
     const map = new Map<string, string>();
     properties?.forEach(p => map.set(p.id, p.address_line));
     return map;
   }, [properties]);
 
   const handleExport = (type: 'google' | 'outlook' | 'ics') => {
     if (!complianceItems?.length) {
       toast({ title: 'No compliance items to export', variant: 'destructive' });
       return;
     }
 
     const events: CalendarEvent[] = complianceItems
       .filter(item => item.expiry_date)
       .map(item => ({
         title: `${item.compliance_type} Expiry - ${propertyMap.get(item.property_id)?.split(',')[0] || 'Property'}`,
         date: new Date(item.expiry_date!),
         description: `${item.compliance_type} expires for ${propertyMap.get(item.property_id) || 'Unknown Property'}. Renew before this date to remain compliant.`,
         location: propertyMap.get(item.property_id),
       }));
 
     // Download ICS file
     const ics = generateICS(events);
     const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `hydrogencap-compliance-${new Date().toISOString().split('T')[0]}.ics`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     URL.revokeObjectURL(url);
 
     if (type === 'google') {
       window.open('https://calendar.google.com/calendar/r/settings/export', '_blank');
       toast({ title: 'Import to Google Calendar', description: 'The calendar file has been downloaded. Import it in Google Calendar settings.' });
     } else if (type === 'outlook') {
       toast({ title: 'Calendar exported', description: 'Double-click the downloaded file to add to Outlook.' });
     } else {
       toast({ title: 'Calendar exported', description: 'Import the .ics file into your calendar app.' });
     }
   };
 
   return (
     <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <Button variant="outline">
           <Calendar className="h-4 w-4 mr-2" />
           Export to Calendar
         </Button>
       </DropdownMenuTrigger>
       <DropdownMenuContent align="end">
         <DropdownMenuItem onClick={() => handleExport('google')}>
           <Calendar className="h-4 w-4 mr-2" />
           Google Calendar
         </DropdownMenuItem>
         <DropdownMenuItem onClick={() => handleExport('outlook')}>
           <Calendar className="h-4 w-4 mr-2" />
           Outlook
         </DropdownMenuItem>
         <DropdownMenuItem onClick={() => handleExport('ics')}>
           <Download className="h-4 w-4 mr-2" />
           Download .ics File
         </DropdownMenuItem>
       </DropdownMenuContent>
     </DropdownMenu>
   );
 }
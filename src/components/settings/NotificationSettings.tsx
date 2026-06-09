 import React from 'react';
import { Mail, Calendar, Clock, Loader2, Send } from 'lucide-react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Label } from '@/components/ui/label';
 import { Switch } from '@/components/ui/switch';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Badge } from '@/components/ui/badge';
 import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
 import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useNotificationPreferences';
 import { useAuth } from '@/contexts/AuthContext';
import { useSendComplianceReminders } from '@/hooks/useSendComplianceReminders';
 
 const DAYS_OF_WEEK = [
   { value: 0, label: 'Sunday' },
   { value: 1, label: 'Monday' },
   { value: 2, label: 'Tuesday' },
   { value: 3, label: 'Wednesday' },
   { value: 4, label: 'Thursday' },
   { value: 5, label: 'Friday' },
   { value: 6, label: 'Saturday' },
 ];
 
 const REMINDER_OPTIONS = [
   { value: 90, label: '90 days' },
   { value: 60, label: '60 days' },
   { value: 30, label: '30 days' },
   { value: 14, label: '14 days' },
   { value: 7, label: '7 days' },
   { value: 3, label: '3 days' },
   { value: 1, label: '1 day' },
 ];

  type TogglePreferenceKey =
   | 'email_enabled'
   | 'weekly_digest_enabled'
   | 'notify_expired'
   | 'notify_expiring_soon'
   | 'notify_rate_expiry'
   | 'notify_negative_cashflow'
   | 'notify_rent_collection'
   | 'notify_voids'
   | 'notify_regulatory_changes'
   | 'notify_recommended_actions';
 
 export function NotificationSettings() {
   const { user } = useAuth();
   const { data: prefs, isLoading } = useNotificationPreferences();
   const updatePrefs = useUpdateNotificationPreferences();
  const sendReminders = useSendComplianceReminders();
 
   const handleToggle = (key: TogglePreferenceKey, value: boolean) => {
     switch (key) {
       case 'email_enabled':
         updatePrefs.mutate({ email_enabled: value });
         return;
       case 'weekly_digest_enabled':
         updatePrefs.mutate({ weekly_digest_enabled: value });
         return;
       case 'notify_expired':
         updatePrefs.mutate({ notify_expired: value });
         return;
       case 'notify_expiring_soon':
         updatePrefs.mutate({ notify_expiring_soon: value });
         return;
       case 'notify_rate_expiry':
         updatePrefs.mutate({ notify_rate_expiry: value });
         return;
       case 'notify_negative_cashflow':
         updatePrefs.mutate({ notify_negative_cashflow: value });
         return;
       case 'notify_rent_collection':
         updatePrefs.mutate({ notify_rent_collection: value });
         return;
       case 'notify_voids':
         updatePrefs.mutate({ notify_voids: value });
         return;
       case 'notify_regulatory_changes':
         updatePrefs.mutate({ notify_regulatory_changes: value });
         return;
       case 'notify_recommended_actions':
         updatePrefs.mutate({ notify_recommended_actions: value });
         return;
     }
   };
 
   const handleReminderDaysChange = (day: number) => {
     const currentDays = prefs?.reminder_days || [60, 30, 14, 7];
     const newDays = currentDays.includes(day)
       ? currentDays.filter(d => d !== day)
       : [...currentDays, day].sort((a, b) => b - a);
     
     updatePrefs.mutate({ reminder_days: newDays });
   };
 
   if (isLoading) {
     return (
       <div className="flex items-center justify-center p-8">
         <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
       </div>
     );
   }
 
   const currentPrefs = prefs || {
     email_enabled: true,
     reminder_days: [60, 30, 14, 7],
     weekly_digest_enabled: true,
     weekly_digest_day: 1,
     notify_expired: true,
     notify_expiring_soon: true,
     notify_rate_expiry: true,
     notify_negative_cashflow: false,
     notify_rent_collection: true,
     notify_voids: true,
     notify_regulatory_changes: true,
     notify_recommended_actions: true,
   };
 
   return (
     <div className="space-y-6">
       {/* Email Notifications */}
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Mail className="h-5 w-5" />
             Email Notifications
           </CardTitle>
           <CardDescription>
             Receive email alerts for compliance deadlines and portfolio updates.
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-6">
           <div className="flex items-center justify-between">
             <div className="space-y-0.5">
               <Label>Enable Email Notifications</Label>
               <p className="text-sm text-muted-foreground">
                 Send notifications to {user?.email}
               </p>
             </div>
             <Switch
               checked={currentPrefs.email_enabled}
               onCheckedChange={(checked) => handleToggle('email_enabled', checked)}
             />
           </div>
 
           {currentPrefs.email_enabled && (
             <>
               <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Send Reminders Now</Label>
                    <p className="text-sm text-muted-foreground">
                      Manually trigger all pending compliance reminders
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendReminders.mutate()}
                    disabled={sendReminders.isPending}
                  >
                    {sendReminders.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Now
                  </Button>
                </div>

                <Separator />
               
               <div className="space-y-4">
                 <Label>Notification Types</Label>
                 
                 <div className="space-y-3">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-medium">Expired Items</p>
                       <p className="text-xs text-muted-foreground">Alert when compliance expires</p>
                     </div>
                     <Switch
                       checked={currentPrefs.notify_expired}
                       onCheckedChange={(checked) => handleToggle('notify_expired', checked)}
                     />
                   </div>
                   
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-medium">Expiring Soon</p>
                       <p className="text-xs text-muted-foreground">Reminders before expiry dates</p>
                     </div>
                     <Switch
                       checked={currentPrefs.notify_expiring_soon}
                       onCheckedChange={(checked) => handleToggle('notify_expiring_soon', checked)}
                     />
                   </div>
                   
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-medium">Mortgage Rate Expiry</p>
                       <p className="text-xs text-muted-foreground">Alert when fixed rates end</p>
                     </div>
                     <Switch
                       checked={currentPrefs.notify_rate_expiry}
                       onCheckedChange={(checked) => handleToggle('notify_rate_expiry', checked)}
                     />
                   </div>
                   
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-medium">Negative Cashflow</p>
                       <p className="text-xs text-muted-foreground">Alert for loss-making properties</p>
                     </div>
                     <Switch
                       checked={currentPrefs.notify_negative_cashflow}
                       onCheckedChange={(checked) => handleToggle('notify_negative_cashflow', checked)}
                     />
                   </div>
                 </div>
               </div>
             </>
           )}
         </CardContent>
       </Card>
 
       {/* Reminder Schedule */}
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Clock className="h-5 w-5" />
             Reminder Schedule
           </CardTitle>
           <CardDescription>
             Choose when to receive compliance expiry reminders.
           </CardDescription>
         </CardHeader>
         <CardContent>
           <div className="space-y-4">
             <Label>Send reminders at:</Label>
             <div className="flex flex-wrap gap-2">
               {REMINDER_OPTIONS.map(option => {
                 const isSelected = currentPrefs.reminder_days.includes(option.value);
                 return (
                   <Badge
                     key={option.value}
                     variant={isSelected ? 'default' : 'outline'}
                     className="cursor-pointer"
                     onClick={() => handleReminderDaysChange(option.value)}
                   >
                     {option.label} before
                   </Badge>
                 );
               })}
             </div>
             <p className="text-xs text-muted-foreground">
               Click to toggle. Currently sending reminders at: {currentPrefs.reminder_days.sort((a,b) => b-a).join(', ')} days before expiry.
             </p>
           </div>
         </CardContent>
       </Card>
 
       {/* Weekly Digest */}
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Calendar className="h-5 w-5" />
             Weekly Digest
           </CardTitle>
           <CardDescription>
             Get a summary of upcoming compliance deadlines every week.
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="flex items-center justify-between">
             <div className="space-y-0.5">
               <Label>Enable Weekly Digest</Label>
               <p className="text-sm text-muted-foreground">
                 Receive a summary email with all upcoming items
               </p>
             </div>
             <Switch
               checked={currentPrefs.weekly_digest_enabled}
               onCheckedChange={(checked) => handleToggle('weekly_digest_enabled', checked)}
             />
           </div>
 
           {currentPrefs.weekly_digest_enabled && (
             <div className="space-y-2">
               <Label>Send digest on:</Label>
               <Select
                 value={currentPrefs.weekly_digest_day.toString()}
                 onValueChange={(value) => updatePrefs.mutate({ weekly_digest_day: parseInt(value) })}
               >
                 <SelectTrigger className="w-48">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {DAYS_OF_WEEK.map(day => (
                     <SelectItem key={day.value} value={day.value.toString()}>
                       {day.label}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>

               <Separator className="my-2" />

               <Label>Include in digest</Label>
               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-sm font-medium">Expiring certificates</p>
                     <p className="text-xs text-muted-foreground">Overdue and due-soon compliance items</p>
                   </div>
                   <Switch
                     checked={currentPrefs.notify_expiring_soon}
                     onCheckedChange={(checked) => handleToggle('notify_expiring_soon', checked)}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-sm font-medium">Upcoming fixed-rate ends</p>
                     <p className="text-xs text-muted-foreground">Mortgage rate expiries in the next 6 months</p>
                   </div>
                   <Switch
                     checked={currentPrefs.notify_rate_expiry}
                     onCheckedChange={(checked) => handleToggle('notify_rate_expiry', checked)}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-sm font-medium">Rent collected vs due</p>
                     <p className="text-xs text-muted-foreground">Last 7 days of rent payments and shortfalls</p>
                   </div>
                   <Switch
                     checked={currentPrefs.notify_rent_collection}
                     onCheckedChange={(checked) => handleToggle('notify_rent_collection', checked)}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-sm font-medium">Voids</p>
                     <p className="text-xs text-muted-foreground">Currently open void periods and lost income</p>
                   </div>
                   <Switch
                     checked={currentPrefs.notify_voids}
                     onCheckedChange={(checked) => handleToggle('notify_voids', checked)}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-sm font-medium">Regulatory changes</p>
                     <p className="text-xs text-muted-foreground">New UK housing-law alerts since the last digest</p>
                   </div>
                   <Switch
                     checked={currentPrefs.notify_regulatory_changes}
                     onCheckedChange={(checked) => handleToggle('notify_regulatory_changes', checked)}
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-sm font-medium">Top 3 recommended actions</p>
                     <p className="text-xs text-muted-foreground">Prioritised follow-ups to tackle this week</p>
                   </div>
                   <Switch
                     checked={currentPrefs.notify_recommended_actions}
                     onCheckedChange={(checked) => handleToggle('notify_recommended_actions', checked)}
                   />
                 </div>
               </div>
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }

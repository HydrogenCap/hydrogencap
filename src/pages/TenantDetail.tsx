import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';

import { ArrowLeft, Mail, Phone, User, Building2, Calendar, Briefcase, Shield, Home, PoundSterling, Edit, FileText, Users, Upload, ExternalLink, Download, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from '@/hooks/useUserOrg';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useTenancyCompliance } from '@/hooks/useTenancyCompliance';
import type { TenancyWithDetails } from '@/hooks/useTenancies';
import type { Tenant } from '@/hooks/useTenants';
import { useToast } from '@/hooks/use-toast';
import { useTenant, TenantStatus } from '@/hooks/useTenants';
import { useTenancies } from '@/hooks/useTenancies';
import { LoadingState } from '@/components/common';
import { TenancyComplianceChecklist } from '@/components/tenants/TenancyComplianceChecklist';
import CreateTenancyDialog from '@/components/tenants/CreateTenancyDialog';
import { UploadDocumentDialog } from '@/components/documents/UploadDocumentDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EditTenantDialog } from '@/components/tenants/EditTenantDialog';
 
const statusConfig: Record<TenantStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
   prospect: { label: 'Prospect', variant: 'outline' },
   active: { label: 'Active', variant: 'default' },
   past: { label: 'Past', variant: 'secondary' },
   blacklisted: { label: 'Blacklisted', variant: 'destructive' },
 };
 
function TenancyComplianceBadge({ tenancyId }: { tenancyId: string }) {
  const { data: items } = useTenancyCompliance(tenancyId);

  if (!items) return null;

  const applicable = items.filter(i => i.is_applicable && i.is_required);
  const completed = applicable.filter(i => i.completed_date);
  const total = applicable.length;
  const done = completed.length;
  const isComplete = done === total && total > 0;

  if (total === 0) return null;

  return (
    <Badge
      variant="outline"
      className={`text-[10px] shrink-0 ${
        isComplete
          ? 'border-primary/30 bg-primary/5 text-primary'
          : 'border-destructive/30 bg-destructive/5 text-destructive'
      }`}
    >
      {isComplete ? <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> : <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
      {done}/{total}
    </Badge>
  );
}

interface TenancyRowProps {
  tenancy: TenancyWithDetails;
  tenantType: 'individual' | 'company';
  tenantId: string;
  isCompany: boolean;
  tenant: Tenant;
}

function TenancyRow({ tenancy, tenantType, tenantId, isCompany, tenant }: TenancyRowProps) {
  return (
    <AccordionItem value={tenancy.id} className="border rounded-lg">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50 rounded-lg [&[data-state=open]]:rounded-b-none">
        <div className="flex items-center justify-between w-full pr-2">
          {/* Left: property name + date range */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Home className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-left min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">
                  {tenancy.room.room_name === 'Whole Property'
                    ? tenancy.property.address_line
                    : tenancy.room.room_name}
                </span>
                <Badge variant={
                  tenancy.status === 'active' ? 'default' :
                  tenancy.status === 'notice' ? 'secondary' : 'outline'
                } className="shrink-0 text-xs">
                  {tenancy.status}
                </Badge>
                <TenancyComplianceBadge tenancyId={tenancy.id} />
              </div>
              {tenancy.room.room_name !== 'Whole Property' && (
                <p className="text-xs text-muted-foreground truncate">
                  {tenancy.property.address_line}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {format(new Date(tenancy.start_date), 'dd MMM yyyy')} –{' '}
                {tenancy.end_date ? format(new Date(tenancy.end_date), 'dd MMM yyyy') : 'Present'}
              </p>
            </div>
          </div>

          {/* Right: rent + payment info */}
          <div className="text-right shrink-0 ml-4">
            <p className="font-semibold">£{tenancy.rent_amount_pcm.toLocaleString()}/mo</p>
            <p className="text-xs text-muted-foreground">Due day: {tenancy.rent_due_day}</p>
            {(tenancy as any).payment_method && (
              <Badge variant="outline" className="text-[10px] mt-0.5">
                {(tenancy as any).payment_method.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4 pt-2 border-t">
        <div className="space-y-3">
          {/* Agreement button */}
          <div className="flex gap-2">
            {tenancy.tenancy_agreement_url ? (
              <Button variant="outline" size="sm" asChild>
                <a href={tenancy.tenancy_agreement_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3 w-3 mr-1" />
                  View Agreement
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="text-destructive">
                <Upload className="h-3 w-3 mr-1" />
                Upload Agreement
              </Button>
            )}
          </div>

          {/* Compliance checklist — only for active/pending tenancies */}
          {(tenancy.status === 'active' || tenancy.status === 'pending') && (
            <TenancyComplianceChecklist
              tenancyId={tenancy.id}
              tenantType={tenantType}
              tenantId={tenantId}
              propertyId={tenancy.property?.id}
            />
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

 export default function TenantDetail() {
    const { tenantId } = useParams<{ tenantId: string }>();
    const queryClient = useQueryClient();
     const [showTenancyDialog, setShowTenancyDialog] = useState(false);
     const [showUploadDoc, setShowUploadDoc] = useState(false);
     const [sendingCerts, setSendingCerts] = useState(false);
      const [certsSent, setCertsSent] = useState(false);
      const [showEditDialog, setShowEditDialog] = useState(false);
    const { toast } = useToast();

    const { data: tenant, isLoading: tenantLoading } = useTenant(tenantId!);
    const { data: tenancies, isLoading: tenanciesLoading } = useTenancies({ tenantId });

    // Fetch documents linked to this tenant or their tenancies
    const tenancyIds = tenancies?.map(t => t.id) || [];
    const { data: tenantDocuments } = useQuery({
      queryKey: ['tenant-documents', tenantId, tenancyIds],
      queryFn: async () => {
        // Get documents by tenant_id OR tenancy_id
        let allDocs: any[] = [];
        
        // Docs linked directly to tenant
        const { data: byTenant } = await supabase
          .from('documents')
          .select('*')
          .eq('tenant_id', tenantId!)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (byTenant) allDocs.push(...byTenant);

        // Docs linked to tenancies
        if (tenancyIds.length > 0) {
          const { data: byTenancy } = await supabase
            .from('documents')
            .select('*')
            .in('tenancy_id', tenancyIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          if (byTenancy) allDocs.push(...byTenancy);
        }

        // Also include tenancy agreements stored as URLs on the tenancy record
        const agreementDocs = tenancies
          ?.filter(t => t.tenancy_agreement_url)
          .map(t => ({
            id: `agreement-${t.id}`,
            original_file_name: `Tenancy Agreement - ${t.property.address_line}`,
            file_url: t.tenancy_agreement_url,
            created_at: t.start_date,
            doc_type: 'tenancy_agreement',
            category: 'tenancy',
            _isAgreementUrl: true,
          })) || [];

        // Deduplicate by id
        const docMap = new Map(allDocs.map(d => [d.id, d]));
        agreementDocs.forEach(a => { if (!docMap.has(a.id)) docMap.set(a.id, a); });
        
        return Array.from(docMap.values());
      },
      enabled: !!tenantId && !tenanciesLoading,
     });

   const activeTenancy = tenancies?.find(t => t.status === 'active');
   const activeTenancies = tenancies?.filter(t => t.status === 'active' || t.status === 'notice') || [];

   // Compute compliance summary from cached tenancy compliance queries
   const complianceSummary = useMemo(() => {
     if (!activeTenancies.length) return { compliant: 0, incomplete: 0 };
     
     let compliant = 0;
     let incomplete = 0;
     
     for (const tenancy of activeTenancies) {
       const cached = queryClient.getQueryData<any[]>(['tenancy-compliance', tenancy.id]);
       if (!cached) continue;
       
       const applicable = cached.filter((i: any) => i.is_applicable && i.is_required);
       const completed = applicable.filter((i: any) => i.completed_date);
       
       if (applicable.length > 0 && completed.length === applicable.length) {
         compliant++;
       } else if (applicable.length > 0) {
         incomplete++;
       }
     }
     
     return { compliant, incomplete };
   }, [activeTenancies, queryClient]);
 
   if (tenantLoading || tenanciesLoading) return <AppLayout><LoadingState text="Loading tenant..." /></AppLayout>;
   if (!tenant) return <AppLayout><div className="p-6">Tenant not found</div></AppLayout>;

   const status = statusConfig[tenant.status];
   const isCompany = tenant.tenant_type === 'company';
    const displayName = isCompany
      ? (tenant.company_name || `${tenant.first_name} ${tenant.last_name}`)
      : `${tenant.first_name} ${tenant.last_name}`;

    const handleSendCertificates = async () => {
      if (!activeTenancy) {
        toast({ title: 'No active tenancy', description: 'Cannot send certificates without an active tenancy.', variant: 'destructive' });
        return;
      }
      const recipientEmail = tenant.compliance_contact_email
        || (isCompany ? (tenant.company_contact_email || tenant.email) : tenant.email);
      if (!recipientEmail) {
        toast({ title: 'No email address', description: 'This tenant has no email address on file.', variant: 'destructive' });
        return;
      }

      setSendingCerts(true);
      setCertsSent(false);
      try {
        const { data, error } = await supabase.functions.invoke('send-tenant-certificates', {
          body: {
            tenantId: tenant.id,
            tenancyId: activeTenancy.id,
            propertyId: activeTenancy.property.id,
            complianceTypes: ['EPC', 'Gas Safety Certificate (CP12)'],
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const sentDate = new Date().toISOString().split('T')[0];
        const sentDateFormatted = format(new Date(), 'dd MMM yyyy');

        // Auto-complete the tenancy compliance items for epc_to_tenant and gas_cert_to_tenant
        const { data: complianceItems } = await supabase
          .from('tenancy_compliance_items')
          .select('id, item_type, label')
          .eq('tenancy_id', activeTenancy.id)
          .in('item_type', ['epc_to_tenant', 'gas_cert_to_tenant'])
          .is('completed_date', null);

        if (complianceItems && complianceItems.length > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase
            .from('tenancy_compliance_items')
            .update({
              completed_date: sentDate,
              completed_by: user?.email || 'System',
              notes: `Auto-completed: certificates emailed to ${recipientEmail} on ${sentDateFormatted}`,
              updated_at: new Date().toISOString(),
            })
            .in('id', complianceItems.map(i => i.id));
        }

        // Create an audit document record
        const orgId = await getUserOrgId();
        if (orgId) {
          // Create PDF entirely with pdf-lib
          const mergedPdf = await PDFDocument.create();
          const helvetica = await mergedPdf.embedFont(StandardFonts.Helvetica);
          const helveticaBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

          // Cover page
          const coverPage = mergedPdf.addPage([595, 842]); // A4
          const { width: pw, height: ph } = coverPage.getSize();

          // Title
          coverPage.drawText('Compliance Certificates — Audit Record', {
            x: 50, y: ph - 60, size: 18, font: helveticaBold, color: rgb(0, 0, 0),
          });

          // Line
          coverPage.drawLine({
            start: { x: 50, y: ph - 72 },
            end: { x: pw - 50, y: ph - 72 },
            thickness: 1,
            color: rgb(0.78, 0.78, 0.78),
          });

          // Details
          const details = [
            ['Date Sent', sentDateFormatted],
            ['Tenant', displayName],
            ['Email', recipientEmail],
            ['Property', activeTenancy.property.address_line],
            ['Certificates', 'EPC, Gas Safety Certificate (CP12)'],
            ['Sent To', data.sentTo || recipientEmail],
          ];
          let y = ph - 100;
          for (const [label, value] of details) {
            coverPage.drawText(`${label}:`, { x: 50, y, size: 11, font: helveticaBold });
            coverPage.drawText(String(value), { x: 160, y, size: 11, font: helvetica });
            y -= 20;
          }

          y -= 15;
          coverPage.drawText(
            'This document confirms that the above compliance certificates were emailed',
            { x: 50, y, size: 10, font: helvetica }
          );
          coverPage.drawText(
            'to the tenant on the date shown. Copies of the certificates are appended below.',
            { x: 50, y: y - 14, size: 10, font: helvetica }
          );

          // Footer
          coverPage.drawText(`Generated ${sentDateFormatted} — Hydrogen Capital`, {
            x: pw / 2 - 80, y: 30, size: 8, font: helvetica, color: rgb(0.6, 0.6, 0.6),
          });

          // Fetch compliance certificate files and append them
          const { data: compDocs } = await supabase
            .from('compliance_items')
            .select('id, compliance_type, compliance_documents(file_url, original_file_name, file_type)')
            .eq('property_id', activeTenancy.property.id)
            .eq('org_id', orgId)
            .in('compliance_type', ['EPC', 'Gas Safety Certificate (CP12)']);

          if (compDocs) {
            for (const item of compDocs) {
              const docs = (item as any).compliance_documents || [];
              for (const certDoc of docs) {
                try {
                  // Try to download the file
                  const urlObj = new URL(certDoc.file_url);
                  const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/compliance\/(.+)/);
                  let fileData: ArrayBuffer | null = null;

                  if (pathMatch) {
                    const storagePath = decodeURIComponent(pathMatch[1]);
                    const { data: blob } = await supabase.storage.from('compliance').download(storagePath);
                    if (blob) fileData = await blob.arrayBuffer();
                  } else {
                    const resp = await fetch(certDoc.file_url);
                    if (resp.ok) fileData = await resp.arrayBuffer();
                  }

                  if (!fileData) continue;

                  const fileName = (certDoc.original_file_name || '').toLowerCase();
                  const fileType = (certDoc.file_type || '').toLowerCase();

                  if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
                    // Merge PDF pages
                    const certPdf = await PDFDocument.load(fileData);
                    const pages = await mergedPdf.copyPages(certPdf, certPdf.getPageIndices());
                    pages.forEach(p => mergedPdf.addPage(p));
                  } else if (fileName.match(/\.(jpg|jpeg|png)$/) || fileType.startsWith('image/')) {
                    // Embed image as a new page
                    const isJpg = fileName.match(/\.(jpg|jpeg)$/) || fileType === 'image/jpeg';
                    const img = isJpg
                      ? await mergedPdf.embedJpg(fileData)
                      : await mergedPdf.embedPng(fileData);
                    const imgDims = img.scale(1);
                    const page = mergedPdf.addPage([imgDims.width, imgDims.height]);
                    page.drawImage(img, { x: 0, y: 0, width: imgDims.width, height: imgDims.height });
                  }
                } catch (e) {
                  console.warn('Could not append certificate:', certDoc.original_file_name, e);
                }
              }
            }
          }

          const finalPdfBytes = await mergedPdf.save();
          console.log('PDF generated, byte length:', finalPdfBytes.length);
          // Create a clean ArrayBuffer copy to avoid Uint8Array/SharedArrayBuffer issues
          const pdfArrayBuffer = new ArrayBuffer(finalPdfBytes.length);
          new Uint8Array(pdfArrayBuffer).set(finalPdfBytes);
          const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
          const fileName = `CertsSent_${displayName.replace(/\s+/g, '')}_${sentDate}.pdf`;
          const filePath = `${orgId}/${crypto.randomUUID()}.pdf`;

          await supabase.storage.from('documents').upload(filePath, pdfBlob);
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

          await supabase.from('documents').insert({
            org_id: orgId,
            file_url: urlData.publicUrl,
            original_file_name: fileName,
            display_name: `Certificates Sent — ${displayName} — ${sentDateFormatted}`,
            doc_type: 'other',
            category: 'tenancy',
            tenant_id: tenant.id,
            tenancy_id: activeTenancy.id,
            property_id: activeTenancy.property.id,
            review_status: 'accepted',
            description: `Audit record: EPC & Gas Safety certificates emailed to ${recipientEmail}`,
          });
        }

        setCertsSent(true);
        toast({ title: 'Certificates sent', description: `EPC & Gas Safety emailed to ${data.sentTo}` });
        queryClient.invalidateQueries({ queryKey: ['tenant-documents'] });
        queryClient.invalidateQueries({ queryKey: ['tenancy-compliance'] });
      } catch (err: any) {
        toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
      } finally {
        setSendingCerts(false);
      }
    };
 
   return (
     <AppLayout>
       <div className="space-y-6 p-4 lg:p-6">
         {/* Header */}
         <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" asChild>
             <Link to="/tenants">
               <ArrowLeft className="h-5 w-5" />
             </Link>
           </Button>
           <div className="flex-1">
             <div className="flex items-center gap-3">
               {isCompany ? <Building2 className="h-5 w-5 text-muted-foreground" /> : <User className="h-5 w-5 text-muted-foreground" />}
               <h1 className="text-2xl font-bold">
                 {displayName}
               </h1>
               <Badge variant={status.variant}>{status.label}</Badge>
               {isCompany && tenant.company_number && (
                 <Badge variant="outline" className="text-xs">{tenant.company_number}</Badge>
               )}
             </div>
              {tenancies && tenancies.length > 0 && (
                <p className="text-muted-foreground">
                  {activeTenancies.length > 1
                    ? `${activeTenancies.length} active properties · £${activeTenancies.reduce((s, t) => s + t.rent_amount_pcm, 0).toLocaleString()}/mo total rent`
                    : activeTenancy
                      ? `${activeTenancy.room.room_name === 'Whole Property' ? activeTenancy.property.address_line : activeTenancy.room.room_name + ' at ' + activeTenancy.property.address_line}`
                      : 'No active tenancies'
                  }
                </p>
              )}
           </div>
            <Button variant="outline" onClick={() => setShowEditDialog(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Tenant
            </Button>
         </div>
 
         <div className="grid lg:grid-cols-3 gap-6">
           {/* Contact & Details */}
           <div className="space-y-6">
             {isCompany ? (
               <>
                 {/* Company Details Card */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg flex items-center gap-2">
                       <Building2 className="h-5 w-5" />
                       Company Details
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-3 text-sm">
                     <div>
                       <span className="text-muted-foreground">Name:</span>{' '}
                       <span className="font-medium">{tenant.company_name}</span>
                     </div>
                     {tenant.company_number && (
                       <div>
                         <span className="text-muted-foreground">Number:</span> {tenant.company_number}
                       </div>
                     )}
                     {tenant.company_registered_address && (
                       <div>
                         <span className="text-muted-foreground">Registered Address:</span> {tenant.company_registered_address}
                       </div>
                     )}
                     {tenant.trading_name && (
                       <div>
                         <span className="text-muted-foreground">Trading As:</span> {tenant.trading_name}
                       </div>
                     )}
                     {tenant.vat_registered && (
                       <div>
                         <span className="text-muted-foreground">VAT:</span> {tenant.vat_number || 'Registered'}
                       </div>
                     )}
                   </CardContent>
                 </Card>

                 {/* Contact Details Card */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg flex items-center gap-2">
                       <Users className="h-5 w-5" />
                       Contact Details
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-3 text-sm">
                     {tenant.company_contact_name && (
                       <div>
                         <span className="font-medium">{tenant.company_contact_name}</span>
                         {tenant.company_contact_role && (
                           <span className="text-muted-foreground"> ({tenant.company_contact_role})</span>
                         )}
                       </div>
                     )}
                     {(tenant.company_contact_email || tenant.email) && (
                       <div className="flex items-center gap-2">
                         <Mail className="h-4 w-4 text-muted-foreground" />
                         <a href={`mailto:${tenant.company_contact_email || tenant.email}`} className="text-primary hover:underline">
                           {tenant.company_contact_email || tenant.email}
                         </a>
                       </div>
                     )}
                     {(tenant.company_contact_phone || tenant.phone) && (
                       <div className="flex items-center gap-2">
                         <Phone className="h-4 w-4 text-muted-foreground" />
                         <a href={`tel:${tenant.company_contact_phone || tenant.phone}`} className="hover:underline">
                           {tenant.company_contact_phone || tenant.phone}
                         </a>
                       </div>
                     )}
                    </CardContent>
                  </Card>

                  {/* Compliance Contact */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Compliance / Certificates Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {tenant.compliance_contact_name ? (
                        <>
                          <p className="font-medium">{tenant.compliance_contact_name}</p>
                          {tenant.compliance_contact_email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <a href={`mailto:${tenant.compliance_contact_email}`} className="text-primary hover:underline">
                                {tenant.compliance_contact_email}
                              </a>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground italic">No compliance contact set</p>
                      )}
                    </CardContent>
                  </Card>
                </>
             ) : (
               <>
                 {/* Individual Contact */}
                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg flex items-center gap-2">
                       <User className="h-5 w-5" />
                       Contact Details
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-3">
                     {tenant.email && (
                       <div className="flex items-center gap-2">
                         <Mail className="h-4 w-4 text-muted-foreground" />
                         <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">
                           {tenant.email}
                         </a>
                       </div>
                     )}
                     {tenant.phone && (
                       <div className="flex items-center gap-2">
                         <Phone className="h-4 w-4 text-muted-foreground" />
                         <a href={`tel:${tenant.phone}`} className="hover:underline">
                           {tenant.phone}
                         </a>
                       </div>
                     )}
                     {tenant.date_of_birth && (
                       <div className="flex items-center gap-2">
                         <Calendar className="h-4 w-4 text-muted-foreground" />
                         <span>{format(new Date(tenant.date_of_birth), 'dd MMM yyyy')}</span>
                       </div>
                     )}
                    </CardContent>
                  </Card>

                  {/* Compliance Contact */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Compliance / Certificates Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {tenant.compliance_contact_name ? (
                        <>
                          <p className="font-medium">{tenant.compliance_contact_name}</p>
                          {tenant.compliance_contact_email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <a href={`mailto:${tenant.compliance_contact_email}`} className="text-primary hover:underline">
                                {tenant.compliance_contact_email}
                              </a>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground italic">No compliance contact set</p>
                      )}
                    </CardContent>
                  </Card>
  
                 {tenant.emergency_contact_name && (
                   <Card>
                     <CardHeader>
                       <CardTitle className="text-lg flex items-center gap-2">
                         <Shield className="h-5 w-5" />
                         Emergency Contact
                       </CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-2 text-sm">
                       <p className="font-medium">{tenant.emergency_contact_name}</p>
                       {tenant.emergency_contact_relationship && (
                         <p className="text-muted-foreground">{tenant.emergency_contact_relationship}</p>
                       )}
                       {tenant.emergency_contact_phone && (
                         <a href={`tel:${tenant.emergency_contact_phone}`} className="text-primary hover:underline">
                           {tenant.emergency_contact_phone}
                         </a>
                       )}
                     </CardContent>
                   </Card>
                 )}
 
                 {tenant.employer_name && (
                   <Card>
                     <CardHeader>
                       <CardTitle className="text-lg flex items-center gap-2">
                         <Briefcase className="h-5 w-5" />
                         Employment
                       </CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-2 text-sm">
                       <p><span className="text-muted-foreground">Status:</span> {tenant.employment_status || 'Not specified'}</p>
                       <p><span className="text-muted-foreground">Employer:</span> {tenant.employer_name}</p>
                       {tenant.annual_income && (
                         <p><span className="text-muted-foreground">Income:</span> £{tenant.annual_income.toLocaleString()}/year</p>
                       )}
                     </CardContent>
                   </Card>
                 )}
               </>
             )}
           </div>
 
           {/* Tenancy History */}
           <div className="lg:col-span-2">
             <Tabs defaultValue="tenancies">
               <TabsList>
                 <TabsTrigger value="tenancies">Tenancies</TabsTrigger>
                 <TabsTrigger value="rent">Rent History</TabsTrigger>
                 <TabsTrigger value="documents">Documents</TabsTrigger>
               </TabsList>
 
                <TabsContent value="tenancies" className="mt-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Tenancy History</h3>
                    {tenant.status !== 'blacklisted' && (
                      <Button onClick={() => setShowTenancyDialog(true)}>
                        <Home className="h-4 w-4 mr-2" />
                        Create Tenancy
                      </Button>
                    )}
                  </div>

                  {/* Portfolio Summary Strip — only show for 2+ active tenancies */}
                  {activeTenancies.length > 1 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card>
                        <CardContent className="p-3">
                          <p className="text-xs text-muted-foreground">Active Properties</p>
                          <p className="text-xl font-bold">{activeTenancies.length}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3">
                          <p className="text-xs text-muted-foreground">Total Monthly Rent</p>
                          <p className="text-xl font-bold text-primary">
                            £{activeTenancies.reduce((s, t) => s + t.rent_amount_pcm, 0).toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3">
                          <p className="text-xs text-muted-foreground">Fully Compliant</p>
                          <p className="text-xl font-bold text-primary">
                            {complianceSummary.compliant}/{activeTenancies.length}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-3">
                          <p className="text-xs text-muted-foreground">Needs Attention</p>
                          <p className={`text-xl font-bold ${complianceSummary.incomplete > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {complianceSummary.incomplete}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Tenancies — use Accordion for expandable rows */}
                  {tenancies?.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No tenancies yet
                      </CardContent>
                    </Card>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-2">
                      {tenancies?.map(tenancy => (
                        <TenancyRow
                          key={tenancy.id}
                          tenancy={tenancy}
                          tenantType={tenant.tenant_type as 'individual' | 'company'}
                          tenantId={tenantId!}
                          isCompany={isCompany}
                          tenant={tenant}
                        />
                      ))}
                    </Accordion>
                  )}

                  {/* Send Certificates — for multi-property, show per-property or bulk */}
                  {activeTenancies.length > 0 && (
                    <Card>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">Send Compliance Certificates</p>
                          <p className="text-sm text-muted-foreground">
                            Email EPC & Gas Safety certificates to {tenant.compliance_contact_email || (isCompany ? (tenant.company_contact_email || tenant.email) : tenant.email)}
                            {activeTenancies.length > 1 && ` for ${activeTenancies.length} properties`}
                          </p>
                        </div>
                        <Button
                          onClick={handleSendCertificates}
                          disabled={sendingCerts}
                          variant={certsSent ? 'outline' : 'default'}
                        >
                          {sendingCerts ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                          ) : certsSent ? (
                            <><CheckCircle2 className="h-4 w-4 mr-2" />Sent</>
                          ) : (
                            <><Send className="h-4 w-4 mr-2" />Send Certificates</>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
 
                <TabsContent value="rent" className="mt-4">
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <PoundSterling className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Rent history will be shown here
                    </CardContent>
                  </Card>
                </TabsContent>
 
                  <TabsContent value="documents" className="mt-4 space-y-4">
                    <div className="flex justify-end">
                      <Button onClick={() => setShowUploadDoc(true)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Document
                      </Button>
                    </div>

                  {!tenantDocuments || tenantDocuments.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No documents yet
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {tenantDocuments.map((doc: any) => (
                        <Card key={doc.id}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{doc.display_name || doc.original_file_name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {doc.doc_type && <Badge variant="outline" className="text-[10px]">{doc.doc_type}</Badge>}
                                  {doc.created_at && <span>{format(new Date(doc.created_at), 'dd MMM yyyy')}</span>}
                                </div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View
                              </a>
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
             </Tabs>
           </div>
         </div>
 
           <CreateTenancyDialog
             open={showTenancyDialog}
             onOpenChange={setShowTenancyDialog}
             tenantId={tenant.id}
             tenantName={isCompany ? (tenant.company_name || `${tenant.first_name} ${tenant.last_name}`) : `${tenant.first_name} ${tenant.last_name}`}
             tenantType={(tenant.tenant_type as 'individual' | 'company') || 'individual'}
           />

           <UploadDocumentDialog
             open={showUploadDoc}
             onOpenChange={(open) => {
               setShowUploadDoc(open);
               if (!open) queryClient.invalidateQueries({ queryKey: ['tenant-documents'] });
             }}
             tenantId={tenantId}
             tenancyId={activeTenancy?.id}
             propertyId={activeTenancy?.property?.id}
             entityType="tenancy"
            />

            <EditTenantDialog
              tenant={tenant}
              open={showEditDialog}
              onOpenChange={setShowEditDialog}
            />
          </div>
     </AppLayout>
   );
 }

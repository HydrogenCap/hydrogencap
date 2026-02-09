import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import { ArrowLeft, Mail, Phone, User, Building2, Calendar, Briefcase, Shield, Home, PoundSterling, Edit, FileText, Users, Upload, ExternalLink, Download, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId } from '@/hooks/useUserOrg';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useTenant, TenantStatus } from '@/hooks/useTenants';
import { useTenancies } from '@/hooks/useTenancies';
import { LoadingState } from '@/components/common';
import { TenancyComplianceChecklist } from '@/components/tenants/TenancyComplianceChecklist';
import CreateTenancyDialog from '@/components/tenants/CreateTenancyDialog';
import { UploadDocumentDialog } from '@/components/documents/UploadDocumentDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
 
const statusConfig: Record<TenantStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
   prospect: { label: 'Prospect', variant: 'outline' },
   active: { label: 'Active', variant: 'default' },
   past: { label: 'Past', variant: 'secondary' },
   blacklisted: { label: 'Blacklisted', variant: 'destructive' },
 };
 
 export default function TenantDetail() {
    const { tenantId } = useParams<{ tenantId: string }>();
    const queryClient = useQueryClient();
     const [showTenancyDialog, setShowTenancyDialog] = useState(false);
     const [showUploadDoc, setShowUploadDoc] = useState(false);
     const [sendingCerts, setSendingCerts] = useState(false);
     const [certsSent, setCertsSent] = useState(false);
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
 
  if (tenantLoading || tenanciesLoading) return <AppLayout><LoadingState text="Loading tenant..." /></AppLayout>;
   if (!tenant) return <AppLayout><div className="p-6">Tenant not found</div></AppLayout>;
 
   const activeTenancy = tenancies?.find(t => t.status === 'active');
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
      const recipientEmail = isCompany
        ? (tenant.company_contact_email || tenant.email)
        : tenant.email;
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
          // Generate audit cover page with jsPDF
          const doc = new jsPDF();
          const pageWidth = doc.internal.pageSize.getWidth();

          // Header
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.text('Compliance Certificates — Audit Record', pageWidth / 2, 30, { align: 'center' });

          doc.setDrawColor(200);
          doc.line(20, 36, pageWidth - 20, 36);

          // Details
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          let y = 50;
          const details = [
            ['Date Sent', sentDateFormatted],
            ['Tenant', displayName],
            ['Email', recipientEmail],
            ['Property', activeTenancy.property.address_line],
            ['Certificates', 'EPC, Gas Safety Certificate (CP12)'],
            ['Sent To', data.sentTo || recipientEmail],
          ];
          for (const [label, value] of details) {
            doc.setFont('helvetica', 'bold');
            doc.text(`${label}:`, 25, y);
            doc.setFont('helvetica', 'normal');
            doc.text(String(value), 70, y);
            y += 8;
          }

          y += 10;
          doc.setFontSize(10);
          doc.text(
            'This document confirms that the above compliance certificates were emailed to the tenant',
            25, y
          );
          doc.text('on the date shown. Copies of the certificates are appended below.', 25, y + 6);

          // Footer
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Generated ${sentDateFormatted} — Hydrogen Capital`, pageWidth / 2, 285, { align: 'center' });

          // Convert cover page to pdf-lib format for merging
          const coverBytes = doc.output('arraybuffer');
          const mergedPdf = await PDFDocument.load(coverBytes);

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
          const pdfBlob = new Blob([finalPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
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
             {activeTenancy && (
               <p className="text-muted-foreground">
                 {activeTenancy.room.room_name} at {activeTenancy.property.address_line}
               </p>
             )}
           </div>
           <Button variant="outline">
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
 
                 {tenancies?.length === 0 ? (
                   <Card>
                     <CardContent className="py-8 text-center text-muted-foreground">
                       No tenancies yet
                     </CardContent>
                   </Card>
                 ) : (
                   <div className="space-y-3">
                     {tenancies?.map(tenancy => (
                       <div key={tenancy.id} className="space-y-3">
                         <Card>
                           <CardContent className="p-4">
                             <div className="flex justify-between items-start">
                               <div>
                                 <div className="flex items-center gap-2 mb-1">
                                    <Home className="h-4 w-4" />
                                    <span className="font-medium">{tenancy.room.room_name === 'Whole Property' ? tenancy.property.address_line : tenancy.room.room_name}</span>
                                   <Badge variant={
                                     tenancy.status === 'active' ? 'default' :
                                     tenancy.status === 'notice' ? 'secondary' : 'outline'
                                   }>
                                     {tenancy.status}
                                   </Badge>
                                 </div>
                                 <p className="text-sm text-muted-foreground">
                                   {tenancy.property.address_line}
                                 </p>
                                 <p className="text-sm text-muted-foreground mt-1">
                                   {format(new Date(tenancy.start_date), 'dd MMM yyyy')} - 
                                   {tenancy.end_date ? format(new Date(tenancy.end_date), ' dd MMM yyyy') : ' Present'}
                                 </p>
                               </div>
                                <div className="text-right">
                                   <p className="font-semibold">£{tenancy.rent_amount_pcm.toLocaleString()}/mo</p>
                                   <p className="text-xs text-muted-foreground">Due day: {tenancy.rent_due_day}</p>
                                   {(tenancy as any).payment_method && (
                                     <Badge variant="outline" className="mt-1 text-[10px]">
                                       {(tenancy as any).payment_method.replace('_', ' ')}
                                     </Badge>
                                   )}
                                   <div className="flex gap-1 mt-2 justify-end">
                                     {tenancy.tenancy_agreement_url ? (
                                       <Button variant="outline" size="sm" asChild>
                                         <a href={tenancy.tenancy_agreement_url} target="_blank" rel="noopener noreferrer">
                                           <FileText className="h-3 w-3 mr-1" />
                                           View Agreement
                                         </a>
                                       </Button>
                                     ) : (
                                       <Button variant="outline" size="sm" className="text-amber-600">
                                         <Upload className="h-3 w-3 mr-1" />
                                         Upload Agreement
                                       </Button>
                                     )}
                                   </div>
                                 </div>
                              </div>
                            </CardContent>
                          </Card>
                         {(tenancy.status === 'active' || tenancy.status === 'pending') && (
                            <TenancyComplianceChecklist
                              tenancyId={tenancy.id}
                              tenantType={tenant.tenant_type as 'individual' | 'company'}
                              tenantId={tenantId}
                              propertyId={tenancy.property?.id}
                            />
                         )}
                       </div>
                     ))}
                   </div>
                 )}

                  {activeTenancy && (
                    <Card>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">Send Compliance Certificates</p>
                          <p className="text-sm text-muted-foreground">
                            Email EPC & Gas Safety certificates to {isCompany ? (tenant.company_contact_email || tenant.email) : tenant.email}
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
         </div>
     </AppLayout>
   );
 }

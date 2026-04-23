import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { sanitizeText } from '@/lib/utils';
import { Building2, User, Loader2, CheckCircle2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useCreateTenant, type TenantType } from '@/hooks/useTenants';
import { useCompaniesHouse } from '@/hooks/useCompaniesHouse';

const companySchema = z.object({
  tenant_type: z.literal('company'),
  company_name: z.string().min(1, 'Company name is required').transform(sanitizeText),
  company_number: z.string().optional().nullable(),
  company_registered_address: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  trading_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  vat_registered: z.boolean().optional().nullable(),
  vat_number: z.string().optional().nullable(),
  company_contact_name: z.string().min(1, 'Contact name is required').transform(sanitizeText),
  company_contact_role: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  company_contact_email: z.union([z.string().email('Invalid email'), z.literal('')]).optional().nullable(),
  company_contact_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  compliance_contact_name: z.string().optional().nullable(),
  compliance_contact_email: z.union([z.string().email('Invalid email'), z.literal('')]).optional().nullable(),
  status: z.enum(['prospect', 'active']).default('prospect'),
});

const individualSchema = z.object({
  tenant_type: z.literal('individual'),
  first_name: z.string().min(1, 'First name is required').transform(sanitizeText),
  last_name: z.string().min(1, 'Last name is required').transform(sanitizeText),
  email: z.union([z.string().email('Invalid email'), z.literal('')]).optional().nullable(),
  phone: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  national_insurance: z.string().optional().nullable(),
  employment_status: z.string().optional().nullable(),
  employer_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  annual_income: z.number().optional().nullable(),
  previous_address: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  previous_landlord_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  previous_landlord_phone: z.string().optional().nullable(),
  guarantor_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  guarantor_email: z.string().optional().nullable(),
  guarantor_phone: z.string().optional().nullable(),
  guarantor_address: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  notes: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  compliance_contact_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  compliance_contact_email: z.union([z.string().email('Invalid email'), z.literal('')]).optional().nullable(),
  status: z.enum(['prospect', 'active']).default('prospect'),
});

interface AddTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTenantDialog({ open, onOpenChange }: AddTenantDialogProps) {
  const navigate = useNavigate();
  const createTenant = useCreateTenant();
  const { lookupCompany, isLookingUp } = useCompaniesHouse();
  const [tenantType, setTenantType] = useState<TenantType>('company');
  const [chVerified, setChVerified] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);

  const companyForm = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      tenant_type: 'company',
      company_name: '',
      company_number: '',
      company_registered_address: '',
      trading_name: '',
      vat_registered: false,
      vat_number: '',
      company_contact_name: '',
      company_contact_role: '',
      company_contact_email: '',
      company_contact_phone: '',
      notes: '',
      status: 'prospect',
    },
  });

  const individualForm = useForm<z.infer<typeof individualSchema>>({
    resolver: zodResolver(individualSchema),
    defaultValues: {
      tenant_type: 'individual',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      national_insurance: '',
      employment_status: '',
      employer_name: '',
      annual_income: null,
      previous_address: '',
      previous_landlord_name: '',
      previous_landlord_phone: '',
      guarantor_name: '',
      guarantor_email: '',
      guarantor_phone: '',
      guarantor_address: '',
      notes: '',
      status: 'prospect',
    },
  });

  const handleCHLookup = async () => {
    const companyNumber = companyForm.getValues('company_number')?.trim();
    if (!companyNumber) return;

    // Validate: UK company numbers are 8 chars, digits or prefixed (SC/NI/OC etc.)
    const isValidFormat = /^[A-Za-z]{0,2}\d{6,8}$/.test(companyNumber);
    if (!isValidFormat) {
      companyForm.setError('company_number', {
        message: 'Enter a valid company number (e.g. 12345678), not a company name',
      });
      return;
    }

    const result = await lookupCompany(companyNumber);
    if (result?.company) {
      companyForm.setValue('company_name', result.company.company_name);
      companyForm.setValue('company_registered_address', result.company.registered_address || '');
      companyForm.setValue('company_number', result.company.company_number);
      setChVerified(true);
    }
  };

  const handleSubmit = async () => {
    if (tenantType === 'company') {
      const valid = await companyForm.trigger();
      if (!valid) return;
      const values = companyForm.getValues();

      // Derive first_name/last_name from contact name for backward compat
      const contactParts = (values.company_contact_name || '').trim().split(/\s+/);
      const firstName = contactParts[0] || values.company_name;
      const lastName = contactParts.length > 1 ? contactParts.slice(1).join(' ') : '(Company)';

      const result = await createTenant.mutateAsync({
        tenant_type: 'company',
        first_name: firstName,
        last_name: lastName,
        company_name: values.company_name,
        company_number: values.company_number || null,
        company_registered_address: values.company_registered_address || null,
        trading_name: values.trading_name || null,
        vat_registered: values.vat_registered || null,
        vat_number: values.vat_registered ? (values.vat_number || null) : null,
        company_contact_name: values.company_contact_name,
        company_contact_role: values.company_contact_role || null,
        company_contact_email: values.company_contact_email || null,
        company_contact_phone: values.company_contact_phone || null,
        email: values.company_contact_email || null,
        phone: values.company_contact_phone || null,
        notes: values.notes || null,
        status: values.status,
        date_of_birth: null,
        national_insurance: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        emergency_contact_relationship: null,
        employment_status: null,
        employer_name: null,
        employer_address: null,
        annual_income: null,
        guarantor_name: null,
        guarantor_email: null,
        guarantor_phone: null,
        guarantor_address: null,
        previous_address: null,
        previous_landlord_name: null,
        previous_landlord_phone: null,
        reference_notes: null,
        portal_user_id: null,
        compliance_contact_name: values.compliance_contact_name || null,
        compliance_contact_email: values.compliance_contact_email || null,
      });

      onOpenChange(false);
      navigate(`/tenants/${result.id}`);
    } else {
      const valid = await individualForm.trigger();
      if (!valid) return;
      const values = individualForm.getValues();

      const result = await createTenant.mutateAsync({
        tenant_type: 'individual',
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || null,
        phone: values.phone || null,
        date_of_birth: values.date_of_birth || null,
        national_insurance: values.national_insurance || null,
        employment_status: values.employment_status || null,
        employer_name: values.employer_name || null,
        employer_address: null,
        annual_income: values.annual_income || null,
        previous_address: values.previous_address || null,
        previous_landlord_name: values.previous_landlord_name || null,
        previous_landlord_phone: values.previous_landlord_phone || null,
        guarantor_name: values.guarantor_name || null,
        guarantor_email: values.guarantor_email || null,
        guarantor_phone: values.guarantor_phone || null,
        guarantor_address: values.guarantor_address || null,
        notes: values.notes || null,
        status: values.status,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        emergency_contact_relationship: null,
        reference_notes: null,
        portal_user_id: null,
        company_name: null,
        company_number: null,
        company_registered_address: null,
        company_contact_name: null,
        company_contact_email: null,
        company_contact_phone: null,
        company_contact_role: null,
        trading_name: null,
        vat_registered: null,
        vat_number: null,
        compliance_contact_name: values.compliance_contact_name || null,
        compliance_contact_email: values.compliance_contact_email || null,
      });

      onOpenChange(false);
      navigate(`/tenants/${result.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Tenant</DialogTitle>
          <DialogDescription>
            Add a new tenant to your portfolio — you can link them to a tenancy afterward.
          </DialogDescription>
        </DialogHeader>

        {/* Type Toggle */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setTenantType('company')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              tenantType === 'company'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            <Building2 className="h-4 w-4" />
            Company
          </button>
          <button
            type="button"
            onClick={() => setTenantType('individual')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              tenantType === 'individual'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            <User className="h-4 w-4" />
            Individual
          </button>
        </div>

        {tenantType === 'company' ? (
          <Form {...companyForm}>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
              {/* Company Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Company Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <FormField
                      control={companyForm.control}
                      name="company_number"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Company Number</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input placeholder="e.g. 12345678" {...field} value={field.value || ''} onChange={(e) => { field.onChange(e); setChVerified(false); }} />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleCHLookup}
                              disabled={isLookingUp || !field.value}
                              className="shrink-0"
                            >
                              {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                              Lookup
                            </Button>
                          </div>
                          {chVerified && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 mt-1">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={companyForm.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Registered company name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={companyForm.control}
                    name="company_registered_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registered Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Registered office address" {...field} value={field.value || ''} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={companyForm.control}
                    name="trading_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trading Name (if different)</FormLabel>
                        <FormControl>
                          <Input placeholder="Trading name" {...field} value={field.value || ''} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center gap-4">
                    <FormField
                      control={companyForm.control}
                      name="vat_registered"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value || false} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">VAT Registered</FormLabel>
                        </FormItem>
                      )}
                    />
                    {companyForm.watch('vat_registered') && (
                      <FormField
                        control={companyForm.control}
                        name="vat_number"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="VAT Number" {...field} value={field.value || ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Primary Contact */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Primary Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <FormField
                    control={companyForm.control}
                    name="company_contact_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={companyForm.control}
                    name="company_contact_role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Director, Office Manager" {...field} value={field.value || ''} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={companyForm.control}
                      name="company_contact_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@company.com" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={companyForm.control}
                      name="company_contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="Phone number" {...field} value={field.value || ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Additional */}
              <Collapsible open={showAdditional} onOpenChange={setShowAdditional}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" type="button" className="w-full justify-start text-muted-foreground">
                    {showAdditional ? '▼' : '▶'} Additional Details
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <FormField
                        control={companyForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="prospect">Prospect</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={companyForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Additional notes..." {...field} value={field.value || ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium mb-3">Compliance / Certificates Contact</p>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={companyForm.control}
                            name="compliance_contact_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Contact name" {...field} value={field.value || ''} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={companyForm.control}
                            name="compliance_contact_email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="email@example.com" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              <Button type="submit" className="w-full" disabled={createTenant.isPending}>
                {createTenant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Company Tenant
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...individualForm}>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
              {/* Personal Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Personal Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={individualForm.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={individualForm.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={individualForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={individualForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input type="tel" {...field} value={field.value || ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={individualForm.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={individualForm.control}
                      name="national_insurance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>National Insurance</FormLabel>
                          <FormControl>
                            <Input placeholder="NI number" {...field} value={field.value || ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Employment */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Employment & Income</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <FormField
                    control={individualForm.control}
                    name="employment_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Status</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="employed">Employed</SelectItem>
                            <SelectItem value="self-employed">Self-Employed</SelectItem>
                            <SelectItem value="unemployed">Unemployed</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={individualForm.control}
                      name="employer_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employer</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={individualForm.control}
                      name="annual_income"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Income (£)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* References */}
              <Collapsible open={showReferences} onOpenChange={setShowReferences}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" type="button" className="w-full justify-start text-muted-foreground">
                    {showReferences ? '▼' : '▶'} References & Previous Address
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <FormField
                        control={individualForm.control}
                        name="previous_address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Previous Address</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={individualForm.control}
                          name="previous_landlord_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Previous Landlord</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ''} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={individualForm.control}
                          name="previous_landlord_phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Landlord Phone</FormLabel>
                              <FormControl>
                                <Input type="tel" {...field} value={field.value || ''} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={individualForm.control}
                        name="guarantor_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Guarantor Name</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={individualForm.control}
                          name="guarantor_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Guarantor Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} value={field.value || ''} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={individualForm.control}
                          name="guarantor_phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Guarantor Phone</FormLabel>
                              <FormControl>
                                <Input type="tel" {...field} value={field.value || ''} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={individualForm.control}
                        name="guarantor_address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Guarantor Address</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              {/* Additional */}
              <Collapsible open={showAdditional} onOpenChange={setShowAdditional}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" type="button" className="w-full justify-start text-muted-foreground">
                    {showAdditional ? '▼' : '▶'} Additional Details
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <FormField
                        control={individualForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="prospect">Prospect</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={individualForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Additional notes..." {...field} value={field.value || ''} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium mb-3">Compliance / Certificates Contact</p>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={individualForm.control}
                            name="compliance_contact_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Contact name" {...field} value={field.value || ''} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={individualForm.control}
                            name="compliance_contact_email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="email@example.com" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              <Button type="submit" className="w-full" disabled={createTenant.isPending}>
                {createTenant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Individual Tenant
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

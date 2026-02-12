import { Mail, Phone, Calendar, Briefcase, Building2, User, Users, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Tenant } from '@/hooks/useTenants';

interface TenantContactCardsProps {
  tenant: Tenant;
  isCompany: boolean;
}

export function TenantContactCards({ tenant, isCompany }: TenantContactCardsProps) {
  if (isCompany) {
    return (
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

        <ComplianceContactCard tenant={tenant} />
      </>
    );
  }

  return (
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

      <ComplianceContactCard tenant={tenant} />

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
  );
}

function ComplianceContactCard({ tenant }: { tenant: Tenant }) {
  return (
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
  );
}

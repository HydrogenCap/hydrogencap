import { Link } from 'react-router-dom';
import { MapPin, Briefcase, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Job {
  property_id: string;
  property?: { address_line?: string | null; postcode?: string | null } | null;
  contractor?: { name?: string; company_name?: string | null; phone?: string | null; email?: string | null } | null;
}

export function PropertyAndContractorCards({ job }: { job: Job }) {
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Property
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link to={`/properties/${job.property_id}`} className="hover:text-primary">
            <p className="font-medium">{job.property?.address_line}</p>
            <p className="text-sm text-muted-foreground">{job.property?.postcode}</p>
          </Link>
        </CardContent>
      </Card>

      {job.contractor && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Contractor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{job.contractor.name}</p>
            {job.contractor.company_name && (
              <p className="text-sm text-muted-foreground">{job.contractor.company_name}</p>
            )}
            <div className="flex items-center gap-4 mt-3">
              {job.contractor.phone && (
                <a href={`tel:${job.contractor.phone}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                  <Phone className="h-3 w-3" />
                  {job.contractor.phone}
                </a>
              )}
              {job.contractor.email && (
                <a href={`mailto:${job.contractor.email}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                  <Mail className="h-3 w-3" />
                  {job.contractor.email}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

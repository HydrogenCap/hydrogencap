import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, Building, Shield, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

const WIZARDS = [
  {
    id: 'add_property',
    title: 'Add Property',
    description: 'Register a new property with address, ownership, compliance, and finance details.',
    icon: MapPin,
    path: '/wizards/add-property',
    color: 'text-primary',
  },
  {
    id: 'add_entity',
    title: 'Add Entity',
    description: 'Create a new legal entity — limited company, LLP, trust, or individual.',
    icon: Building,
    path: '/wizards/add-entity',
    color: 'text-primary',
  },
  {
    id: 'add_compliance',
    title: 'Add Compliance Record',
    description: 'Record a new compliance certificate for an existing property.',
    icon: Shield,
    path: '/wizards/add-compliance',
    color: 'text-primary',
  },
];

export default function Wizards() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-2">Wizards</h1>
        <p className="text-muted-foreground mb-8">
          Step-by-step guided workflows for adding new data with built-in validation.
        </p>

        <div className="space-y-4">
          {WIZARDS.map((w) => (
            <button
              key={w.id}
              onClick={() => navigate(w.path)}
              className="w-full flex items-center gap-4 rounded-lg border border-border bg-card p-5 text-left hover:border-primary/50 hover:bg-accent/50 transition-colors group"
            >
              <div className={`p-3 rounded-lg bg-primary/10 ${w.color}`}>
                <w.icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{w.title}</h3>
                <p className="text-sm text-muted-foreground">{w.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { User } from 'lucide-react';
import { TEXT } from '@/lib/design-tokens';

const ROLES = [
  { value: 'landlord_investor', label: 'Landlord / Investor' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'other', label: 'Other' },
];

const PORTFOLIO_SIZES = [
  { value: '1-5', label: '1–5 properties' },
  { value: '6-20', label: '6–20 properties' },
  { value: '21-50', label: '21–50 properties' },
  { value: '50+', label: '50+' },
];

interface AboutYouStepProps {
  fullName: string;
  onFullNameChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  portfolioSize: string;
  onPortfolioSizeChange: (value: string) => void;
}

export function AboutYouStep({
  fullName,
  onFullNameChange,
  role,
  onRoleChange,
  portfolioSize,
  onPortfolioSizeChange,
}: AboutYouStepProps) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <User className="mx-auto h-10 w-10 text-primary" />
        <h2 className={TEXT.sectionHeading}>About You</h2>
        <p className={TEXT.label}>Tell us a bit about yourself so we can tailor your experience.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={e => onFullNameChange(e.target.value)}
          placeholder="David Smith"
          className="bg-input border-border"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>Your role</Label>
        <RadioGroup value={role} onValueChange={onRoleChange} className="grid grid-cols-1 gap-2">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-center space-x-2">
              <RadioGroupItem value={r.value} id={`role-${r.value}`} />
              <Label htmlFor={`role-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Portfolio size</Label>
        <RadioGroup value={portfolioSize} onValueChange={onPortfolioSizeChange} className="grid grid-cols-2 gap-2">
          {PORTFOLIO_SIZES.map(s => (
            <div key={s.value} className="flex items-center space-x-2">
              <RadioGroupItem value={s.value} id={`size-${s.value}`} />
              <Label htmlFor={`size-${s.value}`} className="font-normal cursor-pointer">{s.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}

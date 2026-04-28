import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TaxpayerType } from '../hooks/useTaxDashboardState';

export function TaxProfileCard({
  taxpayerType, setTaxpayerType,
  otherIncome, setOtherIncome,
  personalAllowance, setPersonalAllowance,
  handleSaveProfile, isPending,
}: {
  taxpayerType: TaxpayerType;
  setTaxpayerType: (v: TaxpayerType) => void;
  otherIncome: string;
  setOtherIncome: (v: string) => void;
  personalAllowance: string;
  setPersonalAllowance: (v: string) => void;
  handleSaveProfile: () => void;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tax Profile</CardTitle>
        <CardDescription>Configure your taxpayer details for accurate calculations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Taxpayer Type</Label>
            <Select value={taxpayerType} onValueChange={(v) => setTaxpayerType(v as TaxpayerType)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Other Income (£)</Label>
            <Input
              type="number"
              className="w-[130px]"
              placeholder="0"
              value={otherIncome}
              onChange={(e) => setOtherIncome(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Personal Allowance (£)</Label>
            <Input
              type="number"
              className="w-[130px]"
              value={personalAllowance}
              onChange={(e) => setPersonalAllowance(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={isPending}>
            Save Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

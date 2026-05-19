import { ShieldCheck, AlertTriangle, Check, X, Pencil, ExternalLink, Home, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RentersRightsBillState } from '../hooks/useRentersRightsBillState';

export function EvidenceLogCard({ state }: { state: RentersRightsBillState }) {
  const {
    settingsLoading, updateSettingPending,
    ombudsmanNumber, portalNumber,
    editingOmbudsman, setEditingOmbudsman, ombudsmanDraft, setOmbudsmanDraft, saveOmbudsman,
    editingPortal, setEditingPortal, portalDraft, setPortalDraft, savePortal,
  } = state;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ombudsman Registration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!editingOmbudsman ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Registration Number</p>
                <p className={`font-medium ${ombudsmanNumber ? '' : 'text-muted-foreground'}`}>
                  {settingsLoading ? '…' : ombudsmanNumber || 'Not recorded'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ombudsmanNumber
                  ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                <Button aria-label="Edit" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setOmbudsmanDraft(ombudsmanNumber); setEditingOmbudsman(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Registration Number</Label>
              <Input value={ombudsmanDraft} onChange={e => setOmbudsmanDraft(e.target.value)} placeholder="e.g. OM-12345678" />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveOmbudsman} disabled={updateSettingPending}>
                  <Check className="h-3 w-3 mr-1" />Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingOmbudsman(false)}>
                  <X className="h-3 w-3 mr-1" />Cancel
                </Button>
              </div>
            </div>
          )}
          {!ombudsmanNumber && !editingOmbudsman && (
            <p className="text-xs text-amber-600">
              ⚠️ Mandatory membership required under the Renters' Rights Act. Register at the government-approved scheme.
            </p>
          )}
          <a href="https://www.gov.uk/government/consultations/new-ombudsman-for-the-private-rented-sector" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Private Rented Sector Ombudsman <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4" />
            Property Portal Registration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!editingPortal ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Registration Number</p>
                <p className={`font-medium ${portalNumber ? '' : 'text-muted-foreground'}`}>
                  {settingsLoading ? '…' : portalNumber || 'Not recorded'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {portalNumber
                  ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                <Button aria-label="Edit" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setPortalDraft(portalNumber); setEditingPortal(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Registration Number</Label>
              <Input value={portalDraft} onChange={e => setPortalDraft(e.target.value)} placeholder="e.g. PRP-87654321" />
              <div className="flex gap-2">
                <Button size="sm" onClick={savePortal} disabled={updateSettingPending}>
                  <Check className="h-3 w-3 mr-1" />Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingPortal(false)}>
                  <X className="h-3 w-3 mr-1" />Cancel
                </Button>
              </div>
            </div>
          )}
          {!portalNumber && !editingPortal && (
            <p className="text-xs text-amber-600">
              ⚠️ All landlords must register on the Property Portal before letting. Failure is a criminal offence.
            </p>
          )}
          <a href="https://www.gov.uk/government/news/new-property-portal-to-drive-up-standards-in-private-rented-sector" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Private Rented Sector Property Portal <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

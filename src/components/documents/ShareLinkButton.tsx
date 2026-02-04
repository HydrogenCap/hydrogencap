import { useState } from 'react';
import { format } from 'date-fns';
import { Link2, Copy, Clock, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useDocumentShareLinks,
  useCreateDocumentShareLink,
  useDeactivateShareLink,
  generateShareUrl,
} from '@/hooks/useDocumentShareLinks';

interface ShareLinkButtonProps {
  documentId?: string;
  complianceDocumentId?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
}

export function ShareLinkButton({
  documentId,
  complianceDocumentId,
  variant = 'ghost',
  size = 'sm',
}: ShareLinkButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [maxViews, setMaxViews] = useState('');

  const { data: existingLinks } = useDocumentShareLinks(documentId, complianceDocumentId);
  const createLink = useCreateDocumentShareLink();
  const deactivateLink = useDeactivateShareLink();

  const handleCreateLink = async () => {
    const result = await createLink.mutateAsync({
      documentId,
      complianceDocumentId,
      expiresInDays: parseInt(expiresInDays),
      maxViews: maxViews ? parseInt(maxViews) : undefined,
    });

    if (result) {
      const url = generateShareUrl(result.token);
      navigator.clipboard.writeText(url);
      toast.success('Link created and copied to clipboard');
    }
  };

  const copyLink = (token: string) => {
    const url = generateShareUrl(token);
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const activeLinks = existingLinks?.filter((l) => l.is_active) || [];

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Link2 className="h-4 w-4" />
          {size !== 'icon' && <span className="ml-1">Share</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            Create a secure, time-limited link to share this document externally.
          </DialogDescription>
        </DialogHeader>

        {activeLinks.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Links</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {activeLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Expires {format(new Date(link.expires_at), 'dd MMM')}</span>
                    {link.max_views && (
                      <>
                        <Eye className="h-3 w-3 ml-2" />
                        <span>
                          {link.view_count}/{link.max_views} views
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyLink(link.token)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deactivateLink.mutate(link.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Link Expires In</Label>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Max Views (Optional)</Label>
            <Input
              type="number"
              placeholder="Unlimited"
              value={maxViews}
              onChange={(e) => setMaxViews(e.target.value)}
              min={1}
            />
            <p className="text-xs text-muted-foreground">
              Link will expire after this many views
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateLink} disabled={createLink.isPending}>
            <Link2 className="mr-2 h-4 w-4" />
            {createLink.isPending ? 'Creating...' : 'Create & Copy Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText, Clock, AlertTriangle, Download, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/common/LoadingState';
import logoImage from '@/assets/logo.png';

interface SharedDocumentData {
  file_url: string;
  file_name: string;
  expires_at: string;
  is_expired: boolean;
  view_limit_reached: boolean;
}

export default function SharedDocument() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<SharedDocumentData | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!token) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        // Fetch share link and validate
        const { data: shareLink, error: linkError } = await supabase
          .from('document_share_links')
          .select('*, documents(*), compliance_documents(*)')
          .eq('token', token)
          .single();

        if (linkError || !shareLink) {
          setError('Share link not found or has been revoked');
          setLoading(false);
          return;
        }

        // Check if link is active
        if (!shareLink.is_active) {
          setError('This share link has been deactivated');
          setLoading(false);
          return;
        }

        // Check expiration
        if (new Date(shareLink.expires_at) < new Date()) {
          setError('This share link has expired');
          setLoading(false);
          return;
        }

        // Check view count
        if (shareLink.max_views && shareLink.view_count >= shareLink.max_views) {
          setError('This share link has reached its maximum view limit');
          setLoading(false);
          return;
        }

        // Increment view count
        await supabase
          .from('document_share_links')
          .update({
            view_count: shareLink.view_count + 1,
            last_viewed_at: new Date().toISOString(),
          })
          .eq('id', shareLink.id);

        // Get document details
        const doc = shareLink.documents || shareLink.compliance_documents;
        if (!doc) {
          setError('Document not found');
          setLoading(false);
          return;
        }

        setDocument({
          file_url: doc.file_url,
          file_name: doc.original_file_name || 'Document',
          expires_at: shareLink.expires_at,
          is_expired: false,
          view_limit_reached: false,
        });
      } catch (err) {
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState text="Loading shared document..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img src={logoImage} alt="Logo" className="h-16 w-16 mx-auto" />
            </div>
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Unable to Access Document</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              If you believe this is an error, please contact the document owner for a new share link.
            </p>
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go to Homepage
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Logo" className="h-10 w-10" />
            <span className="font-semibold text-foreground">Shared Document</span>
          </div>
          {document && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Expires {format(new Date(document.expires_at), 'dd MMM yyyy')}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {document && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {document.file_name}
              </CardTitle>
              <CardDescription>
                This document has been shared with you securely.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview area for PDFs/images */}
              {document.file_url.toLowerCase().endsWith('.pdf') ? (
                <div className="aspect-[3/4] border rounded-lg overflow-hidden">
                  <iframe
                    src={document.file_url}
                    className="w-full h-full"
                    title={document.file_name}
                  />
                </div>
              ) : document.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={document.file_url}
                    alt={document.file_name}
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <div className="text-center py-12 bg-muted/50 rounded-lg">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Preview not available for this file type</p>
                </div>
              )}

              <Button asChild className="w-full">
                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download Document
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Powered by Hydrogen Capital
        </div>
      </footer>
    </div>
  );
}

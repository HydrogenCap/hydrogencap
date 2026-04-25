import { useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Pencil,
  Check,
  X,
  TrendingUp,
  Building2,
  Shield,
  BarChart3,
  FileText,
  Loader2,
} from 'lucide-react';
import type { AIInvestorReport, ReportSection } from '@/hooks/useAIInvestorReports';
import { useUpdateAIReportSection } from '@/hooks/useAIInvestorReports';

interface ReportPreviewProps {
  report: AIInvestorReport;
}

function KPICard({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">
        {value}{suffix && <span className="text-base font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}

function SectionEditor({
  reportId,
  sectionIndex,
  section,
}: {
  reportId: string;
  sectionIndex: number;
  section: ReportSection;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(section.content);
  const updateSection = useUpdateAIReportSection();

  const handleSave = () => {
    updateSection.mutate(
      { reportId, sectionIndex, updatedSection: { content } },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleCancel = () => {
    setContent(section.content);
    setEditing(false);
  };

  const sectionIcon = () => {
    const heading = section.heading.toLowerCase();
    if (heading.includes('executive') || heading.includes('summary')) return <FileText className="h-5 w-5" />;
    if (heading.includes('portfolio')) return <Building2 className="h-5 w-5" />;
    if (heading.includes('financial') || heading.includes('performance')) return <BarChart3 className="h-5 w-5" />;
    if (heading.includes('compliance')) return <Shield className="h-5 w-5" />;
    if (heading.includes('outlook') || heading.includes('market')) return <TrendingUp className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          {sectionIcon()}
          <CardTitle className="text-lg">{section.heading}</CardTitle>
        </div>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={updateSection.isPending}
            >
              {updateSection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {section.content.split('\n').map((paragraph, i) => {
              if (!paragraph.trim()) return null;
              // Escape first, then re-introduce the only formatting we want
              // (markdown bold). This prevents HTML injection via AI-generated
              // or user-editable report content.
              const escaped = paragraph
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
              const formatted = escaped.replace(
                /\*\*(.*?)\*\*/g,
                '<strong>$1</strong>'
              );
              return (
                <p
                  key={i}
                  className="text-sm text-muted-foreground leading-relaxed mb-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatted) }}
                />
              );
            })}
          </div>
        )}

        {/* Render structured data if present */}
        {section.data && Object.keys(section.data).length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(section.data).map(([key, value]) => (
              <KPICard
                key={key}
                label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                value={String(value)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportPreview({ report }: ReportPreviewProps) {
  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="text-center space-y-2 pb-4">
        <h1 className="text-2xl font-bold text-foreground">{report.title}</h1>
        <div className="flex items-center justify-center gap-2">
          <Badge variant={report.status === 'published' ? 'default' : 'secondary'}>
            {report.status}
          </Badge>
          <Badge variant="outline">{report.report_type}</Badge>
          <span className="text-sm text-muted-foreground">
            {report.period_start} to {report.period_end}
          </span>
        </div>
      </div>

      {/* Executive Summary Card */}
      {report.summary && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Sections */}
      {report.sections.map((section, index) => (
        <SectionEditor
          key={index}
          reportId={report.id}
          sectionIndex={index}
          section={section}
        />
      ))}

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        <p>Generated on {new Date(report.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}</p>
        {report.published_at && (
          <p>Published on {new Date(report.published_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}</p>
        )}
        <p className="mt-1">This report was AI-generated and may require review before distribution.</p>
      </div>
    </div>
  );
}

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TEXT, CARD } from '@/lib/design-tokens';
import { BarChart3, Clock } from 'lucide-react';
import { useAcquisitionAdvisorState } from './hooks/useAcquisitionAdvisorState';
import { AnalysisForm } from './components/AnalysisForm';
import { AnalysisResults } from './components/AnalysisResults';
import { PastAnalysisRow } from './components/PastAnalysisRow';

export default function AcquisitionAdvisor() {
  const s = useAcquisitionAdvisorState();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Page header */}
        <div>
          <h1 className={TEXT.pageTitle}>Acquisition Advisor</h1>
          <p className={`${TEXT.body} text-muted-foreground mt-1`}>
            AI-powered analysis of potential property purchases against your existing portfolio
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input form */}
          <div className="lg:col-span-1">
            <AnalysisForm
              form={s.form}
              updateForm={s.updateForm}
              onSubmit={s.handleSubmit}
              isPending={s.runAnalysis.isPending}
            />

            {/* Past analyses */}
            <Card className="mt-4">
              <CardHeader className={CARD.compact}>
                <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2`}>
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Past Analyses
                </CardTitle>
              </CardHeader>
              <CardContent className={CARD.compact}>
                {s.loadingPast ? (
                  <div className="space-y-2" aria-busy="true" aria-label="Loading past analyses">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-md border border-border p-3 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : s.pastAnalyses && s.pastAnalyses.length > 0 ? (
                  <div className="space-y-2">
                    {s.pastAnalyses.map((a) => (
                      <PastAnalysisRow
                        key={a.id}
                        analysis={a}
                        onSelect={() => s.setSelectedAnalysis(a)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className={`${TEXT.label} text-center py-6`}>
                    No analyses yet. Submit a property above to get started.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results panel */}
          <div className="lg:col-span-2">
            {s.runAnalysis.isPending ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className={TEXT.sectionHeading}>Analysing acquisition...</p>
                  <p className={`${TEXT.label} mt-2`}>
                    Comparing against your portfolio, calculating metrics, and assessing risks
                  </p>
                </CardContent>
              </Card>
            ) : s.selectedAnalysis ? (
              <AnalysisResults analysis={s.selectedAnalysis} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className={TEXT.sectionHeading}>No analysis selected</p>
                  <p className={`${TEXT.label} mt-2 max-w-md`}>
                    Enter property details on the left and click "Analyse" to get AI-powered
                    acquisition recommendations based on your portfolio.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import { FileSignature } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { DocumentGenerator } from '@/components/templates/DocumentGenerator';
import { useDocumentTemplatesState } from './hooks/useDocumentTemplatesState';
import { TemplateBrowser } from './components/TemplateBrowser';
import { ContextSelection } from './components/ContextSelection';
import { TemplateFieldsForm } from './components/TemplateFieldsForm';
import { RecentDocumentsCard } from './components/RecentDocumentsCard';
import { GeneratedDocumentsList } from './components/GeneratedDocumentsList';
import { TemplateEditorTab } from './components/TemplateEditorTab';
import { VersionHistoryTab } from './components/VersionHistoryTab';

export default function DocumentTemplates() {
  const s = useDocumentTemplatesState();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <FileSignature className="h-6 w-6" /> Document Templates
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Generate pre-filled property documents from your data
                  </p>
                </div>
              </div>
            </div>

            <Tabs value={s.topTab} onValueChange={s.setTopTab}>
              <TabsList>
                <TabsTrigger value="wizard">Quick Generate</TabsTrigger>
                <TabsTrigger value="editor">Template Editor</TabsTrigger>
                <TabsTrigger value="generate">Document Generator</TabsTrigger>
                <TabsTrigger value="generated">Generated Documents</TabsTrigger>
                <TabsTrigger value="versions">Version History</TabsTrigger>
              </TabsList>

              <TabsContent value="wizard">
                <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                  <div>
                    {s.step === 'browse' && <TemplateBrowser onSelect={s.handleSelectTemplate} />}
                    {s.step === 'select_context' && (
                      <ContextSelection
                        selectedTemplate={s.selectedTemplate}
                        properties={s.properties}
                        selectedPropertyId={s.selectedPropertyId}
                        setSelectedPropertyId={s.setSelectedPropertyId}
                        selectedTenancyId={s.selectedTenancyId}
                        setSelectedTenancyId={s.setSelectedTenancyId}
                        activeTenancies={s.activeTenancies}
                        onBack={() => s.setStep('browse')}
                        onNext={s.handleContextNext}
                      />
                    )}
                    {s.step === 'template_fields' && (
                      <TemplateFieldsForm
                        selectedTemplate={s.selectedTemplate}
                        selectedTemplateId={s.selectedTemplateId}
                        templateFields={s.templateFields}
                        updateField={s.updateField}
                        complianceChecks={s.complianceChecks}
                        rooms={s.rooms}
                        onBack={() => s.setStep('select_context')}
                        onGenerate={s.handleGenerate}
                      />
                    )}
                  </div>
                  <div className="space-y-4">
                    <RecentDocumentsCard recentDocs={s.recentDocs} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="editor">
                <TemplateEditorTab
                  editorTemplateId={s.editorTemplateId}
                  setEditorTemplateId={s.setEditorTemplateId}
                />
              </TabsContent>

              <TabsContent value="generate">
                <DocumentGenerator />
              </TabsContent>

              <TabsContent value="generated">
                <GeneratedDocumentsList
                  generatedDocsV2={s.generatedDocsV2}
                  updateDocStatus={s.updateDocStatus}
                />
              </TabsContent>

              <TabsContent value="versions">
                <VersionHistoryTab
                  versionTemplateId={s.versionTemplateId}
                  setVersionTemplateId={s.setVersionTemplateId}
                />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

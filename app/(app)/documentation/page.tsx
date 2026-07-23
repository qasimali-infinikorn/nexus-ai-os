import DocumentationStudio from "@/components/documentation-studio";
import { PageHeader } from "@/components/app-shell/page-header";
import { FeaturePanelHost } from "@/components/app-shell/feature-panel-host";

export default function DocumentationPage() {
  return (
    <>
      <PageHeader
        title="Documentation"
        description="Generate READMEs, ADRs, API docs, runbooks, and onboarding guides with the Doc Architect agent."
      />

      <FeaturePanelHost Panel={DocumentationStudio} />
    </>
  );
}

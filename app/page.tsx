import { SourcesPanel } from "@/components/layout/SourcesPanel";
import { QuotesPanel } from "@/components/layout/QuotesPanel";
import { ViewerPanel } from "@/components/layout/ViewerPanel";

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <div className="h-full grid grid-cols-1 lg:grid-cols-[20%_40%_1fr]">
        <SourcesPanel />
        <QuotesPanel />
        <ViewerPanel />
      </div>
    </main>
  );
}
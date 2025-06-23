"use client";

import { SourcesPanel } from "@/components/layout/SourcesPanel";
import { QuotesPanel } from "@/components/layout/QuotesPanel";
import { ViewerPanel } from "@/components/layout/ViewerPanel";
import { SyncIndicator } from "@/components/SyncIndicator";
import { useSync } from "@/hooks/useSync";

export default function Home() {
  useSync(); // Initialize synchronization

  return (
    <main className="h-screen w-screen overflow-hidden relative">
      <div className="h-full grid grid-cols-1 lg:grid-cols-[20%_40%_1fr]">
        <div className="h-full overflow-hidden">
          <SourcesPanel />
        </div>
        <div className="h-full overflow-hidden">
          <QuotesPanel />
        </div>
        <div className="h-full overflow-hidden">
          <ViewerPanel />
        </div>
      </div>
      
      {/* Sync indicator in top-right corner */}
      <SyncIndicator />
    </main>
  );
}
import { useState } from "react";
import { useGetProjectInsights, getGetProjectInsightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Lightbulb, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

interface ProjectInsightsProps {
  projectId: number;
}

export function ProjectInsights({ projectId }: ProjectInsightsProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetProjectInsights(projectId, {
    query: { queryKey: getGetProjectInsightsQueryKey(projectId) },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: getGetProjectInsightsQueryKey(projectId) });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded" />
        <Skeleton className="h-32 rounded" />
        <Skeleton className="h-24 rounded" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI-Generated Insights</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={refresh}
          data-testid="button-refresh-insights"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Overview</h4>
        <p className="text-sm text-foreground leading-relaxed" data-testid="text-insights-summary">{data.summary}</p>
      </div>

      {/* Key Decisions */}
      {data.keyDecisions && data.keyDecisions.length > 0 && (
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-1.5 mb-3">
            <Lightbulb className="w-3.5 h-3.5 text-violet-400" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Key Decisions</h4>
          </div>
          <ul className="space-y-2">
            {data.keyDecisions.map((d, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground" data-testid={`text-decision-${i}`}>
                <span className="text-violet-400 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items */}
      {data.actionItems && data.actionItems.length > 0 && (
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Action Items</h4>
          </div>
          <ul className="space-y-2">
            {data.actionItems.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground" data-testid={`text-action-${i}`}>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {data.risks && data.risks.length > 0 && (
        <div className="border border-amber-500/20 rounded-lg p-4 bg-amber-500/5">
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Risks & Blockers</h4>
          </div>
          <ul className="space-y-2">
            {data.risks.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground" data-testid={`text-risk-${i}`}>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

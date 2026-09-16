import { useState } from "react";
import { useSummarizeMemory, useDeleteMemory, useExtractTasksFromMemory, getListMemoriesQueryKey, getListTasksQueryKey, getGetProjectStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MemoryTypeBadge } from "@/components/memory-type-badge";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles, ListChecks, ChevronDown, ChevronUp, ExternalLink, Tag } from "lucide-react";
import type { Memory } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface MemoryCardProps {
  memory: Memory;
  projectId: number;
}

export function MemoryCard({ memory, projectId }: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const summarize = useSummarizeMemory();
  const deleteMemory = useDeleteMemory();
  const extractTasks = useExtractTasksFromMemory();

  function handleSummarize() {
    summarize.mutate(
      { projectId, memoryId: memory.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey(projectId) });
          toast({ title: "Summary generated" });
        },
        onError: () => toast({ title: "Failed to summarize", variant: "destructive" }),
      }
    );
  }

  function handleExtractTasks() {
    extractTasks.mutate(
      { projectId, data: { memoryId: memory.id } },
      {
        onSuccess: (tasks) => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectStatsQueryKey(projectId) });
          toast({ title: `${tasks.length} task${tasks.length !== 1 ? "s" : ""} extracted` });
        },
        onError: () => toast({ title: "Failed to extract tasks", variant: "destructive" }),
      }
    );
  }

  function handleDelete() {
    deleteMemory.mutate(
      { projectId, memoryId: memory.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectStatsQueryKey(projectId) });
          toast({ title: "Memory deleted" });
        },
        onError: () => toast({ title: "Failed to delete memory", variant: "destructive" }),
      }
    );
  }

  const isLong = memory.content.length > 280;

  return (
    <div
      className="group border border-border rounded-lg bg-card hover:border-border/80 transition-colors"
      data-testid={`card-memory-${memory.id}`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-3">
          <MemoryTypeBadge type={memory.type} />
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleSummarize}
              disabled={summarize.isPending}
              data-testid={`button-summarize-${memory.id}`}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {summarize.isPending ? "..." : "Summarize"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleExtractTasks}
              disabled={extractTasks.isPending}
              data-testid={`button-extract-tasks-${memory.id}`}
            >
              <ListChecks className="w-3 h-3 mr-1" />
              {extractTasks.isPending ? "..." : "Tasks"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteMemory.isPending}
              data-testid={`button-delete-memory-${memory.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* AI Summary (if present) */}
        {memory.summary && (
          <div className="mb-3 p-2.5 rounded bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-1 mb-1">
              <Sparkles className="w-2.5 h-2.5 text-primary" />
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">AI Summary</span>
            </div>
            <p className="text-xs text-foreground leading-relaxed">{memory.summary}</p>
          </div>
        )}

        {/* Content */}
        <div className="relative">
          <p
            className={cn(
              "text-sm text-foreground leading-relaxed whitespace-pre-wrap",
              !expanded && isLong && "line-clamp-4"
            )}
            data-testid={`text-memory-content-${memory.id}`}
          >
            {memory.content}
          </p>
          {isLong && (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-expand-${memory.id}`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
          <span className="text-[11px] text-muted-foreground font-mono">
            {new Date(memory.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          {memory.source && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[160px]">
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              {memory.source}
            </span>
          )}
          {memory.tags && memory.tags.length > 0 && (
            <div className="ml-auto flex items-center gap-1 flex-wrap">
              {memory.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0 rounded border border-border text-muted-foreground bg-muted font-mono">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

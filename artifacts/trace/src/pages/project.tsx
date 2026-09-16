import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetProject, useListMemories, getListMemoriesQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { MemoryCard } from "@/components/memory-card";
import { TaskList } from "@/components/task-list";
import { AiQa } from "@/components/ai-qa";
import { ProjectInsights } from "@/components/project-insights";
import { MemorySearch } from "@/components/memory-search";
import { AddMemorySheet } from "@/components/add-memory-sheet";
import { ProjectStats } from "@/components/project-stats";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain,
  CheckSquare,
  Lightbulb,
  MessageSquare,
  Search,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "memories", label: "Memories", icon: Brain },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "ask", label: "Ask AI", icon: MessageSquare },
  { id: "insights", label: "Insights", icon: Lightbulb },
  { id: "search", label: "Search", icon: Search },
] as const;

type Tab = (typeof TABS)[number]["id"];

const MEMORY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "discussion", label: "Discussions" },
  { value: "decision", label: "Decisions" },
  { value: "task", label: "Tasks" },
  { value: "link", label: "Links" },
  { value: "note", label: "Notes" },
];

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id!, 10);
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<Tab>("memories");
  const [typeFilter, setTypeFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const memoryParams = typeFilter !== "all" ? { type: typeFilter as "discussion" | "decision" | "task" | "link" | "note" | "screenshot" } : undefined;
  const { data: memories, isLoading: memoriesLoading } = useListMemories(projectId, memoryParams, {
    query: {
      queryKey: getListMemoriesQueryKey(projectId, memoryParams),
    },
  });

  if (projectLoading) {
    return (
      <Layout showBack>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout showBack>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Project not found.</p>
          <Button size="sm" className="mt-4" onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      showBack
      title={project.name}
      actions={
        activeTab === "memories" && (
          <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-memory">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Memory
          </Button>
        )
      }
    >
      <div className="space-y-5">
        {/* Project header */}
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{project.name}</h1>
            {project.teamName && (
              <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">{project.teamName}</span>
            )}
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>

        {/* Stats */}
        <ProjectStats projectId={projectId} />

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-0 -mb-px">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
                data-testid={`tab-${id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "memories" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40 h-7 text-xs" data-testid="select-type-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMORY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {memories && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {memories.length} {memories.length === 1 ? "memory" : "memories"}
                  </span>
                )}
              </div>

              {memoriesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
                </div>
              ) : memories && memories.length > 0 ? (
                <div className="space-y-3">
                  {memories.map((memory) => (
                    <MemoryCard key={memory.id} memory={memory} projectId={projectId} />
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-lg py-16 text-center">
                  <Brain className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground mb-1">No memories yet</p>
                  <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                    Start capturing discussions, decisions, links, and notes from your team.
                  </p>
                  <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-first-memory">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Memory
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "tasks" && <TaskList projectId={projectId} />}
          {activeTab === "ask" && <AiQa projectId={projectId} />}
          {activeTab === "insights" && <ProjectInsights projectId={projectId} />}
          {activeTab === "search" && <MemorySearch projectId={projectId} />}
        </div>
      </div>

      <AddMemorySheet
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
      />
    </Layout>
  );
}

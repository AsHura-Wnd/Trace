import { useGetProjectStats } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CheckSquare, Brain, TrendingUp } from "lucide-react";

interface ProjectStatsProps {
  projectId: number;
}

export function ProjectStats({ projectId }: ProjectStatsProps) {
  const { data, isLoading } = useGetProjectStats(projectId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded" />)}
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    { label: "Memories", value: data.totalMemories, icon: Brain, color: "text-primary" },
    { label: "Tasks", value: data.totalTasks, icon: CheckSquare, color: "text-violet-400" },
    { label: "Open Tasks", value: data.openTasks, icon: TrendingUp, color: "text-amber-400" },
    { label: "Completed", value: data.completedTasks, icon: TrendingUp, color: "text-green-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="border border-border rounded-lg p-3 bg-card" data-testid={`stat-${label.toLowerCase().replace(" ", "-")}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className={`w-3.5 h-3.5 ${color}`} />
            <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
          </div>
          <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

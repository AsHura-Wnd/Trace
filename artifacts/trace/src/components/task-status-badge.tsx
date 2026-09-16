import { cn } from "@/lib/utils";
import { Circle, Clock, CheckCircle2 } from "lucide-react";

const STATUS_CONFIG = {
  open: { icon: Circle, label: "Open", color: "text-muted-foreground" },
  in_progress: { icon: Clock, label: "In Progress", color: "text-amber-400" },
  done: { icon: CheckCircle2, label: "Done", color: "text-green-400" },
} as const;

type TaskStatus = keyof typeof STATUS_CONFIG;

interface TaskStatusBadgeProps {
  status: string;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const config = STATUS_CONFIG[status as TaskStatus] ?? STATUS_CONFIG.open;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", config.color)}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
export type { TaskStatus };

import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckSquare, AlertCircle, Link, FileText, Image } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_CONFIG = {
  discussion: { icon: MessageSquare, label: "Discussion", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  decision: { icon: AlertCircle, label: "Decision", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  task: { icon: CheckSquare, label: "Task", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  link: { icon: Link, label: "Link", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  note: { icon: FileText, label: "Note", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  screenshot: { icon: Image, label: "Screenshot", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
} as const;

type MemoryType = keyof typeof TYPE_CONFIG;

interface MemoryTypeBadgeProps {
  type: string;
  size?: "sm" | "default";
}

export function MemoryTypeBadge({ type, size = "default" }: MemoryTypeBadgeProps) {
  const config = TYPE_CONFIG[type as MemoryType] ?? { icon: FileText, label: type, color: "bg-muted text-muted-foreground border-border" };
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 font-mono font-medium uppercase tracking-wider",
        config.color,
        size === "sm" ? "text-[9px] py-0" : "text-[10px] py-0.5"
      )}
    >
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {config.label}
    </span>
  );
}

export { TYPE_CONFIG };
export type { MemoryType };

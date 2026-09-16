import { useState } from "react";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
  getGetProjectStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, User2, Circle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@workspace/api-client-react";

interface TaskListProps {
  projectId: number;
}

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  assignee: z.string().optional(),
  status: z.enum(["open", "in_progress", "done"]).default("open"),
});
type CreateForm = z.infer<typeof createSchema>;

const FILTERS = [
  { label: "All", value: undefined },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" },
] as const;

export function TaskList({ projectId }: TaskListProps) {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filterParams = filter ? { status: filter as "open" | "in_progress" | "done" } : undefined;
  const { data: tasks, isLoading } = useListTasks(projectId, filterParams, {
    query: {
      queryKey: getListTasksQueryKey(projectId, filterParams),
    },
  });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", assignee: "", status: "open" },
  });

  function onSubmit(data: CreateForm) {
    createTask.mutate(
      { projectId, data: { title: data.title, assignee: data.assignee || undefined, status: data.status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectStatsQueryKey(projectId) });
          setAddOpen(false);
          form.reset();
          toast({ title: "Task created" });
        },
        onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
      }
    );
  }

  function handleStatusChange(task: Task, status: string) {
    updateTask.mutate(
      { projectId, taskId: task.id, data: { status: status as "open" | "in_progress" | "done" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectStatsQueryKey(projectId) });
        },
        onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
      }
    );
  }

  function handleDelete(taskId: number) {
    deleteTask.mutate(
      { projectId, taskId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectStatsQueryKey(projectId) });
          toast({ title: "Task deleted" });
        },
        onError: () => toast({ title: "Failed to delete task", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={String(f.value)}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              data-testid={`filter-tasks-${f.value ?? "all"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button size="sm" className="ml-auto h-7 text-xs" onClick={() => setAddOpen(true)} data-testid="button-add-task">
          <Plus className="w-3 h-3 mr-1" />
          Add Task
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded" />)}
        </div>
      ) : tasks && tasks.length > 0 ? (
        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="group flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
              data-testid={`row-task-${task.id}`}
            >
              <Select value={task.status} onValueChange={(v) => handleStatusChange(task, v)}>
                <SelectTrigger className="w-fit h-auto border-none bg-transparent p-0 shadow-none gap-1 focus:ring-0">
                  <TaskStatusBadge status={task.status} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open"><TaskStatusBadge status="open" /></SelectItem>
                  <SelectItem value="in_progress"><TaskStatusBadge status="in_progress" /></SelectItem>
                  <SelectItem value="done"><TaskStatusBadge status="done" /></SelectItem>
                </SelectContent>
              </Select>

              <span
                className={cn("flex-1 text-sm text-foreground truncate", task.status === "done" && "line-through text-muted-foreground")}
                data-testid={`text-task-title-${task.id}`}
              >
                {task.title}
              </span>

              {task.assignee && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <User2 className="w-3 h-3" />
                  {task.assignee}
                </span>
              )}

              <button
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                onClick={() => handleDelete(task.id)}
                data-testid={`button-delete-task-${task.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg py-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tasks yet. Add one or use "Extract Tasks" on a memory.</p>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Add Task</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Task</FormLabel>
                    <FormControl>
                      <Input placeholder="What needs to be done?" {...field} data-testid="input-task-title" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Assignee <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Name" {...field} data-testid="input-task-assignee" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={createTask.isPending} data-testid="button-submit-task">
                  {createTask.isPending ? "Adding..." : "Add Task"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

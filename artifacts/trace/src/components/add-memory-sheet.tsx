import { useCreateMemory, getListMemoriesQueryKey, getGetProjectActivityQueryKey, getGetProjectStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["discussion", "decision", "task", "link", "note", "screenshot"]),
  content: z.string().min(1, "Content is required"),
  source: z.string().optional(),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddMemorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  defaultType?: string;
}

export function AddMemorySheet({ open, onOpenChange, projectId, defaultType }: AddMemorySheetProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMemory = useCreateMemory();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: (defaultType as FormData["type"]) ?? "note",
      content: "",
      source: "",
      tags: "",
    },
  });

  function onSubmit(data: FormData) {
    const tagsArr = data.tags
      ? data.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;

    createMemory.mutate(
      {
        projectId,
        data: {
          type: data.type,
          content: data.content,
          source: data.source || undefined,
          tags: tagsArr,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectActivityQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectStatsQueryKey(projectId) });
          onOpenChange(false);
          form.reset();
          toast({ title: "Memory added" });
        },
        onError: () => toast({ title: "Failed to add memory", variant: "destructive" }),
      }
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base">Add Memory</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-memory-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="discussion">Discussion</SelectItem>
                      <SelectItem value="decision">Decision</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="screenshot">Screenshot</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste discussion text, decision rationale, notes..."
                      rows={6}
                      {...field}
                      data-testid="textarea-memory-content"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Source <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Slack #channel, Meeting notes, URL..." {...field} data-testid="input-memory-source" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Tags <span className="text-muted-foreground font-normal">(comma-separated, optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="architecture, UI, MVP" {...field} data-testid="input-memory-tags" />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={createMemory.isPending} data-testid="button-submit-memory">
                {createMemory.isPending ? "Saving..." : "Add Memory"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

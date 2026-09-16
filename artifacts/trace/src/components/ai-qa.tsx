import { useState } from "react";
import { useAskProjectQuestion } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Send, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiQaProps {
  projectId: number;
}

interface QaEntry {
  question: string;
  answer: string;
  relevantMemories: number[];
}

export function AiQa({ projectId }: AiQaProps) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QaEntry[]>([]);
  const { toast } = useToast();
  const ask = useAskProjectQuestion();

  function handleAsk() {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion("");
    ask.mutate(
      { projectId, data: { question: q } },
      {
        onSuccess: (result) => {
          setHistory((h) => [...h, { question: q, answer: result.answer, relevantMemories: result.relevantMemories ?? [] }]);
        },
        onError: () => toast({ title: "Failed to get answer", variant: "destructive" }),
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleAsk();
    }
  }

  return (
    <div className="space-y-4">
      {/* History */}
      {history.length > 0 && (
        <div className="space-y-4">
          {history.map((entry, i) => (
            <div key={i} className="space-y-2">
              <div className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-muted-foreground">Q</span>
                </div>
                <p className="text-sm font-medium text-foreground" data-testid={`text-question-${i}`}>{entry.question}</p>
              </div>
              <div className="flex gap-2.5 ml-0">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-2.5 h-2.5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap" data-testid={`text-answer-${i}`}>
                    {entry.answer}
                  </p>
                  {entry.relevantMemories.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-[10px] text-muted-foreground">Referenced memories:</span>
                      {entry.relevantMemories.map((id) => (
                        <span key={id} className="text-[10px] px-1.5 py-0 rounded border border-border text-muted-foreground font-mono">
                          #{id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {ask.isPending && (
        <div className="flex gap-2.5">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Brain className="w-2.5 h-2.5 text-primary animate-pulse" />
          </div>
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {history.length === 0 && !ask.isPending && (
        <div className="border border-dashed border-border rounded-lg py-12 text-center">
          <Brain className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium mb-1">Ask anything about this project</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Ask about decisions, who owns what, technical choices, or anything captured in your project memory.
          </p>
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. What was decided about the tech stack? Who owns the CI setup?"
          rows={3}
          className="pr-16 resize-none"
          data-testid="textarea-question"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            <kbd className="font-mono">⌘↵</kbd>
          </span>
          <Button
            size="sm"
            onClick={handleAsk}
            disabled={ask.isPending || !question.trim()}
            className="h-7 px-2"
            data-testid="button-ask"
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

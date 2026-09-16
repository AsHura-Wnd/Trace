import { useState } from "react";
import { useSearchProjectMemories } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MemoryTypeBadge } from "@/components/memory-type-badge";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

interface MemorySearchProps {
  projectId: number;
}

export function MemorySearch({ projectId }: MemorySearchProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useSearchProjectMemories(projectId, { q: debouncedQuery }, {
    query: {
      enabled: debouncedQuery.length >= 2,
      queryKey: ["search", projectId, debouncedQuery],
    },
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memories by keyword, tag, or content..."
          className="pl-9 pr-8"
          data-testid="input-search"
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setQuery("")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {debouncedQuery.length >= 2 && (
        <div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded" />)}
            </div>
          ) : data && data.length > 0 ? (
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {data.map((memory) => (
                <div key={memory.id} className="p-3 bg-card hover:bg-muted/30 transition-colors" data-testid={`result-memory-${memory.id}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <MemoryTypeBadge type={memory.type} size="sm" />
                    <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                      {new Date(memory.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">{memory.content}</p>
                  {memory.tags && memory.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {memory.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 rounded border border-border text-muted-foreground bg-muted font-mono">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-results">
              No memories match "{debouncedQuery}"
            </p>
          )}
        </div>
      )}

      {debouncedQuery.length < 2 && (
        <p className="text-xs text-muted-foreground text-center py-8">
          Type at least 2 characters to search across all project memories.
        </p>
      )}
    </div>
  );
}

import { Link, useLocation } from "wouter";
import { Brain, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
  title?: string;
  actions?: React.ReactNode;
}

export function Layout({ children, showBack, backTo = "/", backLabel = "Dashboard", title, actions }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-sidebar sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">Trace</span>
          </Link>

          {showBack && (
            <>
              <span className="text-border text-xs">/</span>
              <Link
                href={backTo}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-back"
              >
                <ChevronLeft className="w-3 h-3" />
                {backLabel}
              </Link>
            </>
          )}

          {title && (
            <>
              <span className="text-border text-xs">/</span>
              <span className="text-sm font-medium text-foreground truncate">{title}</span>
            </>
          )}

          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}

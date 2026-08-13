import * as React from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex flex-col gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 px-6 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="h-4" />

        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-2">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={crumb.label} className="flex items-center gap-2">
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground transition-colors font-medium"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={`font-medium ${isLast ? "text-foreground" : ""}`}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
                </div>
              );
            })}
          </nav>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-plus-jakarta)]">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

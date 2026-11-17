import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { WorkspacePreview } from "./workspace-preview";

export function HomePreview() {
  return (
    <section aria-labelledby="workspace-preview-title" className="grid gap-5 border-t border-border pt-7 md:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className="text-[length:var(--text-2xl)] leading-[1.2] font-medium tracking-[-0.025em] text-foreground"
          id="workspace-preview-title"
        >
          工作台示例
        </h2>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] pr-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-foreground"
          href="/orchestratelq"
        >
          打开系统工作台 <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </div>
      <WorkspacePreview />
    </section>
  );
}

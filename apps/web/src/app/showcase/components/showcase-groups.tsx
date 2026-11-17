"use client";

import { Button } from "@/shared/arc/button/button";
import { EmptyState } from "@/shared/arc/empty-state/empty-state";
import { Search } from "lucide-react";
import { ComponentPreview } from "./component-preview";
import { useShowcase } from "./showcase-context";

export function ShowcaseGroups() {
  const { visible, groups, reset } = useShowcase();
  return (
    <div className="@container grid min-w-0 gap-12 md:gap-16">
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="grid min-w-0 gap-4 md:gap-5"
        >
          <header className="flex items-baseline justify-between gap-4">
            <h2
              className="text-xl leading-snug font-semibold tracking-tight"
              id={`${group.id}-heading`}
              tabIndex={-1}
            >
              {group.name}
            </h2>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{group.examples.length} 项</span>
          </header>
          <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-6 @min-[39rem]:grid-cols-2 @min-[39rem]:gap-y-7 @min-[64rem]:grid-cols-6">
            {group.examples.map((example) => (
              <ComponentPreview key={example.id} example={example} />
            ))}
          </div>
        </section>
      ))}
      {!visible.length && (
        <EmptyState
          title="没有找到匹配的组件"
          description="试试「按钮」或组件的英文名称。"
          icon={<Search aria-hidden="true" />}
          action={<Button variant="secondary" onClick={reset}>清除筛选</Button>}
        />
      )}
    </div>
  );
}

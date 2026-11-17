"use client";

import { Avatar } from "@/shared/arc/avatar/avatar";
import { Button } from "@/shared/arc/button/button";
import { EmptyState } from "@/shared/arc/empty-state/empty-state";
import { Progress } from "@/shared/arc/progress/progress";
import { SearchField } from "@/shared/arc/search-field/search-field";
import { SearchX } from "lucide-react";
import { useRef, useState } from "react";
import { ProjectList, sampleProjects } from "./project-list";

export function WorkspacePreview() {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const keyword = query.trim().toLocaleLowerCase();
  const projects = sampleProjects.filter((project) => `${project.name} ${project.category}`.toLocaleLowerCase().includes(keyword));

  function resetSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  return (
    <div className="overflow-hidden rounded-[var(--ds-radius-xl)] border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-6">
        <Avatar name="栖云工作室" size="sm" />
        <span className="text-sm font-medium text-foreground">栖云工作室</span>
        <span className="ml-auto shrink-0 text-xs text-[var(--text-secondary)]">示例数据</span>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,28%)]">
        <div className="grid min-w-0 content-start gap-4 p-4 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-[length:var(--text-lg)] font-medium text-foreground">正在推进</h3>
              <p aria-live="polite" className="mt-1 text-xs text-[var(--text-secondary)]">
                {keyword ? `找到 ${projects.length} 个项目` : `共 ${sampleProjects.length} 个项目`}
              </p>
            </div>
            <div className="w-full min-w-0 sm:w-52">
              <SearchField
                label="搜索项目"
                onValueChange={setQuery}
                placeholder="项目名称或分类"
                ref={searchRef}
                value={query}
              />
            </div>
          </div>
          {projects.length ? (
            <ProjectList projects={projects} />
          ) : (
            <EmptyState
              action={<Button onClick={resetSearch} size="sm" type="button" variant="secondary">清除搜索</Button>}
              description="试试按项目名称或分类搜索。"
              icon={<SearchX size={20} />}
              title="没有找到项目"
            />
          )}
        </div>

        <aside aria-labelledby="weekly-target-title" className="grid content-start gap-4 border-t border-border bg-[var(--surface-muted)] p-4 md:p-6 lg:border-t-0 lg:border-l">
          <h3 className="text-sm font-medium text-foreground" id="weekly-target-title">本周任务</h3>
          <div className="flex items-baseline gap-2 tabular-nums">
            <strong className="text-[length:var(--text-3xl)] leading-none font-medium text-foreground">12</strong>
            <span className="text-xs text-[var(--text-secondary)]">/ 15 项已完成</span>
          </div>
          <Progress aria-labelledby="weekly-target-title" max={15} value={12} />
          <p className="text-xs text-[var(--text-secondary)]">还有 3 项待完成</p>
        </aside>
      </div>
    </div>
  );
}

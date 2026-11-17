"use client";

import { allTokens } from "@template/design-tokens/themes";
import SegmentedControl from "@/shared/arc/segmented-control/segmented-control";
import { ColorConcepts } from "./color-concepts";
import { ColorFilters } from "./color-filters";
import { ColorTable } from "./color-table";
import { useColorWorkbench } from "./color-workbench-context";

export function ColorMatrix() {
  const { conceptView, setConceptView, dark, activeTheme, foundCount } =
    useColorWorkbench();
  return (
    <>
      <div className="flex justify-between items-end mb-5 gap-4 max-[1100px]:items-start max-[767px]:flex-col max-[767px]:gap-3.5">
        <div>
          <h2 className="text-[length:1.125rem] font-semibold mt-0 mb-1 tracking-[-.025em] mx-0">
            功能颜色矩阵
          </h2>
          <p className="text-[var(--muted-foreground)] text-[length:.75rem] m-0">
            {conceptView
              ? "每套主题的独立基础色，合并相同颜色与用途，快速了解配色。"
              : "同一功能，跨主题对照。色块均可点击编辑。"}
          </p>
        </div>
        <div className="flex items-center justify-end flex-wrap gap-3.5 max-[1100px]:gap-2 max-[767px]:w-full max-[767px]:justify-between">
          {!conceptView && (
            <span className="text-[var(--muted-foreground)] text-[length:.6875rem] whitespace-nowrap">
              {foundCount} / {allTokens.length} 个角色
            </span>
          )}
          <SegmentedControl
            label="矩阵视图"
            options={[
              { value: "roles", label: "功能角色" },
              { value: "concepts", label: "颜色概念" },
            ]}
            value={conceptView ? "concepts" : "roles"}
            onValueChange={(value) => setConceptView(value === "concepts")}
          />
        </div>
      </div>
      {conceptView ? (
        <ColorConcepts />
      ) : (
        <>
          <ColorFilters />
          <ColorTable />
        </>
      )}
      <div className="flex items-start justify-between text-[var(--muted-foreground)] text-[length:.625rem] mt-3 gap-4 max-[767px]:flex-col max-[767px]:gap-1.5">
        <span className="last:whitespace-nowrap">
          {conceptView
            ? "各主题独立去重，仅展示有实际用途的独立色值；派生色、关联色和完全透明色不重复列出。"
            : "自动派生的颜色跟随上游角色变化；单独修改后，可在编辑面板恢复关联。"}
        </span>
        <span className="last:whitespace-nowrap">
          {activeTheme.name} · {dark ? "深色" : "浅色"}
        </span>
      </div>
    </>
  );
}

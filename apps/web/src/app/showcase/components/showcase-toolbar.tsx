"use client";

import { SearchField } from "@/shared/arc/search-field/search-field";
import { Select } from "@/shared/arc/select/select";
import { componentGroups } from "./component-registry";
import { useShowcase } from "./showcase-context";

const categories = [
  { value: "all", label: "全部分类" },
  ...componentGroups.map(({ id, name }) => ({ value: id, label: name })),
];
const previewOptions = [
  { value: "all", label: "全部预览类型" },
  { value: "interactive", label: "交互示例" },
  { value: "reference", label: "仅组件信息" },
];

export function ShowcaseToolbar() {
  const { query, setQuery, category, setCategory, preview, setPreview, visible } = useShowcase();
  const filtering = query.trim() !== "" || category !== "all" || preview !== "all";

  return (
    <div role="search" aria-label="搜索与筛选组件" className="grid min-w-0 max-w-2xl grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <SearchField label="搜索组件" placeholder="搜索组件…" value={query} onValueChange={setQuery} />
      </div>
      <Select label="按分类筛选" options={categories} value={category} onValueChange={setCategory} />
      <Select label="按预览类型筛选" options={previewOptions} value={preview} onValueChange={setPreview} />
      <span className={filtering ? "col-span-full text-xs text-[var(--text-secondary)] tabular-nums" : "sr-only"} role="status">
        {filtering ? `${visible.length} 项匹配结果` : ""}
      </span>
    </div>
  );
}

"use client";

import { ChipGroup } from "@/shared/arc/chip-group/chip-group";
import { SearchField } from "@/shared/arc/search-field/search-field";
import { tokenGroups } from "@template/design-tokens/themes";
import { useColorWorkbench } from "./color-workbench-context";

const groups = [
  { value: "all", label: "全部" },
  ...tokenGroups.map(({ id, name }) => ({ value: id, label: name })),
];

export function ColorFilters() {
  const { group, setGroup, query, setQuery } = useColorWorkbench();

  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <ChipGroup
        label="颜色功能分类"
        multiple={false}
        options={groups}
        value={[group]}
        onValueChange={([value]) => setGroup(value ?? "all")}
      />
      <div className="w-full max-w-64">
        <SearchField label="搜索颜色功能" placeholder="搜索功能或 token…" value={query} onValueChange={setQuery} />
      </div>
    </div>
  );
}

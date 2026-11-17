"use client";

import { ChipGroup } from "@/shared/arc/chip-group/chip-group";
import { motionCategories, motionCatalog, type MotionCategory } from "./motion-catalog";
import { MotionPreviewCard } from "./motion-preview-card";
import { useMemo, useState } from "react";

export function MotionGallery() {
  const [category, setCategory] = useState<MotionCategory>("all");
  const visible = useMemo(
    () => (category === "all" ? motionCatalog : motionCatalog.filter((item) => item.category === category)),
    [category],
  );

  return (
    <section aria-labelledby="motion-title" className="grid gap-8 pb-20">
      <header className="grid gap-5 pt-3">
        <div className="max-w-180">
          <h1 className="m-0 text-[length:clamp(2rem,4vw,3.5rem)] font-[number:var(--type-weight-semibold)] leading-[1.1] tracking-[var(--type-tracking-tight)]" id="motion-title">
            让每一种动效，<span className="text-[var(--ds-color-muted)]">都有名字。</span>
          </h1>
          <p className="mt-4 mb-0 max-w-160 text-[length:var(--type-size-md)] leading-[var(--type-line-body)] text-[var(--ds-color-muted)]">
            这里把 Motion 的常用能力拆成可复用的视觉样本。先看动效名称和参数，再播放预览，最后复制能直接交给 vibe coding 的 Motion 代码。
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <ChipGroup
            label="动效分类"
            multiple={false}
            options={motionCategories.map((item) => ({
              value: item.id,
              label: `${item.label} ${item.id === "all" ? motionCatalog.length : motionCatalog.filter((motion) => motion.category === item.id).length}`,
            }))}
            value={[category]}
            onValueChange={([next]) => setCategory(motionCategories.find((item) => item.id === next)?.id ?? "all")}
          />
          <span className="text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)]" role="status">
            {visible.length} 个动效样本 · 默认静止
          </span>
        </div>
      </header>

      <div className="grid gap-5">
        {visible.map((item) => (
          <MotionPreviewCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}

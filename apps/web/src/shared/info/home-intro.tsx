import { ArrowRight } from "lucide-react";
import Link from "next/link";

const palette = [
  { label: "背景", color: "var(--background)" },
  { label: "表面", color: "var(--surface)" },
  { label: "正文", color: "var(--foreground)" },
  { label: "强调", color: "var(--accent)" },
];

export function HomeIntro() {
  return (
    <div className="grid items-end gap-8 pt-1 pb-8 md:pt-6 md:pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,32%)] lg:gap-10">
      <div className="min-w-0">
        <h1
          className="font-heading text-[clamp(var(--text-3xl),5.2vw,var(--text-5xl))] leading-[1.12] font-medium tracking-[-0.045em] text-foreground"
          id="overview-title"
        >
          澄序设计系统
        </h1>
        <p className="mt-5 max-w-[28rem] text-[length:var(--text-base)] leading-relaxed text-[var(--text-secondary)]">
          浏览颜色、字体、组件和页面示例。切换主题时，可以看到同一套设计规范如何应用到界面。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-strong)]"
            href="/showcase"
          >
            浏览组件 <ArrowRight aria-hidden="true" size={15} />
          </Link>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground"
            href="/colors"
          >
            查看颜色系统
          </Link>
        </div>
      </div>
      <figure className="grid gap-3 border-t border-border pt-4">
        <figcaption className="text-sm font-medium text-foreground">当前主题配色</figcaption>
        <ul className="grid grid-cols-4 gap-2">
          {palette.map((swatch) => (
            <li className="grid min-w-0 gap-2 text-xs text-[var(--text-secondary)]" key={swatch.label}>
              <span
                aria-hidden="true"
                className="h-10 rounded-[var(--radius-control)] border border-border lg:h-13"
                style={{ backgroundColor: swatch.color }}
              />
              {swatch.label}
            </li>
          ))}
        </ul>
      </figure>
    </div>
  );
}

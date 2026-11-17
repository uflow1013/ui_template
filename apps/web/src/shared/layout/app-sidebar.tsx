"use client";

import { Tooltip } from "@/shared/arc/tooltip/tooltip";
import {
  Component,
  LayoutDashboard,
  LayoutGrid,
  MessageSquareText,
  Palette,
  PanelsTopLeft,
  Rows3,
  Ruler,
  Sparkles,
  Type,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { version } from "../../../package.json";

export const navigationGroups = [
  {
    title: "设计规范",
    items: [
      { title: "主题概览", url: "/", icon: LayoutGrid },
      { title: "颜色系统", url: "/colors", icon: Palette },
      { title: "字体层级", url: "/typography", icon: Type },
      { title: "间距与形状", url: "/spacing", icon: Ruler },
    ],
  },
  {
    title: "设计示例",
    items: [
      { title: "组件预览", url: "/showcase", icon: Component },
      { title: "AI 展示台", url: "/ai-studio", icon: MessageSquareText },
      { title: "动效预览", url: "/motion", icon: Sparkles },
      { title: "风格预览", url: "/styles", icon: PanelsTopLeft },
      { title: "UI 模式", url: "/patterns", icon: Rows3 },
      { title: "工作台示例", url: "/orchestratelq", icon: LayoutDashboard },
    ],
  },
];

export function AppSidebar({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";

  return (
    <div className={`flex min-h-full min-w-0 flex-1 flex-col gap-6 py-5 ${collapsed ? "items-center" : "px-4"}`}>
      <Link
        aria-label="澄序设计主题首页"
        className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] ${collapsed ? "w-10 justify-center" : "px-2"}`}
        href="/"
        onNavigate={onNavigate}
      >
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] bg-foreground text-sm font-medium text-background">澄</span>
        {!collapsed && (
          <span className="grid min-w-0 gap-0.5">
            <span className="font-medium leading-tight">澄序</span>
            <span className="text-xs text-[var(--text-secondary)]">设计语言</span>
          </span>
        )}
      </Link>
      <nav aria-label="设计语言" className="grid w-full gap-6">
        {navigationGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && <p className="mb-2 px-2 text-xs text-[var(--text-secondary)]">{group.title}</p>}
            <ul aria-label={group.title} className="grid list-none gap-1">
              {group.items.map((item) => {
                const active = pathname === item.url;
                const link = (
                  <Link
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.title : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground aria-[current=page]:bg-[var(--accent-subtle)] aria-[current=page]:font-medium aria-[current=page]:text-[var(--ds-color-accent-ink)] ${collapsed ? "mx-auto w-10 justify-center" : "px-2"}`}
                    href={item.url}
                    onNavigate={onNavigate}
                  >
                    <item.icon aria-hidden="true" className="size-4 shrink-0" />
                    {!collapsed && item.title}
                  </Link>
                );
                return <li key={item.url}>{collapsed ? <Tooltip content={item.title} side="right">{link}</Tooltip> : link}</li>;
              })}
            </ul>
          </div>
        ))}
      </nav>
      {!collapsed && (
        <footer aria-label={`版本 ${version}`} className="mt-auto border-t border-border px-2 pt-4 text-xs tabular-nums text-[var(--text-secondary)]">
          v{version}
        </footer>
      )}
    </div>
  );
}

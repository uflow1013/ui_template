"use client";

import { Breadcrumb } from "@/shared/arc/breadcrumb/breadcrumb";
import { Button } from "@/shared/arc/button/button";
import { DropdownMenu } from "@/shared/arc/dropdown-menu/dropdown-menu";
import { ArcProvider } from "@/shared/arc/lib/arc-provider";
import { LOGOUT_PATH } from "@/shared/auth/paths";
import { clearStaticAccess, staticLoginHref } from "@/shared/auth/static-access";
import { useThemeEditor } from "@/shared/providers/theme-provider";
import { themes } from "@template/design-tokens/themes";
import { Check, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { navigationGroups } from "./app-sidebar";

const pages = navigationGroups.flatMap((group) => group.items);
const logoutPath = `${process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? ""}${LOGOUT_PATH}`;

export function SiteHeader({ navigationTrigger }: { navigationTrigger: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const title = pages.find((page) => page.url === pathname)?.title ?? "设计主题";

  return (
    <header className="z-20 flex h-15 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:gap-4 md:px-6">
      <div className="shrink-0">{navigationTrigger}</div>
      <div className="min-w-0">
        <span aria-current="page" className="block truncate text-sm font-medium min-[30rem]:hidden">{title}</span>
        <div className="hidden min-[30rem]:block">
          <ArcProvider link={Link}>
            <Breadcrumb ariaLabel="当前位置" items={pathname === "/" ? [{ label: title }] : [{ label: "澄序", href: "/" }, { label: title }]} />
          </ArcProvider>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThemeMenu showPreviewStatus />
        <LogoutButton />
      </div>
    </header>
  );
}

export function ThemeMenu({ showPreviewStatus = false }: { showPreviewStatus?: boolean }) {
  const { activeId, dirty, selectTheme } = useThemeEditor();
  const theme = themes.find((entry) => entry.id === activeId)!;
  const ThemeIcon = theme.id === "night" ? Moon : Sun;
  return <>
    {showPreviewStatus && <span aria-live="polite" className="sr-only min-[30rem]:not-sr-only min-[30rem]:text-xs min-[30rem]:text-[var(--text-secondary)]">
      {dirty ? "预览中" : ""}
    </span>}
    <DropdownMenu
      icon={<ThemeIcon size={15} />}
      items={themes.map((entry) => ({
        label: entry.id === activeId ? `${entry.name}（当前）` : entry.name,
        icon: entry.id === activeId ? <Check size={15} /> : undefined,
        onSelect: () => selectTheme(entry.id),
      }))}
      label={theme.name}
    />
  </>;
}

export function LogoutButton() {
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === "true") {
    return <Button
      aria-label="退出登录"
      title="退出登录"
      type="button"
      variant="ghost"
      size="sm"
      className="min-h-11! min-w-11! px-0!"
      onClick={() => {
        clearStaticAccess();
        window.location.replace(staticLoginHref());
      }}
    >
      <LogOut aria-hidden="true" size={17} strokeWidth={1.75} />
    </Button>;
  }

  return <form action={logoutPath} method="post">
    <Button aria-label="退出登录" title="退出登录" type="submit" variant="ghost" size="sm" className="min-h-11! min-w-11! px-0!">
      <LogOut aria-hidden="true" size={17} strokeWidth={1.75} />
    </Button>
  </form>;
}

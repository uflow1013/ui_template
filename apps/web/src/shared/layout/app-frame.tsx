"use client";

import { Button } from "@/shared/arc/button/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/shared/arc/drawer/drawer";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { LOGIN_PATH } from "@/shared/auth/paths";
import { tokens } from "@template/design-tokens";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const route = pathname.replace(/\/$/, "");
  const standalone = route === LOGIN_PATH.slice(0, -1) ||
    route === "/ai-studio" || pathname.startsWith("/orchestratelq");
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageScroll = useRef<HTMLElement>(null);

  const toggleDesktop = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar_state=${!next}; path=/; max-age=604800`;
  }, [collapsed]);

  useEffect(() => {
    if (standalone) return;

    function handleShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "b" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.repeat) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest("input, textarea, select"))) return;
      event.preventDefault();
      if (isMobile) setMobileOpen((open) => !open);
      else toggleDesktop();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isMobile, standalone, toggleDesktop]);

  useEffect(() => {
    if (!window.location.hash) pageScroll.current?.scrollTo({ top: 0 });
  }, [pathname]);

  if (standalone) {
    return <div className="h-dvh overflow-y-auto bg-background">{children}</div>;
  }

  return (
    <Drawer open={isMobile && mobileOpen} onOpenChange={setMobileOpen}>
      <div
        className="flex h-dvh min-h-0 overflow-clip bg-background"
        style={{ "--navigation-width": collapsed ? tokens.layout.sidebarCollapsedWidth : tokens.layout.sidebarWidth } as CSSProperties}
      >
        <aside id="desktop-navigation" className="hidden min-h-0 w-[var(--navigation-width)] shrink-0 overflow-y-auto border-r border-border bg-[var(--surface-muted)] md:flex">
          <AppSidebar collapsed={collapsed} />
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-clip bg-background">
          <SiteHeader
            navigationTrigger={
              <>
                <DrawerTrigger asChild>
                  <Button aria-label="打开导航栏" className="min-h-11! min-w-11! md:hidden!" size="sm" type="button" variant="ghost">
                    <Menu aria-hidden="true" size={18} />
                  </Button>
                </DrawerTrigger>
                <Button aria-controls="desktop-navigation" aria-expanded={!collapsed} aria-label={collapsed ? "展开导航栏" : "折叠导航栏"} className="hidden! md:inline-flex!" onClick={toggleDesktop} size="sm" type="button" variant="ghost">
                  {collapsed ? <PanelLeftOpen aria-hidden="true" size={17} /> : <PanelLeftClose aria-hidden="true" size={17} />}
                </Button>
              </>
            }
          />
          <main
            aria-label="页面内容"
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-auto scroll-pt-8 md:[scrollbar-gutter:stable]"
            data-slot="page-scroll"
            ref={pageScroll}
            tabIndex={0}
          >
            <div className="mx-auto flex w-full min-w-0 max-w-[var(--layout-content-max)] flex-col gap-8 px-5 py-8 md:px-8 md:py-10 xl:px-12">
              {children}
            </div>
          </main>
        </div>
      </div>
      <DrawerContent
        aria-describedby={undefined}
        className="[--drawer-size:min(18rem,calc(100vw-2rem))]!"
        closeLabel="关闭导航栏"
        side="left"
        title="设计导航"
      >
        <AppSidebar onNavigate={() => setMobileOpen(false)} />
      </DrawerContent>
    </Drawer>
  );
}

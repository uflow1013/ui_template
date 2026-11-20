import { AppFrame } from "@/shared/layout/app-frame";
import { ThemeProvider } from "@/shared/providers/theme-provider";
import { tokens, tokenVariables } from "@template/design-tokens";
import {
  DEFAULT_THEME,
  themeBootScript,
  themeStyle,
} from "@template/design-tokens/themes";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import "@/shared/arc/foundation.css";
import "./tailwind.css";

export const metadata: Metadata = {
  title: "澄序 · 设计主题样板",
  description: "一套清晰、克制而有温度的界面主题规则。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${GeistSans.variable} min-w-80 scroll-smooth scroll-pt-8 font-sans antialiased [font-synthesis:none] [text-rendering:optimizeLegibility] selection:bg-[var(--theme-selection)] selection:text-[var(--theme-selection-foreground)] motion-reduce:scroll-auto`}
      data-arc-density="comfortable"
      data-scroll-behavior="smooth"
      data-theme="light"
      data-theme-id={DEFAULT_THEME}
      lang="zh-CN"
      style={
        {
          ...tokenVariables,
          "--radius": tokens.radius.md,
          ...themeStyle(DEFAULT_THEME),
        } as CSSProperties
      }
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      </head>
      <body className="m-0 h-dvh overflow-hidden bg-background text-[length:var(--type-size-md)] leading-[var(--type-line-body)] text-foreground">
        <ThemeProvider>
          <AppFrame>{children}</AppFrame>
        </ThemeProvider>
      </body>
    </html>
  );
}

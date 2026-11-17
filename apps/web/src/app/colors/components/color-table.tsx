"use client";

import { Button } from "@/shared/arc/button/button";
import { EmptyState } from "@/shared/arc/empty-state/empty-state";
import { ScrollArea } from "@/shared/arc/scroll-area/scroll-area";
import { themeStyle } from "@template/design-tokens/themes";
import { Check, Pencil, Search } from "lucide-react";
import { type CSSProperties } from "react";
import { valueLabel } from "./color-values";
import { useColorWorkbench } from "./color-workbench-context";

export function ColorTable() {
  const {
    activeId,
    overrides,
    setGroup,
    setQuery,
    dark,
    visibleThemes,
    groups,
    chooseTheme,
    openEditor,
    resolvedPalettes,
  } = useColorWorkbench();
  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--matrix-outline)] bg-surface">
      <ScrollArea label="主题功能颜色矩阵" orientation="horizontal" scrollbars="always" wheelToHorizontal={false}>
        <table
          className="group/matrix w-full min-w-[740px] border-collapse table-fixed text-left data-[dark=true]:min-w-[500px]"
          data-dark={dark}
        >
          <caption className="sr-only">
            {dark ? "深色" : "三套浅色"}
            主题功能颜色矩阵，点击色块编辑对应功能颜色
          </caption>
          <thead>
            <tr className="group/tr">
              <th
                className="border-b border-b-[var(--matrix-line)] h-[64px] text-[length:.6875rem] font-normal text-[var(--muted-foreground)] bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_45%,_var(--card))] py-3 px-4 first:w-[27%] group-data-[dark=true]/matrix:first:w-[42%]"
                scope="col"
              >
                功能 / 用途
              </th>
              {visibleThemes.map((theme) => (
                <th
                  className="border-b border-b-[var(--matrix-line)] h-[64px] text-[length:.6875rem] font-normal text-[var(--muted-foreground)] bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_45%,_var(--card))] py-3 px-4 first:w-[27%] data-[active=true]:bg-[color-mix(in_oklab,_var(--theme-accent-soft)_45%,_var(--card))] group-data-[dark=true]/matrix:first:w-[42%]"
                  key={theme.id}
                  scope="col"
                  data-active={theme.id === activeId}
                >
                  <Button type="button" variant="ghost"
                    size="sm"
                    onClick={() => chooseTheme(theme.id)}
                  >
                    {theme.name}
                    {theme.id === activeId && <Check size={12} />}
                  </Button>
                  <small className="block mt-0.5 text-[length:.5rem] tracking-[.125em] text-[var(--muted-foreground)]">
                    {theme.mode === "dark" ? "深色" : "浅色"}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((entry) => (
            <tbody className="group/tbody" key={entry.id}>
              <tr className="group/groupHeading">
                <th
                  className="border-b border-b-[var(--matrix-line)] h-[44px] bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_30%,_var(--card))] text-[length:.75rem] font-normal py-2.5 px-4 group-last/tbody:group-last/groupHeading:border-b-0"
                  colSpan={visibleThemes.length + 1}
                  scope="colgroup"
                >
                  <strong className="font-medium">{entry.name}</strong>
                  <small className="ml-3 text-[length:.625rem] text-[var(--muted-foreground)] max-[767px]:hidden">
                    {entry.description}
                  </small>
                  <em className="float-right text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)]">
                    {entry.tokens.length}
                  </em>
                </th>
              </tr>
              {entry.tokens.map((entry) => (
                <tr className="group/tr" key={entry.key}>
                  <th
                    className="border-b border-b-[var(--matrix-line)] font-normal py-3.5 px-4 group-last/tbody:group-last/tr:border-b-0"
                    scope="row"
                  >
                    <strong className="block text-[length:.75rem] font-medium">
                      {entry.name}
                    </strong>
                    <code className="block text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)] wrap-anywhere my-0.5 mx-0">
                      {entry.key}
                    </code>
                    <small className="block text-[length:.625rem] text-[var(--muted-foreground)]">
                      {entry.usage}
                    </small>
                  </th>
                  {visibleThemes.map((theme) => {
                    const value = resolvedPalettes[theme.id][entry.key];
                    const custom = overrides[theme.id]?.[entry.key] !== undefined;
                    return (
                      <td
                        className="border-b border-b-[var(--matrix-line)] border-l border-l-[var(--matrix-line)] py-2.5 px-3 group-last/tbody:group-last/tr:border-b-0"
                        key={theme.id}
                        data-active={theme.id === activeId}
                        data-theme-scope={theme.id}
                        style={
                          themeStyle(
                            theme.id,
                            overrides[theme.id],
                          ) as CSSProperties
                        }
                      >
                        <Button type="button" variant="ghost"
                          className="group/colorCell w-full min-w-0 justify-start! overflow-hidden p-1.5! text-left"
                          onClick={(event) => openEditor(event, theme.id, entry)}
                          aria-label={`编辑${theme.name}的${entry.name}`}
                          title={value}
                        >
                          <span className="block shrink-0 w-[44px] h-[38px] border border-[var(--matrix-outline)] rounded-[.375rem] overflow-hidden [background:repeating-conic-gradient(var(--border)_0%_25%,var(--card)_0%_50%)_50%_/_8px_8px] group-data-[dark=true]/matrix:w-[110px]">
                            <span
                              className="block w-full h-full bg-[var(--paint-color)]"
                              data-paint
                              style={
                                {
                                  "--paint-color": `var(--theme-${entry.key})`,
                                } as CSSProperties
                              }
                            />
                          </span>
                          <span className="min-w-0">
                            <code className="block overflow-hidden whitespace-nowrap text-ellipsis max-w-full text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic">
                              {valueLabel(value)}
                            </code>
                            <small className="block text-[var(--muted-foreground)] mt-1.5 text-[length:.5625rem]">
                              {custom
                                ? "自定义"
                                : value.includes("var(")
                                  ? "跟随语义色"
                                  : "预设颜色"}
                            </small>
                          </span>
                          <Pencil
                            className="text-[var(--muted-foreground)] ml-auto shrink-0 opacity-0 group-hover/colorCell:opacity-100 group-focus-visible/colorCell:opacity-100"
                            size={12}
                          />
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </ScrollArea>
      {!groups.length && (
        <EmptyState
          title="没有匹配的颜色角色"
          description="试试 background、按钮、输入或其他功能名称。"
          icon={<Search aria-hidden="true" />}
          action={
            <Button variant="secondary" onClick={() => {
              setQuery("");
              setGroup("all");
            }}>
              清除筛选
            </Button>
          }
        />
      )}
    </div>
  );
}

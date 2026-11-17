"use client";

import { ColorPicker } from "@/shared/arc/color-picker/color-picker";
import { Button } from "@/shared/arc/button/button";
import { Drawer, DrawerContent } from "@/shared/arc/drawer/drawer";
import { Input } from "@/shared/arc/input/input";
import { themes } from "@template/design-tokens/themes";
import { Check, RotateCcw } from "lucide-react";
import { type CSSProperties } from "react";
import { colorWithOpacity } from "./color-values";
import { useColorWorkbench } from "./color-workbench-context";

export function ColorEditor() {
  const {
    message,
    resolvedPalettes,
    editToken,
    saveTheme,
    editing,
    editorTrigger,
    setEditing,
    validInput,
    changeInput,
    cancelEditor,
  } = useColorWorkbench();
  return (
    <Drawer
      open={!!editing}
      onOpenChange={(open) => {
        if (!open) cancelEditor();
      }}
    >
      <DrawerContent
        className="[--drawer-size:min(100%,420px)]!"
        closeLabel="关闭颜色编辑"
        title="编辑功能颜色"
        description={editing
          ? `${themes.find((theme) => theme.id === editing.themeId)!.name} · ${editing.token.name}`
          : "修改颜色并实时预览"}
        onCloseAutoFocus={(event) => {
          const trigger = editorTrigger.current;
          if (trigger?.isConnected) {
            event.preventDefault();
            trigger.focus();
          }
        }}
      >
        {editing && (
          <div className="flex flex-col gap-4 pt-2 pb-6">
            <div>
              <h2 className="text-[length:1.125rem] font-medium m-0">
                {editing.token.name}
              </h2>
              <code className="text-[length:.6875rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)]">
                {editing.token.key}
              </code>
              <p className="text-[length:.75rem] mt-1.5 mb-0 text-[var(--muted-foreground)] mx-0">
                {editing.token.usage}
              </p>
            </div>
            <div className="h-[128px] rounded-[.75rem] overflow-hidden border border-[var(--border)] [background:repeating-conic-gradient(var(--border)_0%_25%,var(--card)_0%_50%)_50%_/_12px_12px]">
              <div
                className="w-full h-full bg-[var(--paint-color)]"
                style={
                  {
                    "--paint-color": `var(--theme-${editing.token.key})`,
                  } as CSSProperties
                }
              />
            </div>
            <ColorPicker
              label="选择颜色"
              className="[--picker-width:min(19rem,calc(100dvw_-_2.5rem))]!"
              background={resolvedPalettes[editing.themeId].background}
              value={colorWithOpacity(editing.picker, editing.opacity)}
              onValueChange={changeInput}
            />
            <Input
              label="颜色值"
              className="text-[length:.75rem]! font-[family-name:ui-monospace,monospace]!"
              description="支持 HEX（含透明度）、RGB、HSL 与 OKLCH。"
              error={validInput ? undefined : "请输入有效颜色，例如 #7669C7 或 oklch(0.6 0.1 280)。"}
              value={editing.input}
              onChange={(event) => changeInput(event.target.value)}
              spellCheck={false}
            />
            <div className="flex flex-col border border-[var(--border)] rounded-[.75rem] bg-[var(--theme-background)] p-4 gap-3">
              <span className="text-[length:.625rem] text-[var(--muted-foreground)]">
                应用预览
              </span>
              <div className="flex flex-wrap gap-2">
                <Button>主要操作</Button>
                <Button variant="secondary">次要操作</Button>
                <Button variant="danger">删除</Button>
              </div>
              <Input
                label="输入预览"
                placeholder="输入内容，查看字段效果"
                aria-label="颜色编辑输入预览"
              />
              <p className="flex items-center text-[var(--theme-success-soft-foreground)] text-[length:.625rem] m-0 gap-1.5">
                <Check size={13} />
                状态、文字与容器同步更新
              </p>
            </div>
            <div className="bg-[var(--theme-surface-secondary)] rounded-[.5rem] py-3 px-4">
              <strong className="text-[length:.75rem] font-medium">
                预览与保存分开
              </strong>
              <p className="mt-1 mb-0 text-[length:.6875rem] text-[var(--muted-foreground)] mx-0">
                保留预览只影响当前访问。保存主题会保留所有主题的自定义颜色和当前选择，仅存于当前浏览器。
              </p>
            </div>
            <Button
              className="self-start"
              variant="ghost"
              onClick={() => {
                editToken(editing.themeId, editing.token.key);
                setEditing(null);
              }}
            >
              <RotateCcw />
              恢复预设 / 自动派生
            </Button>
            <p
              role="status"
              className="text-[length:.6875rem] text-[var(--muted-foreground)] m-0"
            >
              {message}
            </p>
            <div className="flex justify-end flex-wrap pt-3 border-t border-t-[var(--border)] gap-2">
              <Button variant="secondary" onClick={cancelEditor}>
                取消修改
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditing(null)}
                disabled={!validInput}
              >
                保留预览
              </Button>
              <Button
                disabled={!validInput}
                onClick={() => {
                  if (saveTheme()) setEditing(null);
                }}
              >
                保存主题
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

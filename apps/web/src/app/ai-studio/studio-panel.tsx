"use client";

import { Button } from "@/shared/arc/button/button";
import { Drawer, DrawerContent } from "@/shared/arc/drawer/drawer";
import { SearchField } from "@/shared/arc/search-field/search-field";
import { ArrowLeft, ArrowUpRight, X } from "lucide-react";
import { useId, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { commandGroups, type StudioCommand } from "./commands";
import styles from "./studio-panel.module.css";

const dockQuery = "(min-width: 1200px)";
export const studioPanelId = "ai-studio-extension";

function subscribeToDock(onChange: () => void) {
  const media = window.matchMedia(dockQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useStudioPanelDock() {
  return useSyncExternalStore(
    subscribeToDock,
    () => window.matchMedia(dockQuery).matches,
    () => false,
  );
}

interface PanelResult {
  title: string;
  description?: string;
  content: ReactNode;
}

interface StudioPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunCommand: (command: StudioCommand) => void;
  onBrowseCommands?: () => void;
  result?: PanelResult;
  busy?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

function CommandDirectory({ onRunCommand, busy }: Pick<StudioPanelProps, "onRunCommand" | "busy">) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase().replace(/^\//, "");
  const groups = commandGroups.map((group) => ({
    ...group,
    matches: Array.from<StudioCommand>(group.tools).filter(([id, label, description]) =>
      [id, label, description, group.label].some((text) => text.toLocaleLowerCase().includes(search)),
    ),
  })).filter((group) => group.matches.length > 0);

  return (
    <div className={styles.directory}>
      <div className={styles.search}>
        <SearchField label="搜索指令" placeholder="输入名称或斜杠指令" value={query} onValueChange={setQuery} />
      </div>
      {!groups.length && <p className={styles.empty} role="status">没有匹配的指令。试试「研究」或「翻译」。</p>}
      {groups.map((group) => (
        <section key={group.id} className={styles.commandGroup} aria-label={group.label}>
          <h3>{group.label}</h3>
          <ul>
            {group.matches.map((command) => (
              <li key={command[0]}>
                <Button
                  className={styles.command}
                  variant="ghost"
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => onRunCommand(command)}
                >
                  <span className={styles.commandCopy}>
                    <span>{command[1]}</span>
                    <code>/{command[0]}</code>
                  </span>
                  <ArrowUpRight className={styles.commandIcon} size={15} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PanelBody({ result, onRunCommand, onBrowseCommands, busy }: Pick<StudioPanelProps, "result" | "onRunCommand" | "onBrowseCommands" | "busy">) {
  if (!result) return <CommandDirectory onRunCommand={onRunCommand} busy={busy} />;

  return (
    <div className={styles.result}>
      <div className={styles.resultHeading}>
        {onBrowseCommands && (
          <Button type="button" variant="ghost" size="sm" className={styles.back} onClick={onBrowseCommands}>
            <ArrowLeft size={15} aria-hidden="true" /> 浏览指令
          </Button>
        )}
        <h3>{result.title}</h3>
        {result.description && <p>{result.description}</p>}
      </div>
      <div className={styles.artifact}>{result.content}</div>
    </div>
  );
}

export function StudioPanel({ open, onOpenChange, onRunCommand, onBrowseCommands, result, busy, returnFocusRef }: StudioPanelProps) {
  const dock = useStudioPanelDock();
  const titleId = useId();
  const mode = result ? "result" : "commands";
  const body = <PanelBody result={result} onRunCommand={onRunCommand} onBrowseCommands={onBrowseCommands} busy={busy} />;

  if (dock) {
    if (!open) return null;
    return (
      <aside id={studioPanelId} className={styles.dock} data-mode={mode} aria-labelledby={titleId}>
        <div className={styles.header}>
          <h2 id={titleId}>扩展面板</h2>
          <Button
            className={styles.close}
            size="sm"
            variant="ghost"
            type="button"
            aria-label="关闭扩展面板"
            onClick={() => {
              onOpenChange(false);
              returnFocusRef?.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
        <div className={styles.scroll} key={result?.title ?? "commands"}>
          {body}
        </div>
      </aside>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        id={studioPanelId}
        title="扩展面板"
        closeLabel="关闭扩展面板"
        side="right"
        className={styles.drawer}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        {body}
      </DrawerContent>
    </Drawer>
  );
}

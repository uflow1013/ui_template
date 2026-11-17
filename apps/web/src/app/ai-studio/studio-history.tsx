"use client";

import { Button } from "@/shared/arc/button/button";
import { Drawer, DrawerContent } from "@/shared/arc/drawer/drawer";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { MessageSquare, SquarePen } from "lucide-react";
import Link from "next/link";
import { useEffect, type RefObject } from "react";
import styles from "./studio-history.module.css";

export const STUDIO_HISTORY_DRAWER_ID = "studio-history-drawer";

interface HistoryContentProps {
  conversations: readonly { id: number; title: string }[];
  activeId: number;
  onSelect: (id: number) => void;
  onNew: () => void;
}

interface StudioHistoryProps extends HistoryContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

function HistoryContent({ conversations, activeId, onSelect, onNew }: HistoryContentProps) {
  return (
    <div className={styles.content}>
      <Link className={styles.brand} href="/" aria-label="澄序首页">
        <span className={styles.brandMark} aria-hidden="true">澄</span>
        <span>澄序</span>
      </Link>

      <Button type="button" size="md" variant="secondary" className={styles.newConversation} onClick={onNew}>
        <SquarePen size={16} strokeWidth={1.75} aria-hidden="true" />
        新建对话
      </Button>

      <nav className={styles.history} aria-label="最近会话">
        <p className={styles.historyTitle}>最近会话</p>
        {conversations.length ? (
          <ul className={styles.list}>
            {conversations.map(({ id, title }) => {
              const label = title.trim() || "新对话";
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={styles.entry}
                    aria-current={id === activeId ? "true" : undefined}
                    onClick={() => onSelect(id)}
                  >
                    <MessageSquare size={15} strokeWidth={1.75} aria-hidden="true" />
                    <span title={label}>{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className={styles.empty}>暂无会话</p>}
      </nav>
    </div>
  );
}

export function StudioHistory({ open, onOpenChange, returnFocusRef, ...history }: StudioHistoryProps) {
  const mobile = useIsMobile();

  useEffect(() => {
    if (!mobile && open) onOpenChange(false);
  }, [mobile, open, onOpenChange]);

  return (
    <>
      <aside className={styles.sidebar} aria-label="会话导航">
        <HistoryContent {...history} />
      </aside>
      {mobile && (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent
            id={STUDIO_HISTORY_DRAWER_ID}
            className={styles.drawer}
            side="left"
            title="会话导航"
            closeLabel="关闭会话导航"
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              const trigger = returnFocusRef?.current;
              if (trigger?.getClientRects().length) {
                event.preventDefault();
                trigger.focus();
              }
            }}
          >
            <HistoryContent
              {...history}
              onSelect={(id) => {
                history.onSelect(id);
                onOpenChange(false);
              }}
              onNew={() => {
                history.onNew();
                onOpenChange(false);
              }}
            />
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

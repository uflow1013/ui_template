"use client";

import { useThemeEditor } from "@/shared/providers/theme-provider";
import { ToastStack, ToastStackProvider } from "@/shared/arc/toast-stack/toast-stack";
import { createContext, useContext, useState, type ReactNode } from "react";
import { componentExamples, componentGroups } from "./component-registry";
import type { ComponentExample as Example } from "./example-types";

function useShowcaseState() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tier, setTier] = useState("all");
  const { activeId, selectTheme } = useThemeEditor();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery = (example: Example) =>
    `${example.title} ${example.name} ${example.id} ${example.slug ?? ""} ${example.description} Arc ${example.tier ?? ""} ${componentGroups.find((group) => group.id === example.group)?.name}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  const visible = componentExamples.filter(
    (example) =>
      (category === "all" || example.group === category) &&
      (tier === "all" || (example.tier ?? "base") === tier) &&
      matchesQuery(example),
  );
  const groups = componentGroups
    .map((group) => ({
      ...group,
      examples: visible.filter((example) => example.group === group.id),
    }))
    .filter((group) => group.examples.length);
  const reset = () => {
    setQuery("");
    setCategory("all");
    setTier("all");
  };
  return {
    query,
    setQuery,
    category,
    setCategory,
    tier,
    setTier,
    activeId,
    selectTheme,
    visible,
    groups,
    reset,
  };
}

const Context = createContext<ReturnType<typeof useShowcaseState> | null>(null);

export function ShowcaseProvider({ children }: { children: ReactNode }) {
  const value = useShowcaseState();
  return (
    <Context.Provider value={value}>
      <ToastStackProvider>
        {children}
        <ToastStack label="组件演示通知" hotkey={false} />
      </ToastStackProvider>
    </Context.Provider>
  );
}

export function useShowcase() {
  const value = useContext(Context);
  if (!value) throw new Error("ShowcaseProvider is required");
  return value;
}

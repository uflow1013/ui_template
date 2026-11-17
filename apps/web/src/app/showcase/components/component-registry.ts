import { arcCatalog } from "./arc-catalog";
import { arcDemoLoaders } from "./arc-demos/loaders";
import { arcProCatalog } from "./arc-pro-catalog";
import type { ComponentExample, DemoSize } from "./example-types";
import { demoOverrides } from "./demo-overrides";

export const componentGroups = [
  {
    id: "actions",
    name: "基础操作",
  },
  {
    id: "forms",
    name: "表单输入",
  },
  {
    id: "navigation",
    name: "导航切换",
  },
  {
    id: "overlays",
    name: "浮层交互",
  },
  {
    id: "feedback",
    name: "反馈状态",
  },
  {
    id: "data",
    name: "数据展示",
  },
] as const;

const demoSizes: Readonly<Partial<Record<string, DemoSize>>> = {
  "activity-heatmap": "full",
  "agent-loop": "full",
  "brush-chart": "full",
  "chat-thread": "full",
  "mixture-of-experts": "full",
  "prompt-cache": "full",
  "reasoning-tree": "full",
  "resizable-panels": "full",
  "sortable-data-table": "full",
  "speculative-decoding": "full",
  "tree-table": "full",
  "accordion": "wide",
  "alert": "wide",
  "announcement-bar": "wide",
  "bar-chart": "wide",
  "button": "wide",
  "calendar": "wide",
  "carousel": "wide",
  "code-block": "wide",
  "comment-thread": "wide",
  "cookie-consent": "wide",
  "date-range-picker": "wide",
  "file-upload": "wide",
  "filter-toolbar": "wide",
  "gradient-mesh": "wide",
  "icon-morph": "wide",
  "image-compare": "wide",
  "input": "wide",
  "json-viewer": "wide",
  "line-chart": "wide",
  "multi-step-form": "wide",
  "range-histogram-slider": "wide",
  "rich-text-editor": "wide",
  "ridgeline": "wide",
  "selection-toolbar": "wide",
  "shortcut-recorder": "wide",
  "signature-pad": "wide",
  "slope-chart": "wide",
  "streamgraph": "wide",
  "timeline": "wide",
  "treemap": "wide",
};

const sizeOrder = { compact: 0, wide: 1, full: 2 } as const;
const blockDocs = new Set([
  "command-palette",
  "file-upload",
  "multi-step-form",
  "notification-center",
  "otp-input",
  "selection-toolbar",
]);

function docsFor(slug: string) {
  if (slug === "gradient-mesh" || slug === "kbd") return undefined;
  return `https://uiarc.dev/components/${blockDocs.has(slug) ? "blocks/" : ""}${slug}`;
}

export const componentExamples: ComponentExample[] = [
  ...arcCatalog.map(([slug, group, title, name, description, importStatement]): ComponentExample => {
    const override = demoOverrides[slug];
    return {
      id: override?.id ?? (slug === "toast" ? "arc-toast" : slug),
      slug,
      group,
      title,
      name,
      description,
      tier: importStatement.includes("@/shared/arc/pro/") ? "pro" : undefined,
      size: demoSizes[slug],
      docs: docsFor(slug),
      importStatement,
      loadDemo: override?.loadDemo ?? arcDemoLoaders[slug],
    };
  }),
  ...arcProCatalog.map(([slug, group, title, name, description, exportName]): ComponentExample => ({
    id: slug,
    slug,
    group,
    title,
    name,
    description,
    tier: "pro",
    docs: docsFor(slug),
    importStatement: `import { ${exportName} } from "@/shared/arc/pro/${slug}/${slug}";`,
    loadDemo: arcDemoLoaders[slug],
  })),
].sort((first, second) =>
  Number(Boolean(second.loadDemo)) - Number(Boolean(first.loadDemo)) ||
  sizeOrder[first.size ?? "compact"] - sizeOrder[second.size ?? "compact"]
);

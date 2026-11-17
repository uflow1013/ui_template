"use client";

import { Dock, type DockItem } from "@/shared/arc/pro/dock/dock";
import { GlassSegmented } from "@/shared/arc/pro/glass-segmented/glass-segmented";
import { GlassTabBar } from "@/shared/arc/pro/glass-tabbar/glass-tabbar";
import { LiquidTabBar } from "@/shared/arc/pro/liquid-tab-bar/liquid-tab-bar";
import { MegaMenuMorph } from "@/shared/arc/pro/mega-menu-morph/mega-menu-morph";
import { MorphNav } from "@/shared/arc/pro/morph-nav/morph-nav";
import { OrbitMenu } from "@/shared/arc/pro/orbit-menu/orbit-menu";
import { TeamSwitcher } from "@/shared/arc/pro/team-switcher/team-switcher";
import { TocProgress } from "@/shared/arc/pro/toc-progress/toc-progress";
import { Archive, BookOpen, FileText, LayoutGrid, MessageSquare, Palette, Share2, Star } from "lucide-react";
import { useId, useRef, useState } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

const views = [
  { value: "overview", label: "概览", icon: <LayoutGrid size={17} /> },
  { value: "files", label: "文件", icon: <FileText size={17} /> },
  { value: "inbox", label: "收件箱", icon: <MessageSquare size={17} />, badge: 3 },
];

function viewLabel(value: string) {
  return views.find((view) => view.value === value)?.label ?? value;
}

export function DockDemo() {
  const [value, setValue] = useState("overview");
  const [items, setItems] = useState<DockItem[]>(() => views.map(({ value: id, ...view }) => ({ id, ...view })));
  return (
    <DemoColumn>
      <Dock items={items} value={value} onValueChange={setValue} onItemsChange={setItems} label="工作台快捷入口" />
      <DemoResult>当前打开{viewLabel(value)}，可拖动图标调整顺序。</DemoResult>
    </DemoColumn>
  );
}

export function GlassSegmentedDemo() {
  const [value, setValue] = useState("overview");
  return (
    <DemoColumn>
      <GlassSegmented label="工作台视图" options={views} value={value} onValueChange={setValue} />
      <DemoResult>当前视图为{viewLabel(value)}。</DemoResult>
    </DemoColumn>
  );
}

export function GlassTabBarDemo() {
  const [value, setValue] = useState("overview");
  return (
    <DemoColumn>
      <GlassTabBar label="工作台标签" items={views} value={value} onValueChange={setValue} />
      <DemoResult>已打开{viewLabel(value)}。</DemoResult>
    </DemoColumn>
  );
}

export function LiquidTabBarDemo() {
  const [value, setValue] = useState("overview");
  return (
    <DemoColumn>
      <LiquidTabBar label="工作台标签" tabs={views} labels="always" value={value} onValueChange={setValue} />
      <DemoResult>已打开{viewLabel(value)}。</DemoResult>
    </DemoColumn>
  );
}

export function MegaMenuMorphDemo() {
  const [destination, setDestination] = useState("");
  return (
    <div className="grid w-full max-w-2xl gap-2">
      <MegaMenuMorph
        label="设计文档菜单"
        brand={{ name: "澄序" }}
        items={[
          { value: "learn", label: "设计规范", groups: [{ links: [
            { label: "颜色与主题", description: "语义色和明暗主题", icon: <Palette size={17} /> },
            { label: "组件用法", description: "组件选择和交互示例", icon: <BookOpen size={17} /> },
          ] }] },
          { value: "examples", label: "示例", groups: [{ links: [
            { label: "工作台", description: "在主题中查看应用布局", icon: <LayoutGrid size={17} /> },
          ] }] },
        ]}
        onNavigate={(item) => setDestination(item.label)}
      />
      <DemoResult>{destination && `已选择「${destination}」。`}</DemoResult>
    </div>
  );
}

export function MorphNavDemo() {
  const [destination, setDestination] = useState("");
  return (
    <div className="grid w-full max-w-2xl gap-2">
      <MorphNav
        label="设计导航"
        collapseBelow={380}
        items={[
          { value: "guide", label: "规范", links: [
            { label: "字体层级", description: "标题与正文", icon: <FileText size={17} /> },
            { label: "主题色", description: "颜色角色", icon: <Palette size={17} /> },
          ] },
          { value: "work", label: "工作区", links: [
            { label: "设计评审", icon: <MessageSquare size={17} /> },
          ] },
        ]}
        search={{
          placeholder: "搜索设计规范",
          items: [{ label: "字体层级", group: "规范", keywords: "字号 排版", icon: <FileText size={17} /> }],
        }}
        onNavigate={(item) => setDestination(item.label)}
      />
      <DemoResult>{destination && `已选择「${destination}」。`}</DemoResult>
    </div>
  );
}

const documentActions = [
  { id: "save", label: "收藏", icon: <Star size={16} />, done: "已收藏" },
  { id: "share", label: "分享", icon: <Share2 size={16} />, done: "已选择分享" },
  { id: "archive", label: "归档", icon: <Archive size={16} />, done: "已归档" },
];

export function OrbitMenuDemo() {
  const [value, setValue] = useState("");
  return (
    <DemoColumn>
      <div className="grid min-h-28 place-items-center pt-12">
        <OrbitMenu actions={documentActions} onAction={setValue} label="草稿操作" />
      </div>
      <DemoResult>{value ? documentActions.find((action) => action.id === value)?.done : "展开菜单以选择操作。"}</DemoResult>
    </DemoColumn>
  );
}

export function TeamSwitcherDemo() {
  const [selected, setSelected] = useState("澄序设计");
  return (
    <DemoColumn>
      <TeamSwitcher
        workspaces={[
          { id: "design", name: "澄序设计", plan: "团队", members: 6, role: "所有者" },
          { id: "product", name: "产品工作台", plan: "团队", members: 12, role: "成员" },
        ]}
        onValueChange={(_, workspace) => setSelected(workspace.name)}
      />
      <DemoResult>当前工作区为{selected}。</DemoResult>
    </DemoColumn>
  );
}

export function TocProgressDemo() {
  const id = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sections = [
    { id: `${id}-roles`, label: "语义角色", detail: "正文、背景、强调与状态各有独立用途。" },
    { id: `${id}-themes`, label: "主题切换", detail: "同一套语义角色分别绑定浅色和深色数值。" },
    { id: `${id}-review`, label: "验收界面", detail: "检查对比度、焦点、窄屏和长文本。" },
  ];
  return (
    <div className="grid w-full max-w-lg gap-2">
      <TocProgress scrollContainer={scrollRef} items={sections} title="主题使用指南" showTimeLeft={false} />
      <div className="h-44 overflow-auto rounded-[var(--radius-panel)] border border-border p-3" ref={scrollRef} tabIndex={0} aria-label="主题指南正文">
        {sections.map((section) => (
          <div key={section.id} id={section.id} className="min-h-32 py-2">
            <p className="font-medium">{section.label}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{section.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

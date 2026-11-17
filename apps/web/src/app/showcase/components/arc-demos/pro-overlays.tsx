"use client";

import { Button } from "@/shared/arc/button/button";
import { AiCommand } from "@/shared/arc/pro/ai-command/ai-command";
import { CardToArticle } from "@/shared/arc/pro/card-to-article/card-to-article";
import { ConfirmPopover } from "@/shared/arc/pro/confirm-popover/confirm-popover";
import { ControlCenter } from "@/shared/arc/pro/control-center/control-center";
import { GlassMenu } from "@/shared/arc/pro/glass-menu/glass-menu";
import { LightboxGallery } from "@/shared/arc/pro/lightbox-gallery/lightbox-gallery";
import { ShareAccess } from "@/shared/arc/pro/share-access/share-access";
import { ShareSheet } from "@/shared/arc/pro/share-sheet/share-sheet";
import { Sheet, SheetStack, SheetTrigger } from "@/shared/arc/pro/sheet-stack/sheet-stack";
import { Archive, Bell, BookOpen, Check, CircleHelp, FileText, Focus, Link, Lock, MessageSquare, Share2 } from "lucide-react";
import { useId, useState } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

export function AiCommandDemo() {
  const [selected, setSelected] = useState("");
  return (
    <div className="grid w-full max-w-xl gap-2">
      <AiCommand
        autoPlay={false}
        height={420}
        items={[
          { id: "draft", label: "打开发布草稿", group: "产品资料", icon: <FileText size={16} />, keywords: ["发布", "草稿"] },
          { id: "guide", label: "查看组件规范", group: "产品资料", icon: <BookOpen size={16} /> },
        ]}
        placeholder={{ search: "搜索命令", ask: "问一个发布问题" }}
        suggestedQuestions={["发布前还有哪些要检查？"]}
        onSelect={(item) => setSelected(item.label)}
        onAsk={async () => ({
          text: "发布前请确认键盘导航、窄屏布局和深色主题都已通过检查。[1]",
          sources: [{ id: "review", title: "发布检查清单" }],
        })}
      />
      <DemoResult>{selected && `已选中「${selected}」`}</DemoResult>
    </div>
  );
}

const mediaPath = `${process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? ""}/media`;
const landscapeImages = [
  { src: `${mediaPath}/photos/mountain-ridges.jpg`, alt: "岩石山脊", title: "山脊", width: 1600, height: 1068 },
  { src: `${mediaPath}/photos/alpine-lake.jpg`, alt: "高山湖泊", title: "湖畔", width: 1067, height: 1600 },
];

export function CardToArticleDemo() {
  return (
    <div className="w-full max-w-xl">
      <CardToArticle
        closeLabel="关闭文章"
        items={landscapeImages.map((photo, index) => ({
          id: String(index),
          title: photo.title,
          image: photo.src,
          imageAlt: photo.alt,
          tag: "周末路线",
          meta: "阅读 2 分钟",
          body: <p>沿着小径走到视野开阔处，再顺原路返回。建议预留半天，出发前先查看天气。</p>,
        }))}
      />
    </div>
  );
}

export function ConfirmPopoverDemo() {
  const [archived, setArchived] = useState(false);
  return (
    <DemoColumn>
      <div>
        <ConfirmPopover
          title="归档发布草稿？"
          description="草稿会从进行中移到归档。"
          confirmLabel="确认归档"
          cancelLabel="取消"
          tone="neutral"
          onDone={() => setArchived(true)}
        >
          <Button variant="secondary">归档草稿</Button>
        </ConfirmPopover>
      </div>
      <DemoResult>{archived ? "草稿已归档。" : "草稿仍在进行中。"}</DemoResult>
    </DemoColumn>
  );
}

export function ControlCenterDemo() {
  return (
    <DemoColumn>
      <ControlCenter
        label="工作台控制中心"
        defaultVolume={40}
        focusModes={[
          { id: "focus", label: "专注", icon: Focus, description: "暂时静音普通提醒", defaultMinutes: 25 },
          { id: "present", label: "演示", icon: Bell, description: "保持界面安静", defaultMinutes: 45 },
        ]}
        channels={[{ id: "mentions", label: "提及", defaultOn: true }, { id: "reviews", label: "设计评审", defaultOn: true }]}
      />
    </DemoColumn>
  );
}

export function GlassMenuDemo() {
  const [selected, setSelected] = useState("");
  return (
    <DemoColumn>
      <GlassMenu
        label="草稿操作"
        groups={[{
          id: "document",
          label: "草稿",
          items: [
            { id: "share", label: "共享访问", icon: <Share2 size={16} /> },
            { id: "archive", label: "归档", icon: <Archive size={16} /> },
          ],
        }]}
        onSelect={(_, item) => setSelected(item.label)}
      >
        草稿操作
      </GlassMenu>
      <DemoResult>{selected && `刚刚选择了${selected}`}</DemoResult>
    </DemoColumn>
  );
}

export function LightboxGalleryDemo() {
  return <LightboxGallery className="w-full max-w-xl" images={landscapeImages} label="周末路线图集" />;
}

export function ShareAccessDemo() {
  const [invited, setInvited] = useState("");
  return (
    <DemoColumn>
      <ShareAccess
        title="发布检查清单"
        defaultMembers={[{ id: "self", email: "lin@example.test", name: "林嘉", role: "owner" }]}
        selfId="self"
        directory={[{ name: "许知宁", email: "xu@example.test" }, { name: "周岩", email: "zhou@example.test" }]}
        link="https://example.test/release-checklist"
        onInvite={(people) => setInvited(people.map((person) => person.name ?? person.email).join("、"))}
      />
      <DemoResult>{invited && `已记录对 ${invited} 的示例邀请。`}</DemoResult>
    </DemoColumn>
  );
}

export function ShareSheetDemo() {
  const [shared, setShared] = useState("");
  return (
    <DemoColumn>
      <ShareSheet
        title="界面评审"
        label="分享评审"
        link="https://example.test/design-review"
        people={[
          { id: "lin", name: "林嘉", avatar: `${mediaPath}/people/emma-collins.svg` },
          { id: "xu", name: "许知宁", avatar: `${mediaPath}/people/marcus-johnson.svg` },
        ]}
        access={[
          { value: "restricted", label: "受邀成员", description: "仅受邀成员可查看", icon: <Lock size={16} /> },
          { value: "link", label: "知道链接的人", description: "使用链接可查看", icon: <Link size={16} /> },
        ]}
        channels={[{ id: "message", label: "消息", icon: <MessageSquare size={16} />, doneLabel: "已记录" }]}
        onSend={({ people }) => setShared(people.map((person) => person.name).join("、"))}
      />
      <DemoResult>{shared && `已记录发送给 ${shared} 的示例分享。`}</DemoResult>
    </DemoColumn>
  );
}

export function SheetStackDemo() {
  const id = useId();
  const [allowed, setAllowed] = useState(false);
  return (
    <SheetStack>
      <SheetTrigger sheet={`${id}-settings`} className="rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm">查看通知设置</SheetTrigger>
      <Sheet id={`${id}-settings`} title="通知设置" description="查看工作台提醒的设置。">
        <SheetTrigger sheet={`${id}-mentions`} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm">
          <CircleHelp size={16} aria-hidden="true" /> 评审提醒
        </SheetTrigger>
      </Sheet>
      <Sheet id={`${id}-mentions`} title="评审提醒" description="开启后，收到评审请求时会提醒你。">
        <Button variant="secondary" aria-pressed={allowed} onClick={() => setAllowed(!allowed)}>
          {allowed && <Check size={16} aria-hidden="true" />}
          {allowed ? "已开启评审提醒" : "开启评审提醒"}
        </Button>
      </Sheet>
    </SheetStack>
  );
}

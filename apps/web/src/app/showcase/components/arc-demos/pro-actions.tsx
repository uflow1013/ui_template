"use client";

import { useState } from "react";
import { FileText, ListTodo } from "lucide-react";
import { ActionMorph } from "@/shared/arc/pro/action-morph/action-morph";
import { BookingPill } from "@/shared/arc/pro/booking-pill/booking-pill";
import { PrizeWheel } from "@/shared/arc/pro/prize-wheel/prize-wheel";
import { StarterPrompts } from "@/shared/arc/pro/starter-prompts/starter-prompts";
import { TldrToggle } from "@/shared/arc/pro/tldr-toggle/tldr-toggle";

export function ActionMorphDemo() {
  const [result, setResult] = useState("");
  return (
    <div className="relative min-h-64 w-full rounded-[var(--radius-panel)] border border-border bg-surface p-4">
      <p className="text-sm text-muted-foreground">选择新建笔记或任务。</p>
      <p role="status" className="mt-2 text-sm">{result}</p>
      <ActionMorph
        label="新建"
        actions={[
          {
            id: "note",
            label: "记笔记",
            icon: <FileText size={16} />,
            composer: { title: "笔记", placeholder: "记录今天的进展", multiline: true, submitLabel: "保存", successLabel: "已保存笔记" },
          },
          {
            id: "task",
            label: "建任务",
            icon: <ListTodo size={16} />,
            composer: {
              title: "任务",
              placeholder: "输入待办事项",
              choices: { label: "截止", options: ["今天", "下周"] },
              submitLabel: "添加",
              successLabel: "已添加任务",
            },
          },
        ]}
        onSubmit={({ text, choice }) => setResult(choice ? `已添加：${text} · ${choice}` : `已保存：${text}`)}
      />
    </div>
  );
}

export function BookingPillDemo() {
  return <BookingPill venue="春山书店" venueDetail="展览导览预约" startDate="2026-11-17" times={["10:30", "13:00", "15:30", "17:00"]} label="预约导览" hourCycle={24} />;
}

export function PrizeWheelDemo() {
  return <PrizeWheel title="活动抽奖" description="转动转盘查看一次模拟结果" />;
}

export function StarterPromptsDemo() {
  return <StarterPrompts greeting="开始一段对话" description="选择提示词填入输入框，或自行编辑。" count={3} />;
}

export function TldrToggleDemo() {
  return <TldrToggle autoPlay={false} />;
}

import { Button } from "@/shared/arc/button/button";
import { AgentCursor } from "@/shared/arc/pro/agent-cursor/agent-cursor";
import { AgentHandoff } from "@/shared/arc/pro/agent-handoff/agent-handoff";
import { AgentLoop } from "@/shared/arc/pro/agent-loop/agent-loop";
import { AgentPlan } from "@/shared/arc/pro/agent-plan/agent-plan";
import { AgentStatus } from "@/shared/arc/pro/agent-status/agent-status";
import { AgentTimeline } from "@/shared/arc/pro/agent-timeline/agent-timeline";
import { AiWorkflow } from "@/shared/arc/pro/ai-workflow/ai-workflow";
import { ConnectorSetup } from "@/shared/arc/pro/connector-setup/connector-setup";
import { TicketRouter } from "@/shared/arc/pro/ticket-router/ticket-router";
import { useState } from "react";
import { AgentRun } from "../arc-blocks/agent-run/agent-run";
import styles from "../studio.module.css";

const agentStates = [
  { value: "idle", label: "就绪" },
  { value: "working", label: "执行中" },
  { value: "done", label: "完成" },
] as const;

function StatusPreview() {
  const [status, setStatus] = useState<(typeof agentStates)[number]["value"]>("idle");

  return <div className={styles.optionDemo}>
    <AgentStatus
      activity={status === "working" ? { label: "整合示例文档" } : status === "done" ? { label: "已整理 3 份文档" } : undefined}
      status={status}
      settleAfter={null}
    />
    <div className={styles.controls} aria-label="切换运行状态">
      {agentStates.map((state) => <Button
        aria-pressed={state.value === status}
        key={state.value}
        size="sm"
        variant="secondary"
        onClick={() => setStatus(state.value)}
      >{state.label}</Button>)}
    </div>
  </div>;
}

export const artifacts = {
  "agent-plan": () => <AgentPlan goal="整理季度发布计划，并找出需要核实的事项。" />,
  "agent-run": () => <AgentRun />,
  "agent-loop": () => <AgentLoop />,
  "agent-timeline": () => <AgentTimeline />,
  "agent-status": StatusPreview,
  "agent-cursor": () => <AgentCursor loop={false} />,
  "agent-handoff": () => <AgentHandoff />,
  "ai-workflow": () => <AiWorkflow autoPlay={false} />,
  "ticket-router": () => <TicketRouter loop={false} />,
  "connector-setup": () => <ConnectorSetup title="连接示例来源" description="本地预演，不会连接外部账户。" autoPlay={false} />,
};

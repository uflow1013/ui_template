"use client";

import { ChargeSession } from "@/shared/arc/pro/charge-session/charge-session";
import { CursorTrailDraw } from "@/shared/arc/pro/cursor-trail-draw/cursor-trail-draw";
import { DataFlow } from "@/shared/arc/pro/data-flow/data-flow";
import { DnsResolution } from "@/shared/arc/pro/dns-resolution/dns-resolution";
import { LiveVisitors } from "@/shared/arc/pro/live-visitors/live-visitors";
import { MultiRegionFailover } from "@/shared/arc/pro/multi-region-failover/multi-region-failover";
import { PaymentFlow } from "@/shared/arc/pro/payment-flow/payment-flow";
import { TypewriterTerminal } from "@/shared/arc/pro/typewriter-terminal/typewriter-terminal";

export function ChargeSessionDemo() {
  return <ChargeSession title="园区快充 · 4 号桩" location="示例会话 · 150 kW" currency="CNY" locale="zh-CN" />;
}

export function CursorTrailDrawDemo() {
  return <CursorTrailDraw label="项目草稿画板" hint="选择工具后在画板上拖动" />;
}

export function DataFlowDemo() {
  return <DataFlow caption="查看请求如何穿过处理中心到达各个目的地。" />;
}

export function DnsResolutionDemo() {
  return <DnsResolution domain="design.example.com" caption label="从浏览器发起查询并复用缓存" />;
}

export function LiveVisitorsDemo() {
  return <LiveVisitors title="示例站点 · 当前访客" />;
}

export function MultiRegionFailoverDemo() {
  return <MultiRegionFailover hostname="app.example.com" caption label="观察故障流量如何切到备用节点" />;
}

export function PaymentFlowDemo() {
  return <PaymentFlow amount={3600} currency="CNY" locale="zh-CN" caption="示例订单，观察授权和完成两个阶段。" />;
}

export function TypewriterTerminalDemo() {
  return <TypewriterTerminal title="发布日志" rows={7} loop={false} />;
}

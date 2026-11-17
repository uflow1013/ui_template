"use client";

import { CopyButton } from "@/shared/arc/copy-button/copy-button";
import SegmentedControl from "@/shared/arc/segmented-control/segmented-control";

export type PreviewDevice = "web" | "mobile";

const deviceOptions = [
  { value: "web", label: "桌面" },
  { value: "mobile", label: "移动端" },
];

export function PreviewDeviceControl({ value, onChange }: {
  value: PreviewDevice;
  onChange: (value: PreviewDevice) => void;
}) {
  return (
    <SegmentedControl
      label="选择预览设备"
      options={deviceOptions}
      value={value}
      onValueChange={(device) => onChange(device === "mobile" ? "mobile" : "web")}
    />
  );
}

export function PreviewPrompt({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t pt-3 text-[length:var(--text-sm)] text-muted-foreground">
      <p className="m-0 min-w-0 break-words">{text}</p>
      <CopyButton className="shrink-0" label="复制描述" value={text} iconOnly />
    </div>
  );
}

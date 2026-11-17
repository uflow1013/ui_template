import type { Metadata } from "next";
import { AiStudio } from "./studio";

export const metadata: Metadata = {
  title: "AI 展示台 · 澄序",
  description: "在一段对话中体验 Arc 的 AI 组件和交互。",
};

export default function AiStudioPage() {
  return <AiStudio />;
}

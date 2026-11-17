import { ContextWindow } from "@/shared/arc/pro/context-window/context-window";
import { GenerationStats } from "@/shared/arc/pro/generation-stats/generation-stats";
import { LlmCostCalculator } from "@/shared/arc/pro/llm-cost-calculator/llm-cost-calculator";
import { MixtureOfExperts } from "@/shared/arc/pro/mixture-of-experts/mixture-of-experts";
import { ModelCard } from "@/shared/arc/pro/model-card/model-card";
import { ModelTraining } from "@/shared/arc/pro/model-training/model-training";
import { PromptCache } from "@/shared/arc/pro/prompt-cache/prompt-cache";
import { ProviderKeys } from "@/shared/arc/pro/provider-keys/provider-keys";
import { ProviderStatus } from "@/shared/arc/pro/provider-status/provider-status";
import { SpeculativeDecoding } from "@/shared/arc/pro/speculative-decoding/speculative-decoding";
import { TrainingRun } from "@/shared/arc/pro/training-run/training-run";
import { TypewriterTerminal } from "@/shared/arc/pro/typewriter-terminal/typewriter-terminal";
import { EvalSuite } from "../arc-blocks/eval-suite/eval-suite";
import { ModelArena } from "../arc-blocks/model-arena/model-arena";
import { PromptStudio } from "../arc-blocks/prompt-studio/prompt-studio";

export const artifacts = {
  "model-arena": () => <ModelArena autoStart={false} />,
  "model-card": () => <ModelCard />,
  "prompt-studio": () => <PromptStudio />,
  "eval-suite": () => <EvalSuite />,
  "context-window": () => <ContextWindow />,
  "generation-stats": () => <GenerationStats />,
  "llm-cost-calculator": () => <LlmCostCalculator title="示例月度成本" description="使用本地示例价格，调整用量查看变化。" />,
  "prompt-cache": () => <PromptCache />,
  "speculative-decoding": () => <SpeculativeDecoding />,
  "mixture-of-experts": () => <MixtureOfExperts />,
  "model-training": () => <ModelTraining />,
  "training-run": () => <TrainingRun />,
  "provider-status": () => <ProviderStatus />,
  "provider-keys": () => <ProviderKeys description="示例界面，仅供体验，请使用虚构的凭据。" />,
  "typewriter-terminal": () => <TypewriterTerminal loop={false} title="示例任务日志" />,
};

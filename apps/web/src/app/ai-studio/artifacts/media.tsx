import { Button } from "@/shared/arc/button/button";
import { AiMascot } from "@/shared/arc/pro/ai-mascot/ai-mascot";
import { CubeMascot } from "@/shared/arc/pro/cube-mascot/cube-mascot";
import { DictationButton } from "@/shared/arc/pro/dictation-button/dictation-button";
import { GhostMascot } from "@/shared/arc/pro/ghost-mascot/ghost-mascot";
import { ImageGeneration } from "@/shared/arc/pro/image-generation/image-generation";
import { PixelMascot } from "@/shared/arc/pro/pixel-mascot/pixel-mascot";
import { MorphBlock, SkeletonMorph } from "@/shared/arc/pro/skeleton-morph/skeleton-morph";
import { SpeechPlayer } from "@/shared/arc/pro/speech-player/speech-player";
import { VoiceOrb, type VoiceOrbState } from "@/shared/arc/pro/voice-orb/voice-orb";
import { VoiceRecorder } from "@/shared/arc/pro/voice-recorder/voice-recorder";
import { useEffect, useState } from "react";
import styles from "../studio.module.css";

const voiceStates: { value: VoiceOrbState; label: string }[] = [
  { value: "idle", label: "就绪" },
  { value: "listening", label: "聆听" },
  { value: "thinking", label: "处理中" },
  { value: "speaking", label: "说话" },
];

function VoicePreview() {
  const [state, setState] = useState<VoiceOrbState>("idle");

  return <div className={styles.optionDemo}>
    <VoiceOrb state={state} size={172} label={voiceStates.find(({ value }) => value === state)?.label} />
    <div className={styles.controls} aria-label="语音状态">
      {voiceStates.map(({ value, label }) => <Button key={value} size="sm" variant="secondary" aria-pressed={value === state} onClick={() => setState(value)}>{label}</Button>)}
    </div>
  </div>;
}

function MascotPreview() {
  const [thinking, setThinking] = useState(false);
  return <div className={styles.optionDemo}>
    <div className={styles.mascots}>
      <figure><AiMascot size={64} status={thinking ? "thinking" : "idle"} /><figcaption>助手</figcaption></figure>
      <figure><CubeMascot size={64} status={thinking ? "thinking" : "idle"} /><figcaption>立方体</figcaption></figure>
      <figure><GhostMascot size={64} status={thinking ? "thinking" : "idle"} /><figcaption>幽灵</figcaption></figure>
      <figure><PixelMascot size={3} status={thinking ? "thinking" : "idle"} /><figcaption>像素</figcaption></figure>
    </div>
    <Button size="sm" variant="secondary" aria-pressed={thinking} onClick={() => setThinking((value) => !value)}>
      {thinking ? "回到就绪" : "开始思考"}
    </Button>
  </div>;
}

function SkeletonPreview() {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoading(false), 1100);
    return () => window.clearTimeout(timer);
  }, [loading]);

  return <div className={styles.optionDemo}>
    <SkeletonMorph loading={loading} loadingLabel="生成摘要中">
      <MorphBlock width="44%" height={16}><strong>发布计划摘要</strong></MorphBlock>
      <MorphBlock lines={2}><p>设计稿和定价说明已准备完毕。发布前还需要确认支付测试和支持排班。</p></MorphBlock>
    </SkeletonMorph>
    <Button size="sm" variant="secondary" disabled={loading} onClick={() => setLoading(true)}>重新生成</Button>
  </div>;
}

export const artifacts = {
  "voice-orb": VoicePreview,
  "voice-recorder": () => <VoiceRecorder label="示例语音消息" />,
  "dictation-button": () => <DictationButton />,
  "speech-player": () => <SpeechPlayer autoPlay={false} />,
  "image-generation": () => <ImageGeneration />,
  "ai-mascot": MascotPreview,
  "skeleton-morph": SkeletonPreview,
};

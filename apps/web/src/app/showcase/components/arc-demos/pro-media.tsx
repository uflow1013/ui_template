"use client";

import { useState } from "react";
import { Aperture, CalendarDays, Compass, Database, Diamond, Layers3, Mountain, Notebook, Waves } from "lucide-react";
import { Button } from "@/shared/arc/button/button";
import { BlackHole } from "@/shared/arc/pro/black-hole/black-hole";
import { CoverFlow } from "@/shared/arc/pro/cover-flow/cover-flow";
import { DotGrid } from "@/shared/arc/pro/dot-grid/dot-grid";
import { GlassCard } from "@/shared/arc/pro/glass-card/glass-card";
import { GravityWell } from "@/shared/arc/pro/gravity-well/gravity-well";
import { HoloCard } from "@/shared/arc/pro/holo-card/holo-card";
import { ImageReveal } from "@/shared/arc/pro/image-reveal/image-reveal";
import { ImageTrail } from "@/shared/arc/pro/image-trail/image-trail";
import { InkFluid } from "@/shared/arc/pro/ink-fluid/ink-fluid";
import { mediaUrl } from "@/shared/arc/pro/lib/media";
import { NowPlaying } from "@/shared/arc/pro/now-playing/now-playing";
import { OrbitLogos } from "@/shared/arc/pro/orbit-logos/orbit-logos";
import { PageCurl } from "@/shared/arc/pro/page-curl/page-curl";
import { PhotoGrid } from "@/shared/arc/pro/photo-grid/photo-grid";
import { ProductGallery } from "@/shared/arc/pro/product-gallery/product-gallery";
import { SandText } from "@/shared/arc/pro/sand-text/sand-text";
import { StickerPeel } from "@/shared/arc/pro/sticker-peel/sticker-peel";
import { TicketTear } from "@/shared/arc/pro/ticket-tear/ticket-tear";
import { DemoResult } from "./fixtures";

const media = (name: string) => mediaUrl(`/media/photos/${name}.jpg`);
const landscapes = [
  { id: "alpine-lake", title: "高山湖", alt: "水面倒映阿尔卑斯山峰", width: 1067, height: 1600 },
  { id: "mountain-ridges", title: "山脊", alt: "层叠山脊笼罩于雾中", width: 1600, height: 1068 },
  { id: "coastline", title: "海岸", alt: "斜坡下的海岸与白色浪花", width: 1200, height: 1600 },
  { id: "sea-at-dusk", title: "暮海", alt: "暮色中的静海和远处小岛", width: 1067, height: 1600 },
].map((photo) => ({ ...photo, src: media(photo.id) }));

export function BlackHoleDemo() {
  const [mode, setMode] = useState<"quiet" | "focus">("quiet");
  return (
    <BlackHole className="grid min-h-60 w-full place-items-center overflow-hidden rounded-[var(--radius-panel)]">
      <div className="z-10 grid justify-items-center gap-3 p-6">
        <p className="text-white">{mode === "quiet" ? "黑洞视图" : "已进入专注模式"}</p>
        <Button size="sm" variant="secondary" onClick={() => setMode(mode === "quiet" ? "focus" : "quiet")}>
          {mode === "quiet" ? "进入专注" : "退出专注"}
        </Button>
      </div>
    </BlackHole>
  );
}

export function CoverFlowDemo() {
  return <CoverFlow
    className="w-full"
    label="风景摄影集"
    items={landscapes.map(({ id, title, src, alt }) => ({ id, title, image: src, subtitle: alt, alt }))}
    defaultIndex={1}
  />;
}

export function DotGridDemo() {
  return (
    <DotGrid gap={16} radius={90} ripple className="grid min-h-48 w-full place-items-center overflow-hidden rounded-[var(--radius-panel)] border border-border">
      <span className="pointer-events-none rounded-md bg-surface p-2 text-sm text-muted-foreground">移动光标或点按圆点</span>
    </DotGrid>
  );
}

export function GlassCardDemo() {
  return <GlassCard
    image={landscapes[0].src}
    imageAlt={landscapes[0].alt}
    title="周末远足"
    subtitle="高山湖 · 6 公里"
    aside={<Mountain aria-hidden size={18} />}
  >
    <p>点开查看线路。由林间步道出发，经湖畔观景台返回起点。</p>
  </GlassCard>;
}

export function GravityWellDemo() {
  return (
    <GravityWell columns={4} label="移动或点按模拟引力波">
      {["光", "轨", "引", "径", "场", "尘", "环", "流", "云", "影", "旋", "静"].map((text) => (
        <div key={text} className="grid aspect-square place-items-center rounded-md border border-border bg-surface text-muted-foreground">{text}</div>
      ))}
    </GravityWell>
  );
}

export function HoloCardDemo() {
  const face = "grid h-40 place-content-center justify-items-center gap-2 px-5 text-center";
  return <HoloCard
    label="翻转参展人证件"
    front={<div className={face}><Diamond aria-hidden size={28} /><span className="font-medium">设计展通行证</span></div>}
    back={<div className={face}><span>馆区 A · 02</span><span className="text-sm">特邀观众</span></div>}
  />;
}

export function ImageRevealDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className="grid w-full gap-3">
      <ImageReveal src={landscapes[1].src} alt={landscapes[1].alt} autoPlay loop={false} aspectRatio={1.7} runKey={run} />
      <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setRun((value) => value + 1)}>重播图像揭示</Button>
    </div>
  );
}

export function ImageTrailDemo() {
  return (
    <ImageTrail images={landscapes} size={100} className="grid min-h-52 w-full place-items-center overflow-hidden rounded-[var(--radius-panel)] border border-border">
      <p className="pointer-events-none text-sm text-muted-foreground">在画面上划动以展开图像轨迹</p>
    </ImageTrail>
  );
}

export function InkFluidDemo() {
  return (
    <InkFluid ambient={false} quality="low" className="grid min-h-52 w-full place-items-center overflow-hidden rounded-[var(--radius-panel)] border border-border">
      <p className="pointer-events-none text-sm">在画面上移动，观察墨迹流动</p>
    </InkFluid>
  );
}

export function NowPlayingDemo() {
  return <NowPlaying label="环境音乐示例" tracks={[
    { id: "lake", title: "湖畔晨光", artist: "澄序示例", duration: 145, artwork: landscapes[0].src, artworkAlt: landscapes[0].alt },
    { id: "sea", title: "海面的晚霞", artist: "澄序示例", duration: 208, artwork: landscapes[3].src, artworkAlt: landscapes[3].alt },
  ]} />;
}

export function OrbitLogosDemo() {
  const [selected, setSelected] = useState("");
  return (
    <div className="grid w-full gap-3">
      <OrbitLogos
        label="工作区连接图"
        center={<Compass aria-hidden />}
        onSelect={(item) => setSelected(item?.name ?? "")}
        logos={[
          { id: "calendar", name: "日历", icon: <CalendarDays size={18} />, category: "排期" },
          { id: "photos", name: "图库", icon: <Aperture size={18} />, category: "素材" },
          { id: "data", name: "数据库", icon: <Database size={18} />, category: "记录" },
          { id: "notes", name: "笔记", icon: <Notebook size={18} />, category: "写作" },
          { id: "design", name: "设计资源", icon: <Layers3 size={18} />, category: "素材" },
        ]}
      />
      <DemoResult>{selected ? `已选择 ${selected}` : "选择轨道上的应用查看分类"}</DemoResult>
    </div>
  );
}

const itinerary = [
  ["周末野外笔记", "带上地图，沿湖走到山脚。"],
  ["森林步道", "向东穿过松树林，留意第二处岔口。"],
  ["湖边停留", "顺着木栈道抵达水边，补充饮水。"],
  ["回到起点", "从缓坡折返，留出日落前的时间。"],
];

export function PageCurlDemo() {
  return <PageCurl
    className="w-full"
    label="旅行小册"
    hint="拖动卷角翻页"
    pages={itinerary.map(([title, text]) => (
      <div className="grid size-full content-center gap-3 bg-surface p-4" key={title}>
        <Compass size={22} aria-hidden />
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    ))}
  />;
}

export function PhotoGridDemo() {
  return <PhotoGrid className="w-full" photos={landscapes} title="旅行相册" defaultColumns={2} />;
}

export function ProductGalleryDemo() {
  return <ProductGallery
    label="陶器系列"
    className="w-full"
    aspectRatio={1.55}
    header={<p className="font-medium">手作陶器系列</p>}
    colors={[
      { value: "sand", label: "砂色", swatch: "#d4c4af", images: [{ src: media("stoneware-cups"), alt: "浅砂色手作杯" }] },
      { value: "clay", label: "陶棕", swatch: "#8e715e", images: [{ src: media("stacked-bowls"), alt: "陶棕色手作碗" }] },
    ]}
    sizes={[{ value: "single", label: "单件" }, { value: "set", label: "套装", soldOut: ["clay"] }]}
  />;
}

export function SandTextDemo() {
  const [word, setWord] = useState("澄序");
  return (
    <div className="grid w-full gap-3">
      <SandText text={word} as="p" className="w-full text-center text-5xl" />
      <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setWord(word === "澄序" ? "留白" : "澄序")}>切换文字</Button>
    </div>
  );
}

export function StickerPeelDemo() {
  return <StickerPeel
    label="可拖动的旅行贴纸"
    className="min-h-48 w-full"
    stickers={[
      { id: "mountain", label: "山峰贴纸", x: 0.26, y: 0.44, rotate: -10, shape: "circle", content: <Mountain aria-hidden size={34} /> },
      { id: "sea", label: "海浪贴纸", x: 0.58, y: 0.58, rotate: 13, shape: "circle", content: <Waves aria-hidden size={34} /> },
      { id: "walk", label: "徒步贴纸", x: 0.77, y: 0.33, rotate: -5, shape: "pill", content: <span className="px-2 py-1">徒步</span> },
    ]}
  />;
}

export function TicketTearDemo() {
  const [torn, setTorn] = useState(false);
  return (
    <div className="grid w-full gap-3">
      <TicketTear stubWidth={82} torn={torn} onTornChange={setTorn} label="撕下票根" stub={<span className="p-3 text-sm">票根 24</span>}>
        <div className="grid content-center gap-2 p-4"><p className="font-medium">春山设计展</p><p className="text-sm text-muted-foreground">展览中心 · A 馆</p></div>
      </TicketTear>
      {torn && <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setTorn(false)}>恢复票根</Button>}
    </div>
  );
}

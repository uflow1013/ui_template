"use client";

import { useState } from "react";
import { Button } from "@/shared/arc/button/button";
import { InstallSnippet } from "@/shared/arc/pro/install-snippet/install-snippet";
import { Kbd } from "@/shared/arc/pro/kbd/kbd";
import { KeycapKeyboard } from "@/shared/arc/pro/keycap-keyboard/keycap-keyboard";
import { mediaUrl } from "@/shared/arc/pro/lib/media";
import { LinkUnfurl } from "@/shared/arc/pro/link-unfurl/link-unfurl";
import { PresenceStack } from "@/shared/arc/pro/presence-stack/presence-stack";
import { ReferralCard } from "@/shared/arc/pro/referral-card/referral-card";
import { WalletStack } from "@/shared/arc/pro/wallet-stack/wallet-stack";
import { DemoResult } from "./fixtures";

const avatar = (id: string) => mediaUrl(`/media/people/${id}.svg`);

export function InstallSnippetDemo() {
  return <InstallSnippet title="接入示例 SDK" description="切换框架和包管理器，获取对应的安装命令。" />;
}

export function KbdDemo() {
  const [saved, setSaved] = useState(0);
  return (
    <div className="grid w-full gap-3">
      <Button size="sm" variant="secondary" className="justify-self-start" onClick={() => setSaved((count) => count + 1)}>
        保存示例 <Kbd keys="alt+shift+y" listen onTrigger={() => setSaved((count) => count + 1)} />
      </Button>
      <DemoResult>{saved ? `已触发保存 ${saved} 次` : "试试按钮旁的快捷键"}</DemoResult>
    </div>
  );
}

export function KeycapKeyboardDemo() {
  return <KeycapKeyboard label="在键盘中输入示例文本" placeholder="按下实体键盘或点按键帽" showOutput defaultValue="Chengxu" maxLength={32} />;
}

export function LinkUnfurlDemo() {
  return <LinkUnfurl
    label="发一条带链接的消息"
    placeholder="粘贴链接，或选下方任一示例"
    sendLabel="发送示例"
    autoPlay={false}
    samples={[
      {
        url: "https://www.airbnb.com/rooms/48213907",
        site: "Airbnb",
        title: "里斯本屋顶旅居",
        description: "俯瞰河景的露台，步行可到电车站。",
        image: mediaUrl("/media/photos/lisbon-rooftops.jpg"),
        imageAlt: "里斯本屋顶",
      },
      {
        url: "https://unsplash.com/photos/Vw3a0HgE7AM",
        site: "Unsplash",
        title: "高山湖摄影",
        description: "照片 · Alessio Furlan",
        image: mediaUrl("/media/photos/alpine-lake.jpg"),
        imageAlt: "高山湖及倒影",
      },
    ]}
  />;
}

export function PresenceStackDemo() {
  const [reviewing, setReviewing] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="grid w-full justify-items-start gap-3">
      <PresenceStack
        align="start"
        heading="工作区成员"
        selfId="you"
        label="在线协作者"
        max={3}
        people={[
          { id: "you", name: "陈小雨", detail: "正在浏览组件", status: "active" },
          { id: "emma", name: "Emma Collins", src: avatar("emma-collins"), detail: "正在改设计稿", status: "typing" },
          { id: "marcus", name: "Marcus Johnson", src: avatar("marcus-johnson"), detail: "正在审阅", status: "idle" },
          ...(reviewing ? [{ id: "jasmine", name: "Jasmine Brooks", src: avatar("jasmine-brooks"), detail: "刚刚加入" }] : []),
        ]}
        onPersonSelect={(person) => setName(person.name)}
      />
      <Button size="sm" variant="secondary" onClick={() => setReviewing(!reviewing)}>
        {reviewing ? "模拟成员离开" : "模拟成员加入"}
      </Button>
      <DemoResult>{name && `已选中 ${name}`}</DemoResult>
    </div>
  );
}

export function ReferralCardDemo() {
  return <ReferralCard
    title="邀请朋友试用"
    description="复制邀请链接，或用示例邮箱体验邀请流程。"
    reward={25}
    currency="CNY"
    link="https://example.com/invite/chengxu"
    simulate
  />;
}

export function WalletStackDemo() {
  return <WalletStack label="示例钱包" currency="CNY" locale="zh-CN" cards={[
    {
      id: "personal", issuer: "澄序钱包", product: "日常消费", lastFour: "1084",
      holder: "CHENGXU DEMO", variant: "color", balance: 2309.5, balanceLabel: "可用余额",
      transactions: [
        { id: "coffee", merchant: "春山咖啡", detail: "餐饮 · 今天", amount: -28 },
        { id: "book", merchant: "观澜书局", detail: "书籍 · 昨天", amount: -75 },
      ],
    },
    {
      id: "travel", issuer: "澄序钱包", product: "旅行储蓄", lastFour: "9072",
      holder: "CHENGXU DEMO", variant: "metal", balance: 5121, balanceLabel: "旅行余额",
      transactions: [
        { id: "first", merchant: "工资转入", detail: "转账 · 11 月 10 日", amount: 2500 },
        { id: "ticket", merchant: "高铁车票", detail: "交通 · 11 月 12 日", amount: -390 },
      ],
    },
  ]} />;
}

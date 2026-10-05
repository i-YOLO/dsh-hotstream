// AIHOT cc66cceb1dc7a0bc147e942e49ff94c9cee418c6 — MIT; native adapters are recorded in SOURCE_MAP.
// Site navigation in one place: the desktop sidebar's sections and the phone tab bar's tabs.
import type { ReactNode } from "react";
import { subjectAfter, withSubject } from "../../industry/site.ts";
import { FEATURES } from "../../industry/features.ts";
import {
  IconBolt, IconBookmark, IconChart, IconDoc, IconFlame, IconGrid, IconHeart, IconHistory, IconList, IconMessage, IconPlug, IconUser,
} from "../icons.tsx";

export interface NavItem {
  to: string;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
  /** Match the path exactly (the home page). */
  end?: boolean;
  /** Shows the unread dot while the changelog has news. */
  changelog?: boolean;
}

export const SIDEBAR: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "内容",
    items: [
      { to: "/", label: "精选", icon: IconBolt, end: true },
      { to: "/all", label: subjectAfter("全部", "动态"), icon: IconList },
      { to: "/hot", label: "热点榜", icon: IconFlame },
      { to: "/daily", label: withSubject("日报"), icon: IconDoc },
      { to: "/topics", label: "主题", icon: IconGrid },
      { to: "/starred", label: "收藏", icon: IconBookmark },
    ],
  },
  // The optional AI-only modules (industry/features.ts).
  ...(FEATURES.leaderboard || FEATURES.codexResetMonitor
    ? [
        {
          title: "模型",
          items: [
            ...(FEATURES.leaderboard ? [{ to: "/leaderboard", label: "模型榜", icon: IconChart }] : []),
            ...(FEATURES.codexResetMonitor ? [{ to: "/codex-reset", label: "Tibo重置监控", icon: IconHistory }] : []),
          ],
        },
      ]
    : []),
  {title:"管理",items:[{to:"/admin",label:"后台",icon:IconGrid},{to:"/admin/sources",label:"信源管理",icon:IconList},{to:"/settings",label:"设置",icon:IconPlug}]},
  {title:"更多",items:[{to:"/about",label:"关于",icon:IconHeart}]},
];

/** A sidebar entry is lit on its pages; 日报 also covers weekly and monthly reports. */
export function sidebarIsActive(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.to;
  if (item.to === "/daily") return /^\/(daily|weekly|monthly)(\/|$)/.test(pathname);
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/**
 * The phone tab bar: 全部 lives beside 精选 as a switch, 热点 and 模型榜 are tabs, and "我的" at /more
 * holds 收藏, 外观, the tools and the site's own pages. Without the leaderboard the bar has four tabs.
 * Which tab a page sits under is declared by the page itself (components/shell/screens.ts).
 */
export type TabKey = "featured" | "hot" | "daily" | "leaderboard" | "me";

export interface Tab {
  key: TabKey;
  to: string;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
  changelog?: boolean;
}

export const TABS: Tab[] = [
  { key: "featured", to: "/", label: "精选", icon: IconBolt },
  { key: "hot", to: "/hot", label: "热点", icon: IconFlame },
  { key: "daily", to: "/daily", label: "日报", icon: IconDoc },
  ...(FEATURES.leaderboard ? [{ key: "leaderboard" as const, to: "/leaderboard", label: "模型榜", icon: IconChart }] : []),
  { key: "me", to: "/settings", label: "我的", icon: IconUser, changelog: true },
];

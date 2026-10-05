// AIHOT cc66cceb1dc7a0bc147e942e49ff94c9cee418c6 — MIT; native adapters are recorded in SOURCE_MAP.
import { useLocation } from "../../native/navigation.tsx";
import { LEADERBOARD_BOARD_LABELS, LEADERBOARD_PUBLIC_BOARDS } from "../../contracts/taxonomy.ts";
import { PillTabs } from "../../components/ui/Tabs.tsx";
import { boardHref } from "./format.ts";

/** Board switcher. It lives in the shared layout, so the thumb glides between boards. */
export function BoardTabs() {
  const { pathname } = useLocation();
  const active = LEADERBOARD_PUBLIC_BOARDS.find((k) => boardHref(k) === pathname) ?? "overall";
  return (
    <PillTabs
      layoutId="lb-board"
      label="榜单"
      active={active}
      items={LEADERBOARD_PUBLIC_BOARDS.map((k) => ({ key: k, label: LEADERBOARD_BOARD_LABELS[k], to: boardHref(k) }))}
    />
  );
}

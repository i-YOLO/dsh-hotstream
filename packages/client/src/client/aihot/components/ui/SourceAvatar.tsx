import {assetUrl} from '../../native/assets.ts';
// AIHOT cc66cceb1dc7a0bc147e942e49ff94c9cee418c6 — MIT; native adapters are recorded in SOURCE_MAP.
import { useState } from "react";
import { sourceInitial } from "../../lib/format.ts";

/** Round avatar for X accounts (or a source icon); a tinted initial when there is no image. */
export function SourceAvatar({ name, iconUrl, avatarUrl, iconSrcSet, avatarSrcSet, size = 18 }: { name: string; iconUrl?: string | null | undefined; avatarUrl?: string | null | undefined; iconSrcSet?: string | undefined; avatarSrcSet?: string | undefined; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = assetUrl(avatarUrl ?? iconUrl);
  if (src && !failed) {
    return (
      <img
        src={src}
        srcSet={avatarUrl ? avatarSrcSet : iconSrcSet}
        sizes={`${size}px`}
        decoding="async"
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full bg-bg-sunk object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.5)), background: `oklch(0.6 0.07 ${h})` }}
    >
      {sourceInitial(name)}
    </span>
  );
}

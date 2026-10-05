export interface SdUser {
  name: string;
  screen_name: string;
  profile_image_url_https?: string;
}

export interface SdMedia {
  type: "photo" | "video" | "animated_gif";
  media_url_https: string;
  original_info?: { width?: number; height?: number };
}

export interface SdTweet {
  id_str: string;
  tweet_created_at: string;
  full_text?: string;
  text?: string;
  lang?: string;
  user: SdUser;
  in_reply_to_status_id_str?: string | null;
  in_reply_to_screen_name?: string | null;
  quoted_status?: SdTweet | null;
  retweeted_status?: SdTweet | null;
  is_quote_status?: boolean;
  entities?: { urls?: Array<{ url: string; expanded_url: string }>; media?: SdMedia[] };
  extended_entities?: { media?: SdMedia[] };
  favorite_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  views_count?: number;
}

export interface SearchResult {
  tweets: SdTweet[];
  nextCursor: string | null;
  receiptId: string;
  reused: boolean;
}


export function tweetText(t: SdTweet): string {
  let text = t.full_text ?? t.text ?? "";
  // Expand t.co links and drop trailing media links.
  for (const u of t.entities?.urls ?? []) text = text.replaceAll(u.url, u.expanded_url);
  for (const m of t.extended_entities?.media ?? t.entities?.media ?? []) text = text.replace(/\s*https:\/\/t\.co\/\w+\s*$/, "");
  return text.trim();
}

export function tweetMedia(t: SdTweet) {
  return (t.extended_entities?.media ?? t.entities?.media ?? []).map((m) => ({
    kind: m.type === "photo" ? ("image" as const) : ("video" as const),
    url: m.media_url_https,
    width: m.original_info?.width ?? null,
    height: m.original_info?.height ?? null,
    poster: m.type === "photo" ? null : m.media_url_https,
  }));
}

/** An X Article: its title and body as DraftJS blocks (header-two, blockquote, list items, atomic media…). */
export interface SdArticle {
  title?: string;
  content_state?: { blocks?: Array<{ type?: string; text?: string }> };
}

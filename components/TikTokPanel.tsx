import { Music2 } from 'lucide-react';

/**
 * There's no free official API for TikTok keyword search view/like counts
 * — TikTok's Research API needs institutional/academic approval, and the
 * alternative is either a paid third-party wrapper or an unofficial
 * scrape. This app already got burned once by scraping (DuckDuckGo's
 * anti-bot page being silently parsed as real results), so rather than
 * repeat that, this is an honest set of manual-check links instead of
 * fabricated numbers.
 */
export default function TikTokPanel({ niche }: { niche: string }) {
  const searchLink = `https://www.tiktok.com/search?q=${encodeURIComponent(niche)}`;
  const creativeCenterLink = `https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en?period=180&keyword=${encodeURIComponent(
    niche
  )}`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 mb-6">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">TikTok signal — manual check</p>
      <p className="text-xs text-slate-500 mb-3">
        No free API exposes TikTok view/like counts by keyword, so this isn&rsquo;t live data — these links
        open TikTok directly so you can eyeball engagement on related content yourself.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={searchLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
        >
          <Music2 className="h-3.5 w-3.5" />
          Search &ldquo;{niche}&rdquo; on TikTok
        </a>
        <a
          href={creativeCenterLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
        >
          <Music2 className="h-3.5 w-3.5" />
          TikTok Creative Center trends
        </a>
      </div>
    </div>
  );
}

import type { TrendPoint, TrendSignal } from './types';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Google Trends has no official public API. This reverse-engineered
// explore -> widgetdata flow is the same one long-standing libraries like
// pytrends use. It's free and needs no signup, but it's unofficial and can
// break or get rate-limited — every call here is best-effort and degrades
// to `null` rather than surfacing an error to the user.
const JSON_PREFIX = ")]}',";

type ExploreWidget = {
  id?: string;
  token?: string;
  request?: unknown;
};

function stripJsonPrefix(text: string): string {
  return text.startsWith(JSON_PREFIX) ? text.slice(JSON_PREFIX.length) : text;
}

function classifyTrend(points: TrendPoint[]): TrendSignal['status'] {
  if (points.length < 4) return 'steady';

  const windowSize = Math.max(1, Math.floor(points.length / 4));
  const early = points.slice(0, windowSize);
  const recent = points.slice(-windowSize);

  const avg = (arr: TrendPoint[]) => arr.reduce((sum, p) => sum + p.value, 0) / arr.length;
  const earlyAvg = avg(early);
  const recentAvg = avg(recent);

  if (earlyAvg === 0 && recentAvg === 0) return 'steady';
  if (recentAvg > earlyAvg * 1.15) return 'rising';
  if (recentAvg < earlyAvg * 0.85) return 'falling';
  return 'steady';
}

export async function fetchTrendSignal(niche: string): Promise<TrendSignal | null> {
  const headers = {
    'User-Agent': BROWSER_UA,
    Accept: 'application/json, text/plain, */*',
  };

  try {
    const exploreReq = JSON.stringify({
      comparisonItem: [{ keyword: niche, geo: '', time: 'today 12-m' }],
      category: 0,
      property: '',
    });

    const exploreRes = await fetch(
      `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(exploreReq)}`,
      { headers, signal: AbortSignal.timeout(7000) }
    );
    if (!exploreRes.ok) return null;

    const exploreJson = JSON.parse(stripJsonPrefix(await exploreRes.text()));
    const widgets: ExploreWidget[] = exploreJson.widgets || [];
    const timeseriesWidget = widgets.find((w) => w.id === 'TIMESERIES');
    if (!timeseriesWidget?.token || !timeseriesWidget.request) return null;

    const widgetRes = await fetch(
      `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=0&req=${encodeURIComponent(
        JSON.stringify(timeseriesWidget.request)
      )}&token=${encodeURIComponent(timeseriesWidget.token)}`,
      { headers, signal: AbortSignal.timeout(7000) }
    );
    if (!widgetRes.ok) return null;

    const widgetJson = JSON.parse(stripJsonPrefix(await widgetRes.text()));
    type TimelineEntry = { time?: string; value?: number[] };
    const timeline: TimelineEntry[] = widgetJson.default?.timelineData || [];
    if (timeline.length === 0) return null;

    const points: TrendPoint[] = timeline
      .filter((t) => t.time && Array.isArray(t.value))
      .map((t) => ({
        date: new Date(Number(t.time) * 1000).toISOString(),
        value: t.value![0] ?? 0,
      }));

    if (points.length === 0) return null;

    return { status: classifyTrend(points), points };
  } catch {
    return null;
  }
}

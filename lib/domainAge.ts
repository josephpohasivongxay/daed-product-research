import type { DomainAge } from './types';

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

function monthsSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / MS_PER_MONTH));
}

/**
 * RDAP is the IETF-standardized, structured-JSON replacement for WHOIS.
 * rdap.org runs a free bootstrap redirector that 302s to the domain's
 * authoritative registry RDAP server — fetch() follows that automatically.
 */
async function fetchViaRdap(domain: string): Promise<DomainAge | null> {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    type RdapEvent = { eventAction?: string; eventDate?: string };
    const events: RdapEvent[] = Array.isArray(data.events) ? data.events : [];
    const registration = events.find((e) => e.eventAction === 'registration');
    if (!registration?.eventDate) return null;

    const firstSeenDate = new Date(registration.eventDate).toISOString();
    return { firstSeenDate, months: monthsSince(firstSeenDate), source: 'rdap' };
  } catch {
    return null;
  }
}

/**
 * Fallback when RDAP doesn't cover a TLD or a registrar's privacy proxy
 * hides the registration date: the Wayback Machine's first successful
 * capture is a free lower-bound proxy for "how long has this existed."
 */
async function fetchViaWayback(domain: string): Promise<DomainAge | null> {
  try {
    const res = await fetch(
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&limit=1&filter=statuscode:200&fl=timestamp`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    const rows: string[][] = await res.json();
    const timestamp = rows[1]?.[0];
    if (!timestamp || timestamp.length < 8) return null;

    const iso = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T00:00:00Z`;
    return { firstSeenDate: iso, months: monthsSince(iso), source: 'wayback' };
  } catch {
    return null;
  }
}

export async function fetchDomainAge(domain: string): Promise<DomainAge | null> {
  const rdap = await fetchViaRdap(domain);
  if (rdap) return rdap;
  return fetchViaWayback(domain);
}

// Fetch real DNA sequences from the public Ensembl REST API (CORS-enabled,
// no key, free). Browser-only; the pure analysis in dna.ts needs no network.
//
// Two entry points:
//   - by stable Ensembl ID (ENSG…/ENST…) → coding sequence (CDS)
//   - by species + gene symbol (e.g. "human", "TP53") → looked up, then CDS
//
// All requests go directly browser → rest.ensembl.org; nothing is proxied.

const BASE = "https://rest.ensembl.org";

export interface FetchedSequence {
  id: string;
  sequence: string;
  source: string; // human-readable provenance for the UI
}

async function getJSON(path: string): Promise<unknown> {
  // `Accept` (not `Content-Type`) requests JSON without tripping a CORS
  // preflight on a cross-origin GET. A timeout guarantees the promise settles
  // so the caller's UI never gets stuck "loading".
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`Ensembl ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    }
    return await res.json();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Ensembl request timed out");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch the coding sequence (CDS) for a stable Ensembl ID. */
export async function fetchById(id: string): Promise<FetchedSequence> {
  const data = (await getJSON(
    `/sequence/id/${encodeURIComponent(id)}?type=cds`,
  )) as { seq?: string; id?: string };
  if (!data.seq) throw new Error("No sequence returned");
  return { id: data.id ?? id, sequence: data.seq, source: `Ensembl CDS · ${id}` };
}

interface LookupTranscript {
  id: string;
  is_canonical?: number;
  biotype?: string;
}

/**
 * Look up a gene by species + symbol, then fetch the CDS of its *canonical*
 * transcript. (Fetching a gene-level CDS fails on Ensembl — a gene has many
 * transcripts, e.g. TP53 has ~37 CDS — so we disambiguate to one transcript.)
 */
export async function fetchBySymbol(
  species: string,
  symbol: string,
): Promise<FetchedSequence> {
  const lookup = (await getJSON(
    `/lookup/symbol/${encodeURIComponent(species)}/${encodeURIComponent(symbol)}?expand=1`,
  )) as { id?: string; Transcript?: LookupTranscript[] };
  if (!lookup.id) throw new Error(`Gene "${symbol}" not found in ${species}`);

  const transcripts = lookup.Transcript ?? [];
  const chosen =
    transcripts.find((t) => t.is_canonical === 1) ??
    transcripts.find((t) => t.biotype === "protein_coding") ??
    transcripts[0];
  if (!chosen?.id) throw new Error(`No transcript found for "${symbol}" in ${species}`);

  const seq = await fetchById(chosen.id);
  return {
    ...seq,
    source: `Ensembl CDS · ${symbol} (${species}) · ${chosen.id}`,
  };
}

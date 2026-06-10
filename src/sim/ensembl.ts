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
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Ensembl ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  return res.json();
}

/** Fetch the coding sequence (CDS) for a stable Ensembl ID. */
export async function fetchById(id: string): Promise<FetchedSequence> {
  const data = (await getJSON(
    `/sequence/id/${encodeURIComponent(id)}?type=cds`,
  )) as { seq?: string; id?: string };
  if (!data.seq) throw new Error("No sequence returned");
  return { id: data.id ?? id, sequence: data.seq, source: `Ensembl CDS · ${id}` };
}

/** Look up a gene by species + symbol, then fetch its CDS. */
export async function fetchBySymbol(
  species: string,
  symbol: string,
): Promise<FetchedSequence> {
  const lookup = (await getJSON(
    `/lookup/symbol/${encodeURIComponent(species)}/${encodeURIComponent(symbol)}`,
  )) as { id?: string };
  if (!lookup.id) throw new Error(`Gene "${symbol}" not found in ${species}`);
  const seq = await fetchById(lookup.id);
  return { ...seq, source: `Ensembl CDS · ${symbol} (${species}) · ${lookup.id}` };
}

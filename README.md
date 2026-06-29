# Mutatiom

**Browser-native simulator and visualizer for quantum proton tunnelling in
DNA base pairs** — the Löwdin mechanism of spontaneous point mutations.

A Watson–Crick hydrogen bond holds an inter-strand proton in a *double-well*
potential along the donor→acceptor coordinate. There is a non-zero quantum
amplitude for that proton to **tunnel** to the second minimum, flipping the
base into its rare **tautomeric** form. If that happens during replication,
the polymerase mispairs it — a spontaneous point mutation. Mutatiom makes the
physics legible: solve the proton's Schrödinger equation, watch the wavepacket
tunnel between the canonical and tautomer wells, map mutation susceptibility
along a real gene, and compare the coherent and dissipative pictures.

Everything runs in the browser. No install, no account, no backend.

> **Scope:** an educational / reduced-model tool grounded in published quantum
> chemistry — not a from-first-principles mutation-rate predictor. See
> [docs/METHODS.md](docs/METHODS.md).

## Features

- **Proton double well** — interactive 1-D Schrödinger solver with live
  |Ψ(x,t)|² tunnelling animation; splitting, transfer time, WKB action, tautomer
  fraction; proton/deuteron toggle.
- **DNA strand** — paste a sequence, pick an example, or fetch a real human gene
  from Ensembl; a clickable per-base track of tautomer susceptibility *or*
  open-system relaxation time; selecting a base loads its base-pair double well.
- **Open-system relaxation (Lindblad)** — the proton coupled to a thermal bath
  decoheres and relaxes to the Gibbs tautomer population.
- **Kinetic isotope effect** — ¹H/²H/³H slowdown vs the classical limit.
- **2-D double proton transfer** — concerted vs stepwise mechanism on the
  two-proton potential surface.

## Stack

- Vite + React + TypeScript, client-only (the same philosophy as Quantiom).
- `src/sim/` — the physics core:
  - `eigen.ts` — symmetric-tridiagonal eigensolver (QL with implicit shifts).
  - `doubleWell.ts` — quartic double-well + finite-difference Schrödinger solver.
  - `doubleWell2d.ts` — 2-D coupled double-proton-transfer + imaginary-time ground state.
  - `tunneling.ts` — splitting Δ, WKB barrier action, transfer time, tautomer fraction.
  - `evolve.ts` — coherent wavepacket evolution of a well-localised proton.
  - `lindblad.ts` — open-system master equation (detailed-balance jump operators).
  - `spectralDensity.ts` — Ohmic / Drude–Lorentz bath (Caldeira–Leggett).
  - `isotopes.ts` — kinetic isotope effect across ¹H/²H/³H.
  - `dna.ts` — sequence → base-pair presets, susceptibility, relaxation, CpG sites.
  - `basePairData.ts` — literature-sourced A·T / G·C parameters + provenance.
  - `ensembl.ts` — fetch real coding sequences from the Ensembl REST API.
  - `constants.ts` — atomic units and display conversions.
- Panels: `App.tsx` (double well), `DnaPanel`, `LindbladPanel`, `IsotopePanel`,
  `DoubleWell2DPanel`.
- `server/` — minimal FastAPI static host (`/api/health`) for the Fly deployment.

## Deploy (Fly.io)
Single Fly app quantiom — the server hosts the built client.

fly apps create quantiom        # one-time
fly deploy

## Develop

```sh
npm install
npm run dev        # dev server
npm test           # Vitest — physics core vs analytic ground truth
npm run typecheck
npm run build
```

## Methods, validation & scope

See **[docs/METHODS.md](docs/METHODS.md)** for the full model description,
parameter provenance, a literature-validation table (machine-checked in
`test/validation.test.ts`), and an explicit limitations + scope statement.
Short version: Mutatiom is an **educational / reduced-model** tool grounded in
published quantum chemistry — not a from-first-principles mutation-rate
predictor. It reproduces the known G·C≫A·T mutational bias, ~10⁻⁷ tautomer
fractions, the tunnelling kinetic-isotope-effect signature, and sub-nanosecond
relaxation; it does **not** reproduce the published zero-point energy (the
single quartic over-constrains the well curvature — see Limitations).

## Data provenance

The A·T and G·C base-pair double wells are **derived from published
quantum-chemistry studies**, not hand-tuned. Both source studies model the
transfer as a 1-D asymmetric *quartic* double well — the same form Mutatiom
uses — so the mapping is direct (`src/sim/basePairData.ts`).

| Pair | Forward barrier | Asymmetry ΔE | Source |
|------|-----------------|--------------|--------|
| G·C  | 0.704 eV (E₀ = 0.049 eV) | 0.435 eV | Slocombe, Sacchi & Al-Khalili, *Commun. Phys.* **5**, 109 (2022) — [10.1038/s42005-022-00881-8](https://doi.org/10.1038/s42005-022-00881-8) |
| A·T  | 1.00 eV | 0.572 eV | Godbeer, Al-Khalili & Stevenson, *Phys. Chem. Chem. Phys.* **17**, 13034 (2015) — [10.1039/c5cp00472a](https://doi.org/10.1039/c5cp00472a) |

Mapping to the model `V(x) = V₀(x²/a²−1)² + (bias/2)(x/a)`: the minima sit at
x ≈ ∓a with V(∓a) ≈ ∓bias/2, so **bias = ΔE** and **V₀ = E_f − ΔE/2**. With
these values the G·C tautomer fraction at 310 K comes out ~10⁻⁷ (literature
range) and G·C is ~170× more tautomer-prone than A·T — the known mutational
bias, reproduced rather than imposed.

**One caveat:** neither paper states the length scale *a* (half the minima
separation) numerically. We use *a* = 0.30 Å (transfer distance 2a ≈ 0.6 Å),
the standard proton-transfer geometry of a Watson–Crick N–H···N / N–H···O
hydrogen bond. It sets the barrier *width*; it is the one parameter not pinned
by the two studies.

The generic editor double well (the "custom parameters" default, before a base
pair is selected) remains a freely tunable illustrative model — not a specific
base pair.

## Physics notes

- Atomic units throughout (ħ = mₑ = e = 1); length in Bohr, energy in Hartree.
- The finite-difference splitting is only meaningful while it sits above the
  numerical floor (θ ≲ a few). For a *realistic* DNA barrier the isolated
  coherent splitting is astronomically small — which is exactly why thermally
  assisted / open-quantum-system rates dominate the biology, captured by the
  Lindblad engine (`src/sim/lindblad.ts`).
- For a biased/deep well the two lowest eigenstates are not necessarily the
  canonical/tautomer pair (an intra-well vibrational state can sit lower), so
  the relaxation time identifies the canonical and tautomer states by their
  well localisation rather than assuming the {0,1} pair.
- **Bath model.** The Lindblad rates come from a named spectral density
  (`src/sim/spectralDensity.ts`): an Ohmic-with-cutoff or Drude–Lorentz bath
  parameterised by a reorganization energy λ and a cutoff frequency ω_c, in the
  Caldeira–Leggett framework the DNA literature uses (Slocombe et al. 2022;
  Godbeer et al. 2015 model the environment as an Ohmic harmonic bath). The
  *strength* (λ) is a phenomenological estimate — as it is in those works — not
  derived from first principles; it is user-adjustable. Detailed balance is
  built into the weights, so the steady state is the Gibbs state. At the default
  λ ≈ 0.3 eV the canonical↔tautomer interconversion is sub-nanosecond
  (G·C ~0.5 ps, A·T ~30 ps), consistent with the literature.

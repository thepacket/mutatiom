# Mutatiom

**Browser-native simulator and visualizer for quantum proton tunnelling in
DNA base pairs** — the Löwdin mechanism of spontaneous point mutations.

A Watson–Crick hydrogen bond holds an inter-strand proton in a *double-well*
potential along the donor→acceptor coordinate. There is a non-zero quantum
amplitude for that proton to **tunnel** to the second minimum, flipping the
base into its rare **tautomeric** form. If that happens during replication,
the polymerase mispairs it — a spontaneous point mutation. Mutatiom makes the
physics legible: solve the proton's Schrödinger equation, watch the wavepacket
tunnel between the canonical and tautomer wells, and read off the tunnelling
splitting, transfer time, barrier action, and thermal tautomer fraction.

Everything runs in the browser. No install, no account, no backend.

## Stack

- Vite + React + TypeScript, client-only (the same philosophy as Quantiom).
- `src/sim/` — the physics core:
  - `eigen.ts` — symmetric-tridiagonal eigensolver (QL with implicit shifts).
  - `doubleWell.ts` — quartic double-well model + finite-difference Schrödinger solver.
  - `tunneling.ts` — ground splitting Δ, WKB barrier action, transfer time, tautomer fraction.
  - `evolve.ts` — coherent wavepacket evolution of a well-localised proton.
  - `constants.ts` — atomic units and display conversions.
- `src/App.tsx` — interactive double-well visualizer (potential, eigenstates,
  live |Ψ(x,t)|², tunnelling readouts).

## Develop

```sh
npm install
npm run dev        # dev server
npm test           # Vitest — physics core vs analytic ground truth
npm run typecheck
npm run build
```

## Physics notes

- Atomic units throughout (ħ = mₑ = e = 1); length in Bohr, energy in Hartree.
- The finite-difference splitting is only meaningful while it sits above the
  numerical floor (θ ≲ a few). For a *realistic* DNA barrier the isolated
  coherent splitting is astronomically small — which is exactly why thermally
  assisted / open-quantum-system rates dominate the biology. A Lindblad
  open-system engine is the planned second simulator.

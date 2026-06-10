# Mutatiom — methods, validation, and scope

This document describes the physical models Mutatiom implements, where their
parameters come from, how its outputs compare to the published literature, and —
importantly — what it does *not* do. It is the reference a user should read
before treating any number from the tool as meaningful.

## 1. What Mutatiom is (and isn't)

Mutatiom is a **browser-native, reduced-model simulator and visualizer** for the
quantum mechanics of proton transfer in DNA base pairs (the Löwdin
point-mutation mechanism). It is an **educational / reduced-model exploration
tool**: it faithfully implements established *reduced* models (1-D and 2-D
double wells, open-quantum-system relaxation) and grounds their parameters in
published quantum chemistry.

It is **not** a from-first-principles predictor of mutation rates. It does not
generate ab-initio potential energy surfaces, it uses a single (or two-)
coordinate reduction of a multidimensional problem, and the bath coupling
strength is phenomenological. Quantitative predictions for a specific sequence
should come from dedicated quantum-chemistry/dynamics codes, not from Mutatiom.

## 2. Models

### 2.1 Single-proton double well (1-D)

`V(x) = V₀(x²/a² − 1)² + (bias/2)(x/a)` — an asymmetric quartic double well in
one effective proton coordinate. Solved by 3-point finite differences →
symmetric tridiagonal Hamiltonian → QL eigensolver (`sim/eigen.ts`,
`sim/doubleWell.ts`). Coherent dynamics by eigenstate superposition
(`sim/evolve.ts`).

### 2.2 Double proton transfer (2-D)

`V(x₁,x₂) = V₀[(u₁²−1)²+(u₂²−1)²] − g·u₁u₂ + (ΔE/4)(u₁+u₂)`, u_i = x_i/a — two
coupled proton coordinates. Ground state by imaginary-time relaxation; concerted
(diagonal) vs stepwise (via a charge-separated corner) pathway comparison
(`sim/doubleWell2d.ts`).

### 2.3 Open-system relaxation (Lindblad)

The proton couples to a thermal bath; the density matrix evolves under a Lindblad
master equation with detailed-balance jump operators built from a **named
spectral density** (Ohmic-with-cutoff or Drude–Lorentz, parameters λ and ω_c) in
the Caldeira–Leggett framework (`sim/spectralDensity.ts`, `sim/lindblad.ts`).
The steady state is the Gibbs state; the new observable is the *relaxation time*.

### 2.4 Kinetic isotope effect

Re-solving with ²H/³H masses; the WKB action θ ∝ √m makes heavier isotopes
tunnel exponentially slower (`sim/isotopes.ts`).

## 3. Parameter provenance

Base-pair barriers and asymmetries are taken from primary literature; both
sources model the transfer as a 1-D **quartic** double well — the same form
Mutatiom uses (`sim/basePairData.ts`).

| Pair | Forward barrier E_f | Asymmetry ΔE | Source |
|------|--------------------|--------------|--------|
| G·C  | 0.704 eV (E₀ = 0.049 eV) | 0.435 eV | Slocombe, Sacchi & Al-Khalili, *Commun. Phys.* **5**, 109 (2022), [10.1038/s42005-022-00881-8](https://doi.org/10.1038/s42005-022-00881-8) |
| A·T  | 1.00 eV | 0.572 eV | Godbeer, Al-Khalili & Stevenson, *PCCP* **17**, 13034 (2015), [10.1039/c5cp00472a](https://doi.org/10.1039/c5cp00472a) |

Mapping to the model: minima at x ≈ ∓a give **bias = ΔE** and **V₀ = E_f − ΔE/2**.

**Estimated parameters** (not from the two studies, stated as such):
- Well separation *a* = 0.30 Å (transfer distance 2a ≈ 0.6 Å) — standard
  Watson–Crick N–H···N/O proton-transfer geometry.
- Bath reorganization energy λ ≈ 0.3 eV and cutoff ω_c ≈ 0.1 eV — order-of-
  magnitude aqueous-environment estimates; the *strength* is phenomenological,
  exactly as in the cited works (a Caldeira–Leggett friction constant).

## 4. Validation

Machine-checked in `test/validation.test.ts`:

| Quantity | Mutatiom | Literature | Status |
|----------|----------|------------|--------|
| Forward barrier (G·C) | 0.704 eV | 0.704 eV | ✓ by construction |
| Canonical→tautomer gap (G·C) | 0.37 eV | ΔE = 0.435 eV | ✓ within ~15% |
| Tautomer fraction (G·C, 310 K) | 8.5×10⁻⁸ | ~10⁻⁷ | ✓ order of magnitude |
| Mutational bias G·C : A·T | ~170× | G·C ≫ A·T | ✓ qualitatively |
| KIE ²H | ~50× | ≫ classical √2 ≈ 1.4 | ✓ tunnelling signature |
| Relaxation time | 0.5–30 ps | sub-nanosecond | ✓ |
| **Zero-point energy (G·C)** | **~0.22 eV** | **0.049 eV** | **✗ ~4× high** |

The solver also reproduces the analytic harmonic-oscillator spectra (1-D and
2-D) and the KAK-free numerics are unit-tested across the suite (52 tests).

## 5. Limitations (read these)

1. **Dimensional reduction.** Real Löwdin transfer is multidimensional; the 1-D
   model collapses it to one coordinate, and the 2-D model to two. Coupling to
   other nuclear modes is represented only through the bath.
2. **The quartic over-constrains the well curvature.** It ties curvature (hence
   zero-point energy) to (V₀, a). With a physical transfer distance the ZPE
   comes out ~4× the published value (0.22 vs 0.049 eV); matching the ZPE would
   force an unphysical geometry. Quantitative ZPE/rate agreement needs a more
   flexible PES (independent curvature, or a tabulated ab-initio surface).
3. **Phenomenological bath strength.** λ is an estimate, not derived — as in the
   source papers. Absolute relaxation times are therefore order-of-magnitude.
4. **Concerted path is the synchronous diagonal** (an upper bound; real
   concerted transition states are asynchronous and lower), so the 2-D mechanism
   flag is qualitative.
5. **Per-base susceptibility depends only on pair type** (A·T vs G·C). Sequence
   context, stacking, electronic structure, methylation, and the link to actual
   replication-error / mutation rates are not modelled.
6. **No first-principles chemistry.** Mutatiom consumes published parameters; it
   does not compute potential energy surfaces.

## 6. Reproducibility

All physics is covered by `npm test` (Vitest), including analytic ground-truth
checks (harmonic-oscillator spectra, detailed balance, Gibbs steady state) and
the literature validation above. Everything runs client-side; results are
deterministic given the inputs.

## 7. References

- P. P. Slocombe, M. Sacchi, J. Al-Khalili. *An open quantum systems approach to
  proton tunnelling in DNA.* Commun. Phys. **5**, 109 (2022).
  doi:10.1038/s42005-022-00881-8.
- A. D. Godbeer, J. S. Al-Khalili, P. D. Stevenson. *Modelling proton tunnelling
  in the adenine–thymine base pair.* Phys. Chem. Chem. Phys. **17**, 13034
  (2015). doi:10.1039/c5cp00472a.
- P.-O. Löwdin. *Proton tunneling in DNA and its biological implications.* Rev.
  Mod. Phys. **35**, 724 (1963).
- A. O. Caldeira, A. J. Leggett. *Quantum tunnelling in a dissipative system.*
  Ann. Phys. **149**, 374 (1983).

// Symmetric tridiagonal eigensolver (QL with implicit shifts).
//
// Faithful port of EISPACK / Numerical Recipes `tqli`. A 1-D
// finite-difference Hamiltonian is real-symmetric tridiagonal, so this
// is all the linear algebra Mutatiom's Schrödinger core needs.

export interface EigResult {
  /** Eigenvalues, ascending. */
  values: number[];
  /** vectors[i] is the eigenvector for values[i], length n, L2-normalised. */
  vectors: number[][];
}

function pythag(a: number, b: number): number {
  const absa = Math.abs(a);
  const absb = Math.abs(b);
  if (absa > absb) return absa * Math.sqrt(1 + (absb / absa) ** 2);
  if (absb === 0) return 0;
  return absb * Math.sqrt(1 + (absa / absb) ** 2);
}

function sign(a: number, b: number): number {
  return b >= 0 ? Math.abs(a) : -Math.abs(a);
}

/**
 * Eigen-decompose a real-symmetric tridiagonal matrix.
 * @param diag   length-n main diagonal (mutated copy is made internally).
 * @param offdiag length-(n-1) sub/super diagonal.
 */
export function eigSymTridiagonal(diag: number[], offdiag: number[]): EigResult {
  const n = diag.length;
  const d = diag.slice();
  // e[i] is the subdiagonal coupling between row i and i+1; e[n-1] unused.
  const e = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i++) e[i] = offdiag[i];

  // z starts as identity; columns become eigenvectors.
  const z: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );

  const eps = Number.EPSILON;

  for (let l = 0; l < n; l++) {
    let iter = 0;
    let m: number;
    do {
      for (m = l; m < n - 1; m++) {
        const dd = Math.abs(d[m]) + Math.abs(d[m + 1]);
        if (Math.abs(e[m]) <= eps * dd) break;
      }
      if (m !== l) {
        if (iter++ === 50) throw new Error("eigSymTridiagonal: no convergence");
        let g = (d[l + 1] - d[l]) / (2 * e[l]);
        let r = pythag(g, 1);
        g = d[m] - d[l] + e[l] / (g + sign(r, g));
        let s = 1;
        let c = 1;
        let p = 0;
        let i: number;
        for (i = m - 1; i >= l; i--) {
          let f = s * e[i];
          const b = c * e[i];
          e[i + 1] = r = pythag(f, g);
          if (r === 0) {
            d[i + 1] -= p;
            e[m] = 0;
            break;
          }
          s = f / r;
          c = g / r;
          g = d[i + 1] - p;
          r = (d[i] - g) * s + 2 * c * b;
          d[i + 1] = g + (p = s * r);
          g = c * r - b;
          for (let k = 0; k < n; k++) {
            f = z[k][i + 1];
            z[k][i + 1] = s * z[k][i] + c * f;
            z[k][i] = c * z[k][i] - s * f;
          }
        }
        if (r === 0 && i >= l) continue;
        d[l] -= p;
        e[l] = g;
        e[m] = 0;
      }
    } while (m !== l);
  }

  // Assemble (eigenvalue, eigenvector) pairs and sort ascending.
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => d[a] - d[b]);

  const values: number[] = [];
  const vectors: number[][] = [];
  for (const col of idx) {
    values.push(d[col]);
    const v = new Array<number>(n);
    for (let k = 0; k < n; k++) v[k] = z[k][col];
    // Normalise and fix global sign (largest-magnitude component positive).
    let norm = 0;
    for (let k = 0; k < n; k++) norm += v[k] * v[k];
    norm = Math.sqrt(norm);
    let peak = 0;
    for (let k = 0; k < n; k++) if (Math.abs(v[k]) > Math.abs(v[peak])) peak = k;
    const flip = v[peak] < 0 ? -1 : 1;
    for (let k = 0; k < n; k++) v[k] = (v[k] / norm) * flip;
    vectors.push(v);
  }

  return { values, vectors };
}

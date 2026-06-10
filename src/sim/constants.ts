// Atomic units throughout the physics core: ħ = m_e = e = 1.
// Length in Bohr, energy in Hartree, time in atomic units.

export const PROTON_MASS = 1836.15267343; // m_p / m_e
export const DEUTERON_MASS = 3670.48296785; // m_d / m_e — for the kinetic isotope effect
export const TRITON_MASS = 5496.92153573; // m_t / m_e — ³H, the heaviest hydrogen isotope

// Conversions for display.
export const HARTREE_TO_EV = 27.211386245988;
export const HARTREE_TO_KCAL = 627.509474; // kcal/mol
export const BOHR_TO_ANGSTROM = 0.529177210903;
export const ATOMIC_TIME_TO_SECONDS = 2.4188843265857e-17; // ħ / Hartree
export const BOLTZMANN_HARTREE_PER_K = 3.166811563e-6; // k_B in Hartree/Kelvin

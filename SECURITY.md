# Security

## Threat model

Mutatiom is a browser-native, single-owner web app. Everything — the
double-well Schrödinger solver, the tunnelling calculations, and the
visualizer — runs entirely in the user's browser. There is no backend, no
user-account system, no authentication, and no server-side storage of user
data. The app is a static bundle (HTML / JS / CSS) that can be served from any
static host or run locally with `npm run dev`.

There is no server component today. If one is ever added, this document will be
updated to describe it.

## What the app does and doesn't do

- **Runs** entirely client-side: all physics (eigensolver, time evolution,
  WKB) is computed in the user's browser from the parameters they set.
- **Does not** send your inputs anywhere — there are no outbound network calls.
- **Does not** persist data to any server; the app is stateless across reloads.
- **Does not** execute user-supplied code. Inputs are numeric slider/control
  values, not code or arbitrary text.

## Client-side considerations

Because all logic runs in the browser, the relevant trust boundaries are local:

- **No remote data.** Mutatiom computes from numeric model parameters; it does
  not fetch or upload anything in its current form.
- **Numeric inputs only.** The controls produce bounded numeric parameters fed
  to the solver; there is no `eval`, no `new Function`, and no parsing of
  untrusted text or code.
- **Dependency surface.** The app ships third-party JavaScript (React, and the
  Vite/build toolchain in dev only); a vulnerability in a bundled runtime
  dependency would run in the user's browser. Production dependencies are kept
  clean under `npm audit`; dev-only tooling advisories (test / build) do not
  ship.

## Secrets are never committed

These patterns are gitignored and must never be committed:

```
.env, .env.*           — environment files
*.pem, *.key, *.crt    — TLS / private keys / certs
*.p12, *.pfx, *.jks    — keystores
id_rsa*, id_ed25519*   — SSH keys
secrets.*, .secrets    — anything explicitly named "secret"
```

The app needs no application secrets today.

## Reporting a vulnerability

Since Mutatiom is a personal project that does not accept pull requests (see
[`CONTRIBUTING.md`](./CONTRIBUTING.md)), the most direct way to report a
non-sensitive security concern is to open a GitHub
[discussion](../../discussions) or an [issue](../../issues) labelled "security".
For anything sensitive (active exploit, credential exposure), please contact the
maintainer privately rather than filing publicly.

## Known limitations

- **Client-side dependency surface.** The app ships third-party JavaScript; a
  vulnerability in a bundled dependency would run in the user's browser.
- **Numerical caveat (not a security issue, but worth stating).** For a
  realistic deep proton barrier the isolated coherent tunnelling splitting
  underflows double precision; results are meaningful only in the resolvable
  regime. See `README.md`.

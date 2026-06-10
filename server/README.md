# Mutatiom server

A deliberately minimal FastAPI shell. The physics runs in the browser
(`src/sim/`); this service only:

- answers `GET /api/health` for Fly's health check, and
- serves the built client (`src/` → Vite `dist/`) as static files from
  `mutatiom/static/`.

It performs no computation and stores nothing. The `static/` directory is
populated at image-build time by the root `Dockerfile`; it does not exist in
the source tree.

## Run locally

```sh
# from repo root: build the client first
npm run build
# copy/point static at dist, then:
uvicorn mutatiom.app:app --host 0.0.0.0 --port 8000
```

In practice the local dev loop is just `npm run dev`; this server exists for the
production (Docker / Fly) deployment.

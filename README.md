# MCP-files-teams

Team-ready MCP server workflow: ChromaDB on OpenShift + GitOps.

- OpenShift: Chroma StatefulSet on OCS, secured via OAuth2 Proxy + NetworkPolicy
- GitOps: Tekton CI (validate/promote), Argo CD (deploy dev/staging/prod)
- MCP server continues to run locally per user; only Chroma is in-cluster

## Layout
- deploy/ — Kustomize base + env overlays (dev/staging/prod)
- pipelines/tekton/ — Tekton Pipeline and Triggers (CI)
- argocd/ — Argo CD ApplicationSet (CD)
- docs/ — Runbooks and security notes

## Quick Start
1) Point Argo CD at `deploy/overlays/dev` to deploy Chroma.
2) Users set env locally before starting MCP:
   - `export CHROMA_URL=https://chroma-dev.apps.<cluster-domain>`
   - `export MCP_USER_ID=<firstname.lastname>`
   - `export MCP_TEAM_ID=<team>`
   - `export MCP_MEMORY_DIR=~/.mcp-memory`

See `docs/first-pr-checklist.md` for the initial PR items.

# First PR Checklist (MCP-files-teams)

- Repo basics
  - [ ] LICENSE and CODEOWNERS (if applicable)
  - [ ] Branch protection rules prepared in GitHub

- OpenShift manifests (dev)
  - [ ] Set namespace in Argo CD ApplicationSet or per-Application values
  - [ ] Confirm StorageClass name for OCS (e.g., ocs-storagecluster-ceph-rbd)
  - [ ] Set Route host for dev overlay (cluster domain)
  - [ ] Provide OAuth2 Proxy OIDC secret via External Secrets or Sealed Secrets

- CI/CD
  - [ ] Tekton pipeline runs `kustomize build` against dev overlay
  - [ ] Optional: image build/sign steps (if you later containerize MCP)
  - [ ] Triggers configured on PRs/tags (as desired)
  - [ ] Argo CD ApplicationSet created; dev auto-sync enabled

- Security & Ops
  - [ ] NetworkPolicy restricts access to Chroma to only OAuth2 Proxy pod
  - [ ] TLS on Route (edge or reencrypt)
  - [ ] Backup job (snapshot or tar of PVC) scheduled
  - [ ] Runbook updated with restore steps and on-call contacts

- Validation
  - [ ] `curl https://<dev-host>/api/v1/heartbeat` via OAuth2 Proxy (after auth)
  - [ ] Two users can store/search team memories via MCP
  - [ ] Resource usage acceptable; PVC bound; probes green

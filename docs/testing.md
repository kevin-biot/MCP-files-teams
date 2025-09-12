# Testing in MCP-files-teams

This repo validates manifests via:
- Kustomize build (structure correctness)
- Kubeconform schema validation (ignoring missing CRDs for OpenShift-specific APIs)

## Local Validation

Prereqs: `kustomize`, `kubeconform` installed locally.

- Validate dev overlay:
  - `scripts/validate.sh deploy/overlays/dev`
- Validate staging overlay:
  - `scripts/validate.sh deploy/overlays/staging`
- Validate prod overlay:
  - `scripts/validate.sh deploy/overlays/prod`

## Tekton CI

Pipeline: `pipelines/tekton/pipeline.yaml`
- Step 1: Download and run kustomize to build manifests
- Step 2: Download and run kubeconform to validate schemas

Notes:
- We pass `-ignore-missing-schemas` to kubeconform to avoid false positives for CRDs like Route.
- Tighten validation later by adding OpenShift schema sources or custom policies (OPA/Conftest).

## Next Enhancements (Optional)
- Add Conftest policies for common guardrails (e.g., resource limits, probes present).
- Add CronJob validation in CI (e.g., ensure backup job exists in prod overlay).
- Integrate Argo CD app diff checks in a pre-sync hook for higher confidence.

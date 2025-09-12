#!/usr/bin/env bash
set -euo pipefail

# Simple local validator: kustomize build + kubeconform
# Usage: scripts/validate.sh deploy/overlays/dev

OVERLAY_PATH=${1:-deploy/overlays/dev}

if ! command -v kustomize >/dev/null 2>&1; then
  echo "kustomize not found. Install from https://kubectl.docs.kubernetes.io/installation/kustomize/" >&2
  exit 1
fi

if ! command -v kubeconform >/dev/null 2>&1; then
  echo "kubeconform not found. Install: https://github.com/yannh/kubeconform" >&2
  exit 1
fi

echo "Building manifests for ${OVERLAY_PATH}..."
kustomize build "${OVERLAY_PATH}" > /tmp/manifests.yaml

echo "Validating manifests with kubeconform (ignoring missing CRD schemas)..."
kubeconform -ignore-missing-schemas -strict -summary /tmp/manifests.yaml

echo "OK: ${OVERLAY_PATH} passes basic validation."


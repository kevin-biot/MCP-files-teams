#!/usr/bin/env bash
set -euo pipefail

# Publish a Chroma image to the OpenShift internal registry for dev
# Usage: ./scripts/publish-chroma-internal.sh [SOURCE_IMAGE] [TAG]
# Example: ./scripts/publish-chroma-internal.sh chromadb/chroma:1.1.0 1.1.0

SRC_IMAGE="${1:-chromadb/chroma:1.1.0}"
TAG="${2:-1.1.0}"
NS="team-memory-dev"

# Discover the default route for the internal registry
REG_ROUTE=$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}' 2>/dev/null || true)
if [[ -z "$REG_ROUTE" ]]; then
  echo "Finding image registry route failed. Ensure default route is enabled:"
  echo "  oc patch configs.imageregistry.operator.openshift.io/cluster --type merge -p '{"spec":{"defaultRoute":true}}'"
  exit 1
fi

DEST_IMAGE="${REG_ROUTE}/${NS}/chroma:${TAG}"

echo "Logging into internal registry: ${REG_ROUTE}"
oc whoami -t >/dev/null || { echo "Run 'oc login' first"; exit 1; }
TOKEN=$(oc whoami -t)
docker login "${REG_ROUTE}" -u kubeadmin -p "$TOKEN"

echo "Pulling source image: ${SRC_IMAGE}"
docker pull "${SRC_IMAGE}"

echo "Tagging to internal: ${DEST_IMAGE}"
docker tag "${SRC_IMAGE}" "${DEST_IMAGE}"

echo "Pushing to internal registry..."
docker push "${DEST_IMAGE}"

echo "Done. Update your deployment image to: ${DEST_IMAGE}"


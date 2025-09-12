# Dev Overlay (CRC) Notes

This overlay is tuned for local OpenShift (CRC) and stabilizes Chroma startup.

## CRC Deviations
- Localhost binding: Containers must not bind to 127.0.0.1 for kubelet/router checks. We use an nginx sidecar on :8081 as a stable proxy to the app on 127.0.0.1:8000.
- Router/TLS: CRC’s default certs can break HTTP probes; we avoid HTTP in probes and prefer TCP in dev.
- Storage behavior: PVC latency can be higher; first start may warm/compact. Probes are generous.
- Resource ceilings: CRC is resource‑tight; we set reasonable requests/limits and long startup.
- NetworkPolicy: Dev NP allows the OpenShift router namespace to reach the pod port.
- Image/entrypoint: Some images ignore args; we run explicit commands where needed.
- Warmup semantics: Chroma can 410 during warmup; don’t use HTTP liveness until measured.

## Run Contract
- Listens: 0.0.0.0:8081 (nginx), app on 127.0.0.1:8000
- Storage: writes to /data (PVC)
- Heartbeat: healthy within a few minutes on first boot
- Exit: non‑zero on fatal errors

## Probe Matrix (dev)
- startupProbe (tcp 8081): initialDelay 60s, period 10s, failureThreshold 30
- readinessProbe (tcp 8081): period 10s, failureThreshold 6
- livenessProbe (tcp 8081): initialDelay 40s, period 20s, failureThreshold 6

## Fast Validations
- Port‑forward: `oc -n team-memory-dev port-forward statefulset/chroma 18000:8081` then `curl -s http://127.0.0.1:18000/api/v1/heartbeat`
- Endpoints: `oc -n team-memory-dev get endpoints chroma-svc`
- Bind check inside pod: `oc -n team-memory-dev exec pod/chroma-0 -- ss -lntp`

## Operational Guardrails
- TerminationGracePeriod >= shutdown/flush time
- Consider emptyDir smoke test if PVC latency suspected
- Add OAuth2 Proxy only after dev stabilizes

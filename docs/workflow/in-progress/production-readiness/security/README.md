---
title: 'Security matrices'
status: active
updated: 2026-11-02
stage: in-progress
kind: reference
readiness: unverified
launch_gate: B
---

# Security matrices

Filled in Phase 6. Live probes run on **hosted-dev** after Phase 0.6, not prod.

**2026-11-02 tooling pass:** gitleaks (history), semgrep, OSV/`bun audit` and a ZAP baseline on dev are recorded in [`../evidence/phase6-tooling-2026-11-02.md`](../evidence/phase6-tooling-2026-11-02.md); each matrix row below points at that evidence where relevant.

| Matrix                     | File                                           |
| -------------------------- | ---------------------------------------------- |
| OWASP Top 10:2025          | [`owasp-top10-2025.md`](./owasp-top10-2025.md) |
| API Security Top 10 (2023) | [`api-top10-2023.md`](./api-top10-2023.md)     |
| LLM Top 10 (2025)          | [`llm-top10-2025.md`](./llm-top10-2025.md)     |
| ASVS 5.0 L2 (selected)     | [`asvs-l2.md`](./asvs-l2.md)                   |
| Pentest log                | [`pentest-log.md`](./pentest-log.md)           |

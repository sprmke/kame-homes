#!/usr/bin/env bash
# Cloud Agent install: system deps, Bun, docker nested-VM config, bun install,
# local env files, warm Supabase images, validate migrations on a fresh DB.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==== [install] system packages (docker, fuse-overlayfs) ===="
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq \
  -o Dpkg::Options::=--force-confdef \
  -o Dpkg::Options::=--force-confold \
  docker.io fuse-overlayfs uidmap curl unzip

echo "==== [install] Bun (package manager for this repo) ===="
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
bun --version

echo "==== [install] docker daemon config (nested-container storage driver) ===="
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'JSON'
{
  "storage-driver": "fuse-overlayfs",
  "features": { "containerd-snapshotter": false }
}
JSON

echo "==== [install] bun install (root workspace + ui) ===="
bun install --frozen-lockfile

echo "==== [install] local dev env files ===="
"$ROOT/.cursor/write-env-files.sh"

echo "==== [install] start docker + warm images + validate migrations ===="
"$ROOT/.cursor/docker-up.sh"
# Seed SQL expects org fixtures; disable seed for install-time migration validation only.
CONFIG="$ROOT/supabase/config.toml"
CONFIG_BAK="${CONFIG}.cloud-agent-install.bak"
cp "$CONFIG" "$CONFIG_BAK"
python3 - <<'PY'
import re
from pathlib import Path
path = Path("supabase/config.toml")
text = path.read_text()
new, n = re.subn(
    r"(\[db\.seed\][^\[]*)enabled = true",
    r"\1enabled = false",
    text,
    count=1,
    flags=re.DOTALL,
)
if n != 1:
    raise SystemExit("Could not disable [db.seed] in supabase/config.toml")
path.write_text(new)
PY
set +o pipefail
yes | bun run start:supabase
start_code=${PIPESTATUS[1]}
set -o pipefail
if [[ "$start_code" -ne 0 ]]; then
  exit "$start_code"
fi
mv "$CONFIG_BAK" "$CONFIG"
bun run stop:supabase || true

echo "==== [install] done ===="

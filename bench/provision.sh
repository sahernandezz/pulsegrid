#!/usr/bin/env bash
# =============================================================================
# provision.sh — one-time setup on a fresh Ubuntu 22.04+ VM.
# Installs Docker, k6, python3 (+pyyaml) and clones the repo. Then run cloud_run.sh.
#
#   curl -fsSL <raw-url>/bench/provision.sh | bash      # or scp + bash
#
# Set REPO before running, or edit the git clone line below.
# =============================================================================
set -euo pipefail

REPO="${REPO:-https://github.com/YOUR_USER/pulsegrid.git}"

echo "=== apt deps ==="
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git gnupg python3 python3-yaml

echo "=== Docker ==="
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" || true

echo "=== k6 ==="
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list >/dev/null
sudo apt-get update -y && sudo apt-get install -y k6

echo "=== repo ==="
[ -d pulsegrid ] || git clone "$REPO" pulsegrid

echo ""
echo "Provisioned. Log out and back in (so the 'docker' group applies), then:"
echo "  cd pulsegrid && bash bench/cloud_run.sh"

#!/usr/bin/env bash
# Start Docker and apply nested-container fixes required in Cloud Agent VMs.
# Idempotent — safe to call on every boot (fixes are not captured by snapshots).
set -euo pipefail

if ! sudo docker info >/dev/null 2>&1; then
  echo "== [docker-up] starting dockerd =="
  sudo bash -c 'nohup dockerd >/var/log/dockerd.log 2>&1 &'
  for _ in $(seq 1 60); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
sudo docker info >/dev/null 2>&1 || { echo "[docker-up] dockerd failed to start"; sudo tail -30 /var/log/dockerd.log || true; exit 1; }

echo "== [docker-up] applying nested-container network fixes =="
sudo modprobe br_netfilter 2>/dev/null || true
sudo sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 >/dev/null 2>&1 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 >/dev/null 2>&1 || true
sudo iptables-legacy -P FORWARD ACCEPT 2>/dev/null || true

echo "== [docker-up] granting docker socket access to $(id -un) =="
sudo groupadd -f docker
sudo usermod -aG docker "$(id -un)" 2>/dev/null || true
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

echo "== [docker-up] docker ready =="

#!/usr/bin/env bash

set -euo pipefail
umask 077

DOMAIN="${DOMAIN:-jijiangeshui.com}"
ALT_NAMES="${ALT_NAMES:-}"
WEBROOT="${WEBROOT:-/www/wwwroot/_acme-challenge}"
ACME_HOME="${ACME_HOME:-${HOME}/.acme.sh}"
CERT_ROOT="${CERT_ROOT:-/etc/nginx/ssl}"
EMAIL="${EMAIL:-}"
CA_PROVIDER="${CA_PROVIDER:-letsencrypt}"
INSTALL_CRON="${INSTALL_CRON:-1}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run this script as root." >&2
  exit 1
fi
if [[ ! -x "${ACME_HOME}/acme.sh" ]]; then
  echo "acme.sh not found at ${ACME_HOME}/acme.sh" >&2
  echo "Install acme.sh first, then rerun this script." >&2
  exit 1
fi
if [[ ! "${DOMAIN}" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$ ]]; then
  echo "Invalid domain: ${DOMAIN}" >&2
  exit 1
fi

mkdir -p "${WEBROOT}"
CERT_DIR="${CERT_ROOT}/${DOMAIN}"
FULLCHAIN_PATH="${CERT_DIR}/fullchain.cer"
KEY_PATH="${CERT_DIR}/${DOMAIN}.key"
mkdir -p "${CERT_DIR}"

ACME_ARGS=(--issue -d "${DOMAIN}" --webroot "${WEBROOT}" --server "${CA_PROVIDER}")
if [[ -n "${ALT_NAMES}" ]]; then
  read -r -a ALT_NAME_LIST <<< "${ALT_NAMES}"
  for name in "${ALT_NAME_LIST[@]}"; do ACME_ARGS+=(-d "${name}"); done
fi
if [[ -n "${EMAIL}" ]]; then
  "${ACME_HOME}/acme.sh" --register-account -m "${EMAIL}" --server "${CA_PROVIDER}" || true
fi

"${ACME_HOME}/acme.sh" "${ACME_ARGS[@]}"

# 安装证书时注册 Nginx reload 钩子，续期后自动加载新证书。
"${ACME_HOME}/acme.sh" \
  --install-cert -d "${DOMAIN}" \
  --fullchain-file "${FULLCHAIN_PATH}" \
  --key-file "${KEY_PATH}" \
  --reloadcmd "nginx -t && systemctl reload nginx"

chmod 644 "${FULLCHAIN_PATH}"
chmod 600 "${KEY_PATH}"
if [[ "${INSTALL_CRON}" == "1" ]]; then "${ACME_HOME}/acme.sh" --install-cronjob; fi

echo
echo "SSL setup complete."
echo "Domain: ${DOMAIN}"
echo "Certificate: ${FULLCHAIN_PATH}"
echo "Private key: ${KEY_PATH}"
echo "Renewal check: ${ACME_HOME}/acme.sh --list"

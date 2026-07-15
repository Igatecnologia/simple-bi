#!/bin/sh
# Garante que todo domínio referenciado em conf.d/*.conf tenha ao menos um
# certificado (autoassinado, se necessário) antes do nginx iniciar — evita
# o nginx entrar em crash-loop por "cannot load certificate" quando o
# certificado real (Let's Encrypt) ainda não foi emitido/renovado.
set -e

for conf in /etc/nginx/conf.d/*.conf; do
  [ -f "$conf" ] || continue
  domain=$(awk -F/ '/ssl_certificate[ \t]+\// { print $5; exit }' "$conf")
  [ -n "$domain" ] || continue

  cert_dir="/etc/letsencrypt/live/$domain"
  if [ ! -f "$cert_dir/fullchain.pem" ]; then
    echo "[entrypoint] Certificado real ausente para '$domain' — gerando autoassinado temporário."
    mkdir -p "$cert_dir"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout "$cert_dir/privkey.pem" \
      -out "$cert_dir/fullchain.pem" \
      -subj "/CN=$domain" 2>/dev/null
  fi
done

exec "$@"

#!/usr/bin/env bash
# Emite o certificado Let's Encrypt inicial para o nginx.
# Rodar uma única vez, na primeira subida do ambiente em produção.
#
# Uso: ./nginx/init-letsencrypt.sh bi.example.com seu@email.com

set -e

DOMAIN="${1:?Uso: $0 <dominio> <email>}"
EMAIL="${2:?Uso: $0 <dominio> <email>}"

if [ ! -f nginx/conf.d/default.conf ] || grep -q "bi.example.com" nginx/conf.d/default.conf; then
  echo "Aviso: nginx/conf.d/default.conf ainda usa o domínio placeholder 'bi.example.com'."
  echo "Troque para '$DOMAIN' nesse arquivo antes de continuar (ou este script fará isso agora)."
  sed -i "s/bi.example.com/$DOMAIN/g" nginx/conf.d/default.conf
fi

echo "### Criando certificado dummy para permitir o nginx subir ###"
docker compose run --rm --entrypoint "\
  mkdir -p /etc/letsencrypt/live/$DOMAIN && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=localhost'" certbot

echo "### Subindo o nginx ###"
docker compose up -d nginx

echo "### Removendo certificado dummy ###"
docker compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$DOMAIN && \
  rm -rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "### Solicitando certificado real da Let's Encrypt ###"
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    -d $DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email" certbot

echo "### Recarregando o nginx com o certificado real ###"
docker compose exec nginx nginx -s reload

echo "Concluído. Acesse https://$DOMAIN"

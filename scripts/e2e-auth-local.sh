#!/usr/bin/env bash
# e2e COM LOGIN contra um Supabase LOCAL (descartável), sem nenhuma credencial de produção.
# Sobe o Supabase pela CLI (precisa de Docker), aplica todas as migrações, cria um usuário de TESTE com senha aleatória,
# sobe o app apontando para esse Supabase e roda e2e/auth.e2e.cjs. Apaga tudo no final.
# Uso: bash scripts/e2e-auth-local.sh   (precisa de: supabase CLI, Docker, npm ci, npx playwright install chromium)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${E2E_PORT:-3100}"
EMAIL="e2e-ci@teste.local"
PASSWORD="$(openssl rand -hex 16)"
echo "::add-mask::$PASSWORD" 2>/dev/null || true
APP_PID=""
CREATED_CONFIG=0
cleanup() {
  [ -n "$APP_PID" ] && kill "$APP_PID" 2>/dev/null || true
  supabase stop --no-backup >/dev/null 2>&1 || true
  [ "$CREATED_CONFIG" = "1" ] && rm -f supabase/config.toml || true
}
trap cleanup EXIT

# config.toml só existe no runner (não vai para o repositório).
if [ ! -f supabase/config.toml ]; then supabase init --force >/dev/null 2>&1 || supabase init >/dev/null; CREATED_CONFIG=1; fi

# Só o que o app usa: banco, API REST e autenticação (sem Studio, Realtime, Storage, e-mail, funções).
supabase start -x studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,mailpit,postgres-meta,supavisor

# Variáveis do Supabase local. Os nomes mudam entre versões da CLI: tenta os dois.
ENV_FILE="$(mktemp)"
supabase status -o env > "$ENV_FILE"
getv() { grep -E "^($1)=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'; }
API_URL="$(getv API_URL)"
ANON_KEY="$(getv 'ANON_KEY|PUBLISHABLE_KEY')"
SERVICE_KEY="$(getv 'SERVICE_ROLE_KEY|SECRET_KEY')"
rm -f "$ENV_FILE"
[ -n "$API_URL" ] && [ -n "$ANON_KEY" ] && [ -n "$SERVICE_KEY" ] || { echo "Não consegui ler as chaves do Supabase local."; exit 1; }
echo "::add-mask::$SERVICE_KEY" 2>/dev/null || true

# Usuário de teste (confirmado, com senha). Só existe neste banco descartável.
HTTP=$(curl -s -o /tmp/e2e-user.json -w '%{http_code}' -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")
[ "$HTTP" = "200" ] || { echo "Falha ao criar o usuário de teste (HTTP $HTTP)."; exit 1; }
rm -f /tmp/e2e-user.json

# O app aponta para o Supabase local. A chave pública entra no build; a secreta só no servidor.
export NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export SUPABASE_SECRET_KEY="$SERVICE_KEY"
export ALLOWED_EMAILS="$EMAIL"
# 3D Studio (Beta) ligado só neste servidor de teste, para o e2e de abrir peça salva no celular.
export MODELING_3D_ENABLED=1
npm run build
npx next start -p "$PORT" > "${E2E_APP_LOG:-/tmp/next-auth.log}" 2>&1 &
APP_PID=$!
for i in $(seq 1 60); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null && break; sleep 1; done
curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null || { cat "${E2E_APP_LOG:-/tmp/next-auth.log}"; exit 1; }

E2E_BASE="http://127.0.0.1:$PORT" E2E_EMAIL="$EMAIL" E2E_PASSWORD="$PASSWORD" E2E_3D=1 npm run test:e2e:auth

#!/usr/bin/env bash
# Testes de banco em Postgres TEMPORÁRIO e local (nunca conecta no Supabase remoto).
# Sobe um cluster descartável, aplica a imitação do Supabase + migrações, roda os testes SQL
# e um teste de concorrência real (várias conexões ao mesmo tempo). Apaga tudo no final.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(pg_config --bindir 2>/dev/null || true)"
[ -x "$BIN/initdb" ] || BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -x "$BIN/initdb" ] || { echo "Postgres local não encontrado (initdb). Instale o PostgreSQL para rodar test:db."; exit 1; }

WORK="$(mktemp -d)"
PORT="${GADU_TEST_PG_PORT:-54329}"
AS=()
if [ "$(id -u)" = "0" ]; then AS=(runuser -u postgres --); chown postgres "$WORK"; chmod 755 "$WORK"; fi
cleanup() { "${AS[@]}" "$BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${AS[@]}" "$BIN/initdb" -D "$WORK/data" -U postgres -A trust -E UTF8 --no-locale >/dev/null
"${AS[@]}" "$BIN/pg_ctl" -D "$WORK/data" -l "$WORK/pg.log" -w -o "-k $WORK -p $PORT -c listen_addresses='' -c max_connections=120 -c timezone=UTC" start >/dev/null

PSQL=(psql -X -q -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1)
run() { "${PSQL[@]}" -f "$1" 2>&1 | sed -n 's/^\(psql:[^:]*:[0-9]*: \)\{0,1\}NOTICE:  //p; /ERROR\|FALHOU\|passaram/p'; }

echo "== aplicando imitação do Supabase e migrações"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_shim.sql" >/dev/null
for m in 20261108000001_init.sql 20261113120001_daily_quota_atomic.sql; do
  "${PSQL[@]}" -f "$ROOT/supabase/migrations/$m" >/dev/null
  echo "   aplicada $m"
done

echo "== testes SQL"
run "$ROOT/supabase/tests/10_daily_quota.test.sql"

# Concorrência: N conexões simultâneas do mesmo usuário com limite L.
concurrent() { # $1=nome $2=usuario $3=chamadas $4=sql da chamada
  local out="$WORK/$1"; mkdir -p "$out"
  for i in $(seq 1 "$3"); do
    "${PSQL[@]}" -At -c "begin; select set_config('request.jwt.claim.sub', '$2', true); set local role authenticated; select $4; commit;" > "$out/$i" 2>&1 &
  done
  wait
  cat "$out"/* | grep -cx "t" || true
}

echo "== concorrência"
"${PSQL[@]}" -c "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'd1@teste.local'), ('00000000-0000-0000-0000-0000000000d2', 'd2@teste.local'), ('00000000-0000-0000-0000-0000000000e1', 'e1@teste.local'); update private.quota_policy set daily_limit = 10;" >/dev/null

FAIL=0
D1=00000000-0000-0000-0000-0000000000d1
D2=00000000-0000-0000-0000-0000000000d2
E1=00000000-0000-0000-0000-0000000000e1
count_of() { "${PSQL[@]}" -At -c "select coalesce((select messages from public.usage_daily where user_id = '$1'), 0)"; }
expect() { # $1=descrição $2=obtido $3=esperado
  if [ "$2" = "$3" ]; then echo "ok - $1: $2"; else echo "FALHOU - $1: obtido $2, esperado $3"; FAIL=1; fi
}

# 1) Um usuário, 40 chamadas ao mesmo tempo, limite 10: só 10 passam e a contagem para em 10.
A=$(concurrent nova "$D1" 40 "(public.consume_daily_quota() ->> 'allowed')::boolean")
expect "40 chamadas simultâneas, limite 10, permitidas" "$A" 10
expect "contagem final após a corrida" "$(count_of "$D1")" 10

# 2) Dois usuários disputando ao mesmo tempo: cada um respeita o próprio limite.
concurrent par1 "$D2" 25 "(public.consume_daily_quota() ->> 'allowed')::boolean" > "$WORK/p1" &
concurrent par2 "$E1" 25 "(public.consume_daily_quota() ->> 'allowed')::boolean" > "$WORK/p2" &
wait
expect "usuário 1 em paralelo, permitidas" "$(cat "$WORK/p1")" 10
expect "usuário 2 em paralelo, permitidas" "$(cat "$WORK/p2")" 10
expect "contagem usuário 1" "$(count_of "$D2")" 10
expect "contagem usuário 2" "$(count_of "$E1")" 10

# 3) Comparação (só informativo): a função antiga com o mesmo cenário deixa a contagem passar do limite.
"${PSQL[@]}" -c "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'f1@teste.local')" >/dev/null
OLD=$(concurrent antiga 00000000-0000-0000-0000-0000000000f1 40 "public.consume_quota(10)")
echo "info - função antiga (produção hoje): 40 chamadas, limite 10 → $OLD permitidas, contagem $(count_of 00000000-0000-0000-0000-0000000000f1) (passa do limite)"

if [ "$FAIL" = "0" ]; then echo "== test:db: todos os testes passaram"; else echo "== test:db: FALHAS encontradas"; exit 1; fi

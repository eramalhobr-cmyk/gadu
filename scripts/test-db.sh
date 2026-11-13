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
# Só as migrações necessárias e que rodam em Postgres puro (as de pgvector ficam de fora).
MIGRATIONS=(20261108000001_init.sql 20261109000001_usage_costs.sql 20261109000002_memory_v2_usage.sql 20261113120001_daily_quota_atomic.sql 20261113140001_ai_budget_reservations.sql)
for m in "${MIGRATIONS[@]}"; do
  "${PSQL[@]}" -f "$ROOT/supabase/migrations/$m" >/dev/null
  echo "   aplicada $m"
done

echo "== testes SQL"
for t in "$ROOT"/supabase/tests/[1-9]*.test.sql; do run "$t"; done

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
# Lê um número de um arquivo; ausente ou inválido vira "erro" (e a comparação falha).
num() { local v; v="$(tr -d '[:space:]' < "$1" 2>/dev/null)"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo "erro"; }
sum2() { [[ "$1" =~ ^[0-9]+$ && "$2" =~ ^[0-9]+$ ]] && echo $(( $1 + $2 )) || echo "erro"; }
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
expect "usuário 1 em paralelo, permitidas" "$(num "$WORK/p1")" 10
expect "usuário 2 em paralelo, permitidas" "$(num "$WORK/p2")" 10
expect "contagem usuário 1" "$(count_of "$D2")" 10
expect "contagem usuário 2" "$(count_of "$E1")" 10

# 3) Comparação (só informativo): a função antiga com o mesmo cenário deixa a contagem passar do limite.
"${PSQL[@]}" -c "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'f1@teste.local')" >/dev/null
OLD=$(concurrent antiga 00000000-0000-0000-0000-0000000000f1 40 "public.consume_quota(10)")
echo "info - função antiga (produção hoje): 40 chamadas, limite 10 → $OLD permitidas, contagem $(count_of 00000000-0000-0000-0000-0000000000f1) (passa do limite)"

# 4) Orçamento: teto US$ 1,00, reservas de US$ 0,25. 20 chamadas simultâneas → só 4 reservas.
"${PSQL[@]}" -c "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'b1@teste.local'), ('00000000-0000-0000-0000-0000000000b2', 'b2@teste.local'), ('00000000-0000-0000-0000-0000000000b3', 'b3@teste.local'); update private.budget_policy set monthly_limit_usd = 1.00, global_monthly_limit_usd = null;" >/dev/null
B=$(concurrent orcamento 00000000-0000-0000-0000-0000000000b1 20 "(public.reserve_ai_budget('chat', 0.25) ->> 'allowed')::boolean")
expect "orçamento: 20 reservas simultâneas de 0,25 com teto 1,00, permitidas" "$B" 4
expect "orçamento: total reservado após a corrida" "$("${PSQL[@]}" -At -c "select sum(amount_usd) from public.ai_reservations where user_id = '00000000-0000-0000-0000-0000000000b1' and status = 'reserved'")" "1.000000"

# 5) Teto global da conta: 1,00 somando duas pessoas (cada uma com teto 1,00), 10 + 10 chamadas ao mesmo tempo.
"${PSQL[@]}" -c "update private.budget_policy set global_monthly_limit_usd = 1.00" >/dev/null
concurrent g1 00000000-0000-0000-0000-0000000000b2 10 "(public.reserve_ai_budget('chat', 0.25) ->> 'allowed')::boolean" > "$WORK/out_g1" &
concurrent g2 00000000-0000-0000-0000-0000000000b3 10 "(public.reserve_ai_budget('chat', 0.25) ->> 'allowed')::boolean" > "$WORK/out_g2" &
wait
# b1 já segura 1,00 de reserva aberta: o teto global (1,00) está tomado, então nenhuma nova reserva passa.
expect "teto global já ocupado: reservas novas de outras pessoas" "$(sum2 "$(num "$WORK/out_g1")" "$(num "$WORK/out_g2")")" 0
"${PSQL[@]}" -c "update public.ai_reservations set status = 'released' where user_id = '00000000-0000-0000-0000-0000000000b1'" >/dev/null
concurrent g3 00000000-0000-0000-0000-0000000000b2 10 "(public.reserve_ai_budget('chat', 0.25) ->> 'allowed')::boolean" > "$WORK/out_g3" &
concurrent g4 00000000-0000-0000-0000-0000000000b3 10 "(public.reserve_ai_budget('chat', 0.25) ->> 'allowed')::boolean" > "$WORK/out_g4" &
wait
expect "teto global livre: reservas somadas das duas pessoas" "$(sum2 "$(num "$WORK/out_g3")" "$(num "$WORK/out_g4")")" 4

if [ "$FAIL" = "0" ]; then echo "== test:db: todos os testes passaram"; else echo "== test:db: FALHAS encontradas"; exit 1; fi

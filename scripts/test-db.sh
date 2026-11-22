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
# Todas as migrações, em ordem (o banco de teste fica igual ao de produção, sem dados).
# A busca por significado usa pgvector: sem ele, o teste FALHA (nunca pula tabelas em silêncio).
"${PSQL[@]}" -At -c "select 1 from pg_available_extensions where name = 'vector'" | grep -qx 1 \
  || { echo "FALHOU: extensão pgvector não instalada (ex.: apt-get install postgresql-\$(pg_config --version | grep -oE '[0-9]+' | head -1)-pgvector)"; exit 1; }
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f" >/dev/null
  echo "   aplicada $(basename "$f")"
  # Etapa 1 da segurança P1 (aditiva): ANTES da restritiva, prova que o app que está em produção hoje continua
  # funcionando (funções antigas, insert em usage_events, consume_quota) e que as funções novas já existem.
  if [[ "$(basename "$f")" == 20261122120001_* ]]; then
    echo "== compatibilidade da migração aditiva (app atual em produção)"
    run "$ROOT/supabase/tests/compat/aditiva_compat.sql"
  fi
done

echo "== testes SQL"
for t in "$ROOT"/supabase/tests/[1-9]*.test.sql; do run "$t"; done

# Concorrência: N conexões simultâneas do mesmo usuário com limite L.
concurrent() { # $1=nome $2=usuario $3=chamadas $4=sql da chamada $5=papel (padrão authenticated; service_role = servidor)
  local out="$WORK/$1" role="${5:-authenticated}"; mkdir -p "$out"
  for i in $(seq 1 "$3"); do
    "${PSQL[@]}" -At -c "begin; select set_config('request.jwt.claim.sub', '$2', true); set local role $role; select $4; commit;" > "$out/$i" 2>&1 &
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
B2=00000000-0000-0000-0000-0000000000b2
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

# 3) S-07: a função antiga (limite enviado por quem chama) não existe mais.
expect "função antiga consume_quota removida" "$("${PSQL[@]}" -At -c "select count(*) from pg_proc where proname = 'consume_quota'")" 0

# 4) Orçamento: teto US$ 1,00, reservas de US$ 0,25. 20 chamadas simultâneas → só 4 reservas.
"${PSQL[@]}" -c "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'b1@teste.local'), ('00000000-0000-0000-0000-0000000000b2', 'b2@teste.local'), ('00000000-0000-0000-0000-0000000000b3', 'b3@teste.local'); update private.budget_policy set monthly_limit_usd = 1.00, global_monthly_limit_usd = null;" >/dev/null
B=$(concurrent orcamento 00000000-0000-0000-0000-0000000000b1 20 "(public.server_reserve_ai_budget('00000000-0000-0000-0000-0000000000b1', 'chat', 0.25) ->> 'allowed')::boolean" service_role)
expect "orçamento: 20 reservas simultâneas de 0,25 com teto 1,00, permitidas" "$B" 4
expect "orçamento: total reservado após a corrida" "$("${PSQL[@]}" -At -c "select sum(amount_usd) from public.ai_reservations where user_id = '00000000-0000-0000-0000-0000000000b1' and status = 'reserved'")" "1.000000"

# 5) Teto global da conta: 1,00 somando duas pessoas (cada uma com teto 1,00), 10 + 10 chamadas ao mesmo tempo.
"${PSQL[@]}" -c "update private.budget_policy set global_monthly_limit_usd = 1.00" >/dev/null
concurrent g1 00000000-0000-0000-0000-0000000000b2 10 "(public.server_reserve_ai_budget('00000000-0000-0000-0000-0000000000b2', 'chat', 0.25) ->> 'allowed')::boolean" service_role > "$WORK/out_g1" &
concurrent g2 00000000-0000-0000-0000-0000000000b3 10 "(public.server_reserve_ai_budget('00000000-0000-0000-0000-0000000000b3', 'chat', 0.25) ->> 'allowed')::boolean" service_role > "$WORK/out_g2" &
wait
# b1 já segura 1,00 de reserva aberta: o teto global (1,00) está tomado, então nenhuma nova reserva passa.
expect "teto global já ocupado: reservas novas de outras pessoas" "$(sum2 "$(num "$WORK/out_g1")" "$(num "$WORK/out_g2")")" 0
"${PSQL[@]}" -c "update public.ai_reservations set status = 'released' where user_id = '00000000-0000-0000-0000-0000000000b1'" >/dev/null
concurrent g3 00000000-0000-0000-0000-0000000000b2 10 "(public.server_reserve_ai_budget('00000000-0000-0000-0000-0000000000b2', 'chat', 0.25) ->> 'allowed')::boolean" service_role > "$WORK/out_g3" &
concurrent g4 00000000-0000-0000-0000-0000000000b3 10 "(public.server_reserve_ai_budget('00000000-0000-0000-0000-0000000000b3', 'chat', 0.25) ->> 'allowed')::boolean" service_role > "$WORK/out_g4" &
wait
expect "teto global livre: reservas somadas das duas pessoas" "$(sum2 "$(num "$WORK/out_g3")" "$(num "$WORK/out_g4")")" 4

# 6) Liquidação simultânea da MESMA reserva: o custo é gravado uma única vez (idempotência sob corrida).
RID=$("${PSQL[@]}" -At -c "select id from public.ai_reservations where user_id = '$B2' and status = 'reserved' limit 1")
SC=$(concurrent liquida "$B2" 20 "(public.server_settle_ai_budget('$B2', '$RID', 'anthropic', 'x', 10, 10, 0.05) ->> 'ok')::boolean" service_role)
expect "liquidação: 20 chamadas simultâneas da mesma reserva, todas ok (idempotente)" "$SC" 20
expect "liquidação: consumo gravado uma única vez" "$("${PSQL[@]}" -At -c "select count(*) || ':' || sum(cost_usd) from public.usage_events where user_id = '$B2'")" "1:0.050000"

if [ "${GADU_AUDIT:-}" = "1" ]; then
  echo "== auditoria dos riscos conhecidos (informativo, não aprova nada)"
  "${PSQL[@]}" -f "$ROOT/supabase/tests/audit/riscos_conhecidos.sql" 2>&1 | sed -n 's/^.*NOTICE:  //p'
fi

if [ "$FAIL" = "0" ]; then echo "== test:db: todos os testes passaram"; else echo "== test:db: FALHAS encontradas"; exit 1; fi

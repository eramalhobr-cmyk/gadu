"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyze, type Report } from "@/lib/3d/checks";
import { PEDIDO_MAX, TRIANGULOS_MAX } from "@/lib/3d/limits";
import { boundingBox, parseStl, placeOnBed, triangleCount, type Mesh } from "@/lib/3d/mesh";
import { applyParams, defaultValues, parseParams, type Param, type ParamValues } from "@/lib/3d/params";
import { encodeBinaryStl } from "@/lib/3d/stl";
import { A1_TEMPLATE_AVAILABLE, A1_TEMPLATE_PENDING_TEXT, build3mf } from "@/lib/3d/threemf";
import { ScadRenderer } from "@/lib/3d/worker-client";
import { Icon } from "../ui";
import { PageHeader, Panel } from "../kit";
import { Viewer3D } from "./Viewer3D";
import "./studio3d.css";

type Modo = "novo" | "refinar" | "corrigir";
type RenderState = { state: "idle" | "busy" | "ok" | "erro"; error?: string; log?: string };

const EXEMPLOS = ["Um suporte de celular com 70 mm de largura", "Uma caixa com tampa, 100 × 60 × 40 mm", "Um gancho de parede para chaves"];
const STATUS_ICON = { ok: "check", aviso: "bell", erro: "x" } as const;
const STATUS_TEXT = { ok: "Ok", aviso: "Atenção", erro: "Problema" } as const;

const f = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function httpMessage(status: number, body: unknown): string {
  const m = body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string" ? (body as { message: string }).message : "";
  if (m) return m;
  if (status === 401) return "Sua sessão expirou. Entre de novo para continuar.";
  if (status === 404) return "O 3D Studio está desligado no momento.";
  if (status === 0) return "Não consegui falar com o servidor. Confira a internet.";
  return "Não consegui gerar a peça agora. Tente de novo em instantes.";
}

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "peca";

export function Studio3D() {
  const [pedido, setPedido] = useState("");
  const [ajuste, setAjuste] = useState("");
  const [ultimoPedido, setUltimoPedido] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erroIA, setErroIA] = useState("");
  const [scad, setScad] = useState("");
  const [anteriores, setAnteriores] = useState<string[]>([]);
  const [values, setValues] = useState<ParamValues>({});
  const [render, setRender] = useState<RenderState>({ state: "idle" });
  const [mesh, setMesh] = useState<Mesh | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [copiado, setCopiado] = useState(false);
  const params = useMemo(() => parseParams(scad), [scad]);
  const renderer = useRef<ScadRenderer | null>(null);
  const seq = useRef(0);

  // Renderiza no worker quando o código ou um controle muda. Não chama a IA.
  useEffect(() => {
    if (!scad) return;
    const mine = ++seq.current;
    setRender((s) => ({ ...s, state: "busy" }));
    const t = setTimeout(async () => {
      renderer.current ??= new ScadRenderer();
      const r = await renderer.current.render(applyParams(scad, values));
      if (mine !== seq.current) return;
      if (r.ok) {
        try {
          const m = placeOnBed(parseStl(r.stl));
          if (triangleCount(m) > TRIANGULOS_MAX) throw new Error("A peça ficou detalhada demais para o celular.");
          setMesh(m);
          setReport(analyze(m, params, values));
          setRender({ state: "ok" });
        } catch (e) {
          setRender({ state: "erro", error: e instanceof Error ? e.message : "Não consegui ler a peça.", log: "" });
        }
      } else if (r.reason !== "cancelled") {
        setRender({ state: "erro", error: r.error, log: r.log });
      }
    }, 200);
    return () => clearTimeout(t);
  }, [scad, values, params]);

  useEffect(() => () => { renderer.current?.dispose(); renderer.current = null; seq.current++; }, []);

  const pedirIA = useCallback(async (modo: Modo, texto: string) => {
    setGerando(true); setErroIA("");
    try {
      const res = await fetch("/api/3d/generate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ modo, pedido: texto, ...(modo !== "novo" ? { scad } : {}), ...(modo === "corrigir" ? { erro: `${render.error ?? ""}\n${render.log ?? ""}`.trim().slice(0, 1500) } : {}) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || typeof body.scad !== "string") { setErroIA(httpMessage(res.status, body)); return; }
      if (scad) setAnteriores((a) => [...a.slice(-9), scad]);
      setScad(body.scad);
      setValues(defaultValues(parseParams(body.scad)));
      setRender({ state: "busy" });
      if (modo === "novo") { setUltimoPedido(texto); setMesh(null); setReport(null); }
      setAjuste("");
    } catch {
      setErroIA(httpMessage(0, null));
    } finally {
      setGerando(false);
    }
  }, [scad, render.error, render.log]);

  const voltar = () => {
    const prev = anteriores[anteriores.length - 1];
    if (!prev) return;
    setAnteriores((a) => a.slice(0, -1));
    setScad(prev); setValues(defaultValues(parseParams(prev)));
  };

  const box = mesh ? boundingBox(mesh) : null;
  const nome = slug(ultimoPedido || "peca");
  const copiar = async () => {
    try { await navigator.clipboard.writeText(applyParams(scad, values)); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão: a pessoa seleciona o texto */ }
  };

  return (
    <div className="wrap s3d">
      <PageHeader eyebrow="Beta" title="3D" text="Descreva a peça e o GaDu monta o modelo para imprimir na Bambu Lab A1. Os ajustes de medida não gastam IA." />

      <Panel title="O que você quer imprimir?" icon="cube">
        <form className="s3d-ask" onSubmit={(e) => { e.preventDefault(); if (pedido.trim() && !gerando) void pedirIA("novo", pedido.trim()); }}>
          <label className="fld">
            <span>Descreva a peça, com as medidas em milímetros</span>
            <textarea className="field" rows={3} maxLength={PEDIDO_MAX} value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Um suporte de celular com 70 mm de largura" />
          </label>
          <div className="s3d-ex" aria-label="Exemplos">
            {EXEMPLOS.map((x) => <button key={x} type="button" className="chip" onClick={() => setPedido(x)}>{x}</button>)}
          </div>
          <button className="btn btn-pri" type="submit" disabled={gerando || !pedido.trim()}>{gerando && !scad ? "Gerando…" : "Gerar peça"}</button>
        </form>
        {erroIA && <p className="s3d-err" role="alert">{erroIA}</p>}
      </Panel>

      {scad && (
        <>
          <div className="s3d-grid">
            <div className="s3d-main">
              <Panel title="Peça" icon="cube" action={<span className="pill s3d-state" role="status">{render.state === "busy" ? "Montando…" : render.state === "ok" ? "Pronta" : render.state === "erro" ? "Com erro" : ""}</span>}>
                <Viewer3D positions={mesh?.positions ?? null} box={box} />
                {render.state === "erro" && (
                  <div className="s3d-fail" role="alert">
                    <b>Não consegui montar a peça.</b>
                    <p>{render.error}</p>
                    {render.log && <details><summary>Detalhes técnicos</summary><pre>{render.log}</pre></details>}
                    <button className="btn btn-sm" disabled={gerando} onClick={() => void pedirIA("corrigir", ultimoPedido || "Corrija o código")}>{gerando ? "Corrigindo…" : "Pedir correção à IA"}</button>
                  </div>
                )}
              </Panel>

              <Panel title="Baixar" icon="folder">
                <div className="s3d-dl">
                  <button className="btn btn-pri" disabled={!mesh || render.state === "busy"} onClick={() => mesh && download(encodeBinaryStl(mesh, "GaDu 3D"), `${nome}.stl`, "model/stl")}>Baixar STL</button>
                  <button className="btn" disabled={!mesh || render.state === "busy"} onClick={() => mesh && download(build3mf(mesh, ultimoPedido || "Peça GaDu"), `${nome}.3mf`, "model/3mf")}>Baixar 3MF</button>
                  <button className="btn" disabled={!A1_TEMPLATE_AVAILABLE} aria-describedby="s3d-a1-note">3MF A1 PLA 0.4 (projeto Bambu Studio)</button>
                </div>
                <p id="s3d-a1-note" className="muted small">{A1_TEMPLATE_PENDING_TEXT}. Por enquanto, abra o STL ou o 3MF no Bambu Studio e escolha a A1, o bico 0.4 e o PLA.</p>
              </Panel>
            </div>

            <div className="s3d-side">
              {params.length > 0 && (
                <Panel title="Ajustes da peça" icon="gear">
                  <p className="muted small">Mexa nos controles para ver a peça mudar. Não usa IA.</p>
                  <div className="s3d-params">
                    {params.map((p) => <ParamControl key={p.name} p={p} value={values[p.name] ?? p.value} onChange={(v) => setValues((s) => ({ ...s, [p.name]: v }))} />)}
                  </div>
                </Panel>
              )}

              <Panel title="Pronta para a A1?" icon="check">
                {!report ? <p className="muted small">As verificações aparecem quando a peça estiver montada.</p> : (
                  <ul className="s3d-checks">
                    {report.checks.map((c) => (
                      <li key={c.id} className={`s3d-check ${c.status}`}>
                        <span className="s3d-ci" aria-hidden="true"><Icon name={STATUS_ICON[c.status]} size={16} /></span>
                        <div>
                          <b>{c.titulo} <span className="sr">: {STATUS_TEXT[c.status]}</span></b>
                          <p>{c.mensagem}</p>
                          {c.sugestao && c.status !== "ok" && <p className="s3d-fix">O que fazer: {c.sugestao}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Pedir uma mudança" icon="chat">
                <form className="s3d-ask" onSubmit={(e) => { e.preventDefault(); if (ajuste.trim() && !gerando) void pedirIA("refinar", ajuste.trim()); }}>
                  <label className="fld">
                    <span>O que mudar?</span>
                    <input className="field" maxLength={PEDIDO_MAX} value={ajuste} onChange={(e) => setAjuste(e.target.value)} placeholder="2 mm mais alto, com bordas arredondadas" />
                  </label>
                  <div className="s3d-row">
                    <button className="btn btn-pri" type="submit" disabled={gerando || !ajuste.trim()}>{gerando ? "Ajustando…" : "Ajustar"}</button>
                    <button className="btn" type="button" disabled={gerando || anteriores.length === 0} onClick={voltar}>Voltar uma versão</button>
                  </div>
                </form>
              </Panel>
            </div>
          </div>

          <Panel title="Código OpenSCAD" icon="code" action={<button className="btn btn-sm" onClick={copiar}>{copiado ? "Copiado" : "Copiar"}</button>}>
            <details>
              <summary>Ver o código</summary>
              <pre className="s3d-code" tabIndex={0}>{applyParams(scad, values)}</pre>
            </details>
            <p className="muted small">O código roda só no seu aparelho, num espaço isolado. Motor: OpenSCAD (GPL), <a href="/vendor/openscad/README.md">licença e código-fonte</a>.</p>
          </Panel>
        </>
      )}
    </div>
  );
}

function ParamControl({ p, value, onChange }: { p: Param; value: number | boolean | string; onChange: (v: number | boolean | string) => void }) {
  const id = `s3d-p-${p.name}`;
  if (p.kind === "bool") return (
    <label className="s3d-p s3d-p-bool" htmlFor={id}><input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /><span>{p.label}</span></label>
  );
  if (p.kind === "choice") return (
    <label className="s3d-p fld" htmlFor={id}><span>{p.label}</span>
      <select id={id} className="field" value={String(value)} onChange={(e) => onChange(typeof p.options[0] === "number" ? Number(e.target.value) : e.target.value)}>
        {p.options.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
      </select>
    </label>
  );
  return (
    <div className="s3d-p">
      <label htmlFor={id}><span>{p.label}</span><output htmlFor={id}>{f(Number(value))}</output></label>
      <input id={id} type="range" min={p.min} max={p.max} step={p.step} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LISTA_COMPRAS_ATUALIZADA, NOME_ITEM_MAX, type ItemCompra } from "@/lib/lista-compras/types";
import { EmptyState, Field, ModuleScreen, Panel } from "./kit";
import styles from "./ListaComprasPage.module.css";

const API = "/api/lista-compras";

export function ListaComprasPage() {
  const [itens, setItens] = useState<ItemCompra[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const [erroLeitura, setErroLeitura] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    const atualizar = () => {
      setPagina(0);
      setRevisao((n) => n + 1);
    };
    window.addEventListener(LISTA_COMPRAS_ATUALIZADA, atualizar);
    return () => window.removeEventListener(LISTA_COMPRAS_ATUALIZADA, atualizar);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCarregando(true);
    setErroLeitura(false);
    void (async () => {
      try {
        const r = await fetch(`${API}?pagina=${pagina}`, { cache: "no-store", signal: controller.signal });
        if (!r.ok) throw new Error("leitura");
        const dados: { itens: ItemCompra[]; temMais: boolean } = await r.json();
        if (controller.signal.aborted) return;
        if (pagina > 0 && dados.itens.length === 0) {
          setPagina(pagina - 1);
          return;
        }
        setItens(dados.itens);
        setTemMais(dados.temMais);
      } catch {
        if (!controller.signal.aborted) setErroLeitura(true);
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    })();
    return () => controller.abort();
  }, [pagina, revisao]);

  async function gravar(caminho: string, method: "POST" | "PATCH" | "DELETE", mensagem: string, body?: object) {
    setGravando(true);
    setErro("");
    setAviso("");
    try {
      const r = await fetch(caminho, {
        method,
        ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      if (!r.ok) {
        const d: { message?: string } = await r.json().catch(() => ({}));
        setErro(d.message ?? "Não consegui atualizar a lista. Tente de novo.");
        return;
      }
      if (method === "POST") setNome("");
      setAviso(mensagem);
      window.dispatchEvent(new Event(LISTA_COMPRAS_ATUALIZADA));
    } catch {
      setErro("Não consegui atualizar a lista. Confira a conexão e tente de novo.");
    } finally {
      setGravando(false);
    }
  }

  function adicionar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gravando || !nome.trim()) return;
    void gravar(API, "POST", "Item adicionado.", { nome });
  }

  return (
    <ModuleScreen title="Lista de compras" text={<>Diga <q>Coloca café na lista de compras</q> ou adicione abaixo.</>}>
      <Panel title="Adicionar item" icon="plus">
        <form className={styles.form} onSubmit={adicionar}>
          <Field label="O que você precisa comprar?">
            <input required maxLength={NOME_ITEM_MAX} value={nome} onChange={(e) => setNome(e.target.value)} disabled={gravando} />
          </Field>
          <button className="btn btn-pri" disabled={gravando || !nome.trim()}>Adicionar</button>
        </form>
      </Panel>
      <div role="status" className={styles.status}>{aviso}</div>
      {erro && <p role="alert">{erro}</p>}
      <Panel title="Seus itens" icon="check">
        {carregando ? <p role="status">Carregando lista…</p> : erroLeitura ? (
          <EmptyState title="Não consegui abrir a lista" action={<button className="btn" onClick={() => setRevisao((n) => n + 1)}>Tentar de novo</button>} />
        ) : itens.length === 0 ? (
          <EmptyState title="Sua lista está vazia" text="Adicione o primeiro item que você precisa comprar." />
        ) : (
          <ul className={styles.itens}>
            {itens.map((item) => (
              <li className={styles.item} key={item.id} data-comprado={item.comprado}>
                <label className={styles.check}>
                  <input type="checkbox" checked={item.comprado} disabled={gravando}
                    onChange={(e) => void gravar(`${API}/${item.id}`, "PATCH", e.target.checked ? "Item comprado." : "Item voltou aos pendentes.", { comprado: e.target.checked })} />
                  <span>{item.nome}{item.comprado && <small>Comprado</small>}</span>
                </label>
                <button type="button" className="btn" disabled={gravando} aria-label={`Remover ${item.nome}`}
                  onClick={() => void gravar(`${API}/${item.id}`, "DELETE", "Item removido.")}>Remover</button>
              </li>
            ))}
          </ul>
        )}
        {!carregando && !erroLeitura && (pagina > 0 || temMais) && (
          <nav className={styles.paginacao} aria-label="Páginas da lista">
            <button className="btn" disabled={pagina === 0 || gravando} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <button className="btn" disabled={!temMais || gravando} onClick={() => setPagina(pagina + 1)}>Próxima</button>
          </nav>
        )}
      </Panel>
    </ModuleScreen>
  );
}

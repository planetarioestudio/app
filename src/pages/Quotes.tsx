import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Empty,
  Field,
  FormActions,
  PageTitle,
  Section,
} from "../components";
import { createRecord, editRecord } from "../lib/data";
import { nextQuoteVersion, suggestedPrice } from "../lib/domain";
import type { AdminData } from "../lib/types";
import {
  brl,
  dateBR,
  errorMessage,
  escapeHtml,
  moneyInput,
  printDocument,
} from "../lib/utils";
import { serverTimestamp } from "firebase/firestore";

export function QuotesPage({ data }: { data: AdminData }) {
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    projectId: "",
    description: "",
    hours: 1,
    hourlyCost: "0",
    materials: "0",
    other: "0",
    margin: 30,
    price: "",
    deposit: "0",
    validUntil: "",
    terms: "",
  });
  let suggested = 0;
  try {
    suggested = suggestedPrice(
      Number(draft.hours),
      moneyInput(draft.hourlyCost),
      moneyInput(draft.materials),
      moneyInput(draft.other),
      Number(draft.margin),
    );
  } catch {
    /* form displays validation on save */
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const project = data.projects.find((p) => p.id === draft.projectId);
    if (!project) {
      setError("Selecione um projeto.");
      return;
    }
    const priceCents = draft.price ? moneyInput(draft.price) : suggested;
    if (moneyInput(draft.deposit) > priceCents) {
      setError("O sinal não pode superar o preço.");
      return;
    }
    setBusy(true);
    try {
      await createRecord("quotes", {
        projectId: draft.projectId,
        version: nextQuoteVersion(data.quotes, draft.projectId),
        status: "rascunho",
        description: draft.description,
        hours: Number(draft.hours),
        hourlyCostCents: moneyInput(draft.hourlyCost),
        materialsCents: moneyInput(draft.materials),
        otherCents: moneyInput(draft.other),
        marginPercent: Number(draft.margin),
        priceCents,
        depositCents: moneyInput(draft.deposit),
        validUntil: draft.validUntil,
        terms: draft.terms,
      });
      setForm(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="COMERCIAL"
        title="Orçamentos"
        subtitle="Precifique, registre a versão enviada e gere uma cópia para compartilhar."
        action={<Button onClick={() => setForm(true)}>Novo orçamento</Button>}
      />
      {form && (
        <Section title="Precificação e novo orçamento">
          <form className="form-grid" onSubmit={save}>
            <Field label="Projeto *">
              <select
                required
                value={draft.projectId}
                onChange={(e) =>
                  setDraft({ ...draft, projectId: e.target.value })
                }
              >
                <option value="">Selecione</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Horas estimadas">
              <input
                type="number"
                min="0"
                step="0.25"
                value={draft.hours}
                onChange={(e) =>
                  setDraft({ ...draft, hours: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Custo por hora (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.hourlyCost}
                onChange={(e) =>
                  setDraft({ ...draft, hourlyCost: e.target.value })
                }
              />
            </Field>
            <Field label="Materiais (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.materials}
                onChange={(e) =>
                  setDraft({ ...draft, materials: e.target.value })
                }
              />
            </Field>
            <Field label="Outros custos (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.other}
                onChange={(e) => setDraft({ ...draft, other: e.target.value })}
              />
            </Field>
            <Field label="Margem alvo (%)">
              <input
                type="number"
                min="0"
                max="99"
                value={draft.margin}
                onChange={(e) =>
                  setDraft({ ...draft, margin: Number(e.target.value) })
                }
              />
            </Field>
            <div className="form-callout">
              Preço sugerido: <strong>{brl(suggested)}</strong>
            </div>
            <Field
              label="Preço final (R$)"
              hint="Se vazio, usa o preço sugerido."
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </Field>
            <Field label="Sinal previsto (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.deposit}
                onChange={(e) =>
                  setDraft({ ...draft, deposit: e.target.value })
                }
              />
            </Field>
            <Field label="Validade">
              <input
                type="date"
                value={draft.validUntil}
                onChange={(e) =>
                  setDraft({ ...draft, validUntil: e.target.value })
                }
              />
            </Field>
            <Field label="Descrição">
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </Field>
            <Field label="Condições">
              <textarea
                value={draft.terms}
                onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
              />
            </Field>
            {error && <p className="notice error">{error}</p>}
            <FormActions busy={busy} cancel={() => setForm(false)} />
          </form>
        </Section>
      )}
      <Section title="Propostas">
        {data.quotes.length ? (
          <div className="list">
            {[...data.quotes]
              .sort((a, b) => b.version - a.version)
              .map((q) => {
                const p = data.projects.find((p) => p.id === q.projectId);
                return (
                  <a
                    className="list-row"
                    href={`#/orcamentos/${q.id}`}
                    key={q.id}
                  >
                    <div>
                      <strong>
                        {p?.name || "Projeto"} · versão {q.version}
                      </strong>
                      <span>Válido até {q.validUntil || "não definido"}</span>
                    </div>
                    <div className="row-end">
                      <span>{brl(q.priceCents)}</span>
                      <Badge>{q.status}</Badge>
                    </div>
                  </a>
                );
              })}
          </div>
        ) : (
          <Empty>Nenhum orçamento criado.</Empty>
        )}
      </Section>
    </>
  );
}

export function QuoteDetail({
  quoteId,
  data,
}: {
  quoteId: string;
  data: AdminData;
}) {
  const quote = data.quotes.find((q) => q.id === quoteId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!quote) return <Empty>Orçamento não encontrado.</Empty>;
  const project = data.projects.find((p) => p.id === quote.projectId);
  const client = data.clients.find((c) => c.id === project?.clientId);
  async function status(next: string) {
    setBusy(true);
    setError("");
    try {
      await editRecord("quotes", quote!.id, {
        status: next,
        ...(next === "enviado" ? { sentAt: serverTimestamp() } : {}),
        ...(["aprovado", "recusado"].includes(next)
          ? { decidedAt: serverTimestamp() }
          : {}),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  function print() {
    printDocument(
      `Orçamento ${project?.name || ""}`,
      `<h1>Planetário Estúdio</h1><h2>Orçamento · versão ${quote!.version}</h2><p><strong>Cliente:</strong> ${escapeHtml(client?.name || "")}<br><strong>Projeto:</strong> ${escapeHtml(project?.name || "")}</p><hr><p>${escapeHtml(quote!.description || "").replace(/\n/g, "<br>")}</p><p><strong>Valor:</strong> ${brl(quote!.priceCents)}<br><strong>Sinal previsto:</strong> ${brl(quote!.depositCents)}<br><strong>Validade:</strong> ${dateBR(quote!.validUntil)}</p><p><strong>Condições:</strong><br>${escapeHtml(quote!.terms || "").replace(/\n/g, "<br>")}</p><hr><p>Proposta gerada para envio manual. Aceite registrado pelo estúdio.</p>`,
    );
  }
  return (
    <>
      <a className="back-link" href="#/orcamentos">
        ← Orçamentos
      </a>
      <PageTitle
        eyebrow="PROPOSTA"
        title={`${project?.name || "Orçamento"} · v${quote.version}`}
        subtitle={`${client?.name || "Cliente"} · ${quote.status}`}
        action={<Button onClick={print}>Imprimir / salvar PDF</Button>}
      />
      {error && <p className="notice error">{error}</p>}
      <div className="two-col">
        <Section title="Valores">
          <div className="detail-lines">
            <p>
              <span>Custo por hora</span>
              <strong>{brl(quote.hourlyCostCents)}</strong>
            </p>
            <p>
              <span>Materiais</span>
              <strong>{brl(quote.materialsCents)}</strong>
            </p>
            <p>
              <span>Outros custos</span>
              <strong>{brl(quote.otherCents)}</strong>
            </p>
            <p>
              <span>Margem alvo</span>
              <strong>{quote.marginPercent}%</strong>
            </p>
            <p>
              <span>Preço final</span>
              <strong>{brl(quote.priceCents)}</strong>
            </p>
            <p>
              <span>Sinal previsto</span>
              <strong>{brl(quote.depositCents)}</strong>
            </p>
          </div>
        </Section>
        <Section title="Registro do envio">
          <p>
            O envio ao cliente é feito manualmente. Registre aqui a resposta
            recebida.
          </p>
          <div className="button-row">
            {quote.status === "rascunho" && (
              <Button disabled={busy} onClick={() => status("enviado")}>
                Marcar enviado
              </Button>
            )}
            {quote.status === "enviado" && (
              <>
                <Button disabled={busy} onClick={() => status("aprovado")}>
                  Marcar aprovado
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => status("recusado")}
                >
                  Marcar recusado
                </Button>
              </>
            )}
          </div>
          <p>Validade: {dateBR(quote.validUntil)}</p>
        </Section>
      </div>
      <Section title="Descrição e condições">
        <p className="preserve-lines">
          {quote.description || "Sem descrição."}
        </p>
        <hr />
        <p className="preserve-lines">
          {quote.terms || "Sem condições adicionais."}
        </p>
      </Section>
    </>
  );
}

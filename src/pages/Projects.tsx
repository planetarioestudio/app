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
import type { AdminData, Project } from "../lib/types";
import {
  brl,
  dateTimeBR,
  errorMessage,
  moneyInput,
  moneyValue,
} from "../lib/utils";

const statuses = [
  "ideia",
  "orçamento",
  "agendado",
  "em andamento",
  "concluído",
  "cancelado",
];
export function ProjectsPage({ data }: { data: AdminData }) {
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("todos");
  const [draft, setDraft] = useState({
    clientId: "",
    name: "",
    description: "",
    style: "",
    bodyArea: "",
    status: "ideia",
    price: "",
    estimatedMinutes: 60,
    notes: "",
  });
  const shown = data.projects
    .filter((p) => filter === "todos" || p.status === filter)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!data.clients.some((c) => c.id === draft.clientId)) {
      setError("Selecione um cliente.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createRecord("projects", {
        clientId: draft.clientId,
        name: draft.name.trim(),
        description: draft.description,
        style: draft.style,
        bodyArea: draft.bodyArea,
        status: draft.status,
        priceCents: moneyInput(draft.price),
        estimatedMinutes: Number(draft.estimatedMinutes),
        notes: draft.notes,
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
        eyebrow="CRIAÇÃO"
        title="Projetos"
        subtitle="Da primeira ideia ao atendimento concluído."
        action={<Button onClick={() => setForm(true)}>Novo projeto</Button>}
      />
      {form && (
        <Section title="Novo projeto">
          <form className="form-grid" onSubmit={save}>
            <Field label="Cliente *">
              <select
                required
                value={draft.clientId}
                onChange={(e) =>
                  setDraft({ ...draft, clientId: e.target.value })
                }
              >
                <option value="">Selecione</option>
                {data.clients
                  .filter((c) => c.active)
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Nome do projeto *">
              <input
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Estilo">
              <input
                value={draft.style}
                onChange={(e) => setDraft({ ...draft, style: e.target.value })}
              />
            </Field>
            <Field label="Região do corpo">
              <input
                value={draft.bodyArea}
                onChange={(e) =>
                  setDraft({ ...draft, bodyArea: e.target.value })
                }
              />
            </Field>
            <Field label="Valor combinado (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </Field>
            <Field label="Minutos estimados">
              <input
                type="number"
                min="1"
                value={draft.estimatedMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    estimatedMinutes: Number(e.target.value),
                  })
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
            <Field label="Notas">
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
            {error && <p className="notice error">{error}</p>}
            <FormActions busy={busy} cancel={() => setForm(false)} />
          </form>
        </Section>
      )}
      <Section
        title={`${shown.length} projetos`}
        action={
          <select
            aria-label="Filtrar status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="todos">Todos os status</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        }
      >
        {shown.length ? (
          <div className="list">
            {shown.map((p) => {
              const client = data.clients.find((c) => c.id === p.clientId);
              return (
                <a key={p.id} className="list-row" href={`#/projetos/${p.id}`}>
                  <div>
                    <strong>{p.name}</strong>
                    <span>
                      {client?.name || "Cliente"} ·{" "}
                      {p.bodyArea || p.style || "Sem detalhes"}
                    </span>
                  </div>
                  <div className="row-end">
                    <span>{brl(p.priceCents)}</span>
                    <Badge>{p.status}</Badge>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <Empty>Nenhum projeto encontrado.</Empty>
        )}
      </Section>
    </>
  );
}

export function ProjectDetail({
  projectId,
  data,
}: {
  projectId: string;
  data: AdminData;
}) {
  const project = data.projects.find((p) => p.id === projectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!project) return <Empty>Projeto não encontrado.</Empty>;
  const client = data.clients.find((c) => c.id === project.clientId);
  const sessions = data.sessions
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const paid = data.payments
    .filter((p) => p.projectId === projectId && !p.voidedAt)
    .reduce((sum, p) => sum + p.signedAmountCents, 0);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await editRecord("projects", projectId, {
        name: draft.name,
        description: draft.description,
        style: draft.style,
        bodyArea: draft.bodyArea,
        status: draft.status,
        priceCents: draft.priceCents,
        estimatedMinutes: draft.estimatedMinutes,
        notes: draft.notes,
      });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a className="back-link" href="#/projetos">
        ← Projetos
      </a>
      <PageTitle
        eyebrow={client?.name || "PROJETO"}
        title={project.name}
        subtitle={`${project.style || "Tatuagem"} · ${project.bodyArea || "Região não informada"}`}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(project);
              setEditing(true);
            }}
          >
            Editar projeto
          </Button>
        }
      />
      <div className="stats-grid compact">
        <div className="stat-card">
          <span>Valor combinado</span>
          <strong>{brl(project.priceCents)}</strong>
        </div>
        <div className="stat-card">
          <span>Recebido</span>
          <strong>{brl(paid)}</strong>
        </div>
        <div className="stat-card">
          <span>Saldo</span>
          <strong>{brl(project.priceCents - paid)}</strong>
        </div>
        <div className="stat-card">
          <span>Status</span>
          <strong className="small-stat">{project.status}</strong>
        </div>
      </div>
      <div className="two-col">
        <Section title="Detalhes">
          {editing && draft ? (
            <form className="form-grid" onSubmit={save}>
              <Field label="Nome">
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Estilo">
                <input
                  value={draft.style}
                  onChange={(e) =>
                    setDraft({ ...draft, style: e.target.value })
                  }
                />
              </Field>
              <Field label="Região">
                <input
                  value={draft.bodyArea}
                  onChange={(e) =>
                    setDraft({ ...draft, bodyArea: e.target.value })
                  }
                />
              </Field>
              <Field label="Valor (R$)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={moneyValue(draft.priceCents)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      priceCents: moneyInput(e.target.value),
                    })
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
              <Field label="Notas">
                <textarea
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </Field>
              {error && <p className="notice error">{error}</p>}
              <FormActions busy={busy} cancel={() => setEditing(false)} />
            </form>
          ) : (
            <div className="detail-lines">
              <p>
                <span>Cliente</span>
                <a href={`#/clientes/${client?.id}`}>{client?.name || "—"}</a>
              </p>
              <p>
                <span>Descrição</span>
                <strong>{project.description || "—"}</strong>
              </p>
              <p>
                <span>Notas</span>
                <strong>{project.notes || "—"}</strong>
              </p>
            </div>
          )}
        </Section>
        <Section title="Ações">
          <div className="action-links">
            <a href="#/agenda">Agendar sessão →</a>
            <a href="#/orcamentos">Criar orçamento →</a>
            <a href="#/financeiro">Registrar pagamento →</a>
            <a href={`#/clientes/${project.clientId}/anamneses`}>
              Solicitar anamnese →
            </a>
          </div>
        </Section>
      </div>
      <Section title="Sessões">
        {sessions.length ? (
          <div className="list">
            {sessions.map((s) => (
              <div key={s.id} className="list-row">
                <div>
                  <strong>{dateTimeBR(s.startAt)}</strong>
                  <span>
                    {s.status} · {s.plannedMinutes} min planejados
                  </span>
                </div>
                <span>{brl(s.realizedValueCents)}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Nenhuma sessão agendada.</Empty>
        )}
      </Section>
    </>
  );
}

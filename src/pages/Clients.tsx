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
import type { AdminData, Client } from "../lib/types";
import { brl, errorMessage, normalize } from "../lib/utils";

const blank = {
  name: "",
  phone: "",
  email: "",
  instagram: "",
  birthDate: "",
  source: "",
  notes: "",
  active: true,
};

export function ClientsPage({ data }: { data: AdminData }) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(false);
  const [value, setValue] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shown = data.clients
    .filter(
      (c) =>
        normalize(c.name).includes(normalize(search)) ||
        c.phone.includes(search),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createRecord("clients", {
        ...value,
        name: value.name.trim(),
        searchName: normalize(value.name),
      });
      setValue(blank);
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
        eyebrow="RELACIONAMENTO"
        title="Clientes"
        subtitle="Cada pessoa tem um cadastro para reunir projetos e atendimentos."
        action={<Button onClick={() => setForm(true)}>Novo cliente</Button>}
      />
      {form && (
        <Section title="Novo cliente">
          <form onSubmit={save} className="form-grid">
            <Field label="Nome completo *">
              <input
                required
                maxLength={120}
                value={value.name}
                onChange={(e) => setValue({ ...value, name: e.target.value })}
              />
            </Field>
            <Field label="Telefone / WhatsApp">
              <input
                value={value.phone}
                onChange={(e) => setValue({ ...value, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={value.email}
                onChange={(e) => setValue({ ...value, email: e.target.value })}
              />
            </Field>
            <Field label="Instagram">
              <input
                value={value.instagram}
                onChange={(e) =>
                  setValue({ ...value, instagram: e.target.value })
                }
              />
            </Field>
            <Field label="Nascimento">
              <input
                type="date"
                value={value.birthDate}
                onChange={(e) =>
                  setValue({ ...value, birthDate: e.target.value })
                }
              />
            </Field>
            <Field label="Origem do contato">
              <input
                value={value.source}
                onChange={(e) => setValue({ ...value, source: e.target.value })}
              />
            </Field>
            <Field label="Observações">
              <textarea
                value={value.notes}
                onChange={(e) => setValue({ ...value, notes: e.target.value })}
              />
            </Field>
            {error && <p className="notice error">{error}</p>}
            <FormActions busy={busy} cancel={() => setForm(false)} />
          </form>
        </Section>
      )}
      <Section
        title={`${shown.length} clientes`}
        action={
          <input
            className="search"
            placeholder="Buscar nome ou telefone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar cliente"
          />
        }
      >
        {shown.length ? (
          <div className="list">
            {shown.map((c) => (
              <a key={c.id} className="list-row" href={`#/clientes/${c.id}`}>
                <div>
                  <strong>{c.name}</strong>
                  <span>{c.phone || c.email || "Sem contato cadastrado"}</span>
                </div>
                <Badge>{c.active ? "Ativo" : "Arquivado"}</Badge>
              </a>
            ))}
          </div>
        ) : (
          <Empty>Nenhum cliente encontrado.</Empty>
        )}
      </Section>
    </>
  );
}

export function ClientDetail({
  clientId,
  data,
}: {
  clientId: string;
  data: AdminData;
}) {
  const client = data.clients.find((c) => c.id === clientId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Client | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!client) return <Empty>Cliente não encontrado.</Empty>;
  const projects = data.projects.filter((p) => p.clientId === clientId);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await editRecord("clients", clientId, {
        name: draft.name.trim(),
        searchName: normalize(draft.name),
        phone: draft.phone,
        email: draft.email,
        instagram: draft.instagram,
        birthDate: draft.birthDate,
        source: draft.source,
        notes: draft.notes,
        active: draft.active,
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
      <a className="back-link" href="#/clientes">
        ← Clientes
      </a>
      <PageTitle
        eyebrow="CADASTRO"
        title={client.name}
        subtitle={client.phone || client.email || "Sem contato informado"}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(client);
              setEditing(true);
            }}
          >
            Editar cadastro
          </Button>
        }
      />
      <div className="two-col">
        <Section title="Dados do cliente">
          {editing && draft ? (
            <form className="form-grid" onSubmit={save}>
              <Field label="Nome">
                <input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                />
              </Field>
              <Field label="Instagram">
                <input
                  value={draft.instagram}
                  onChange={(e) =>
                    setDraft({ ...draft, instagram: e.target.value })
                  }
                />
              </Field>
              <Field label="Nascimento">
                <input
                  type="date"
                  value={draft.birthDate}
                  onChange={(e) =>
                    setDraft({ ...draft, birthDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Origem">
                <input
                  value={draft.source}
                  onChange={(e) =>
                    setDraft({ ...draft, source: e.target.value })
                  }
                />
              </Field>
              <Field label="Observações">
                <textarea
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </Field>
              <Field label="Ativo">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.checked })
                  }
                />
              </Field>
              {error && <p className="notice error">{error}</p>}
              <FormActions busy={busy} cancel={() => setEditing(false)} />
            </form>
          ) : (
            <div className="detail-lines">
              <p>
                <span>Telefone</span>
                <strong>{client.phone || "—"}</strong>
              </p>
              <p>
                <span>Email</span>
                <strong>{client.email || "—"}</strong>
              </p>
              <p>
                <span>Instagram</span>
                <strong>{client.instagram || "—"}</strong>
              </p>
              <p>
                <span>Origem</span>
                <strong>{client.source || "—"}</strong>
              </p>
              <p>
                <span>Observações</span>
                <strong>{client.notes || "—"}</strong>
              </p>
            </div>
          )}
        </Section>
        <Section
          title="Anamnese"
          action={<a href={`#/clientes/${client.id}/anamneses`}>Abrir →</a>}
        >
          <p>Solicitações e fichas assinadas deste cliente.</p>
          <strong>
            {
              data.anamneseRequests.filter((r) => r.clientId === client.id)
                .length
            }{" "}
            solicitações
          </strong>
        </Section>
      </div>
      <Section
        title="Projetos deste cliente"
        action={<a href="#/projetos">Ver projetos →</a>}
      >
        {projects.length ? (
          <div className="list">
            {projects.map((p) => (
              <a key={p.id} className="list-row" href={`#/projetos/${p.id}`}>
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.bodyArea || p.style || "Sem detalhes"}</span>
                </div>
                <span>{brl(p.priceCents)}</span>
              </a>
            ))}
          </div>
        ) : (
          <Empty>Nenhum projeto vinculado.</Empty>
        )}
      </Section>
    </>
  );
}

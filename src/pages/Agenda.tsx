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
import type { AdminData, Session } from "../lib/types";
import {
  brl,
  dateTimeBR,
  errorMessage,
  localDateTime,
  moneyInput,
  moneyValue,
  today,
  toIso,
} from "../lib/utils";
import { AgendaCalendar } from "./AgendaCalendar";

const statuses = [
  "aguardando",
  "confirmada",
  "em atendimento",
  "concluída",
  "cancelada",
  "não compareceu",
];
const active = (s: Session) =>
  !["cancelada", "não compareceu"].includes(s.status);
export function AgendaPage({ data }: { data: AdminData }) {
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [draft, setDraft] = useState({
    projectId: "",
    startAt: "",
    endAt: "",
    status: "aguardando",
    realizedValue: "",
    notes: "",
  });
  const [edit, setEdit] = useState<Session | null>(null);
  const shown = data.sessions
    .filter((s) => localDateTime(s.startAt).startsWith(month))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  function openEdit(s: Session) {
    setEdit(s);
    setDraft({
      projectId: s.projectId,
      startAt: localDateTime(s.startAt),
      endAt: localDateTime(s.endAt),
      status: s.status,
      realizedValue: moneyValue(s.realizedValueCents),
      notes: s.notes,
    });
    setForm(true);
  }
  function close() {
    setForm(false);
    setEdit(null);
    setDraft({
      projectId: "",
      startAt: "",
      endAt: "",
      status: "aguardando",
      realizedValue: "",
      notes: "",
    });
    setError("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const startAt = toIso(draft.startAt),
      endAt = toIso(draft.endAt);
    if (startAt >= endAt) {
      setError("O fim precisa ser depois do início.");
      return;
    }
    if (
      data.sessions.some(
        (s) =>
          s.id !== edit?.id &&
          active(s) &&
          s.startAt < endAt &&
          s.endAt > startAt,
      ) &&
      !["cancelada", "não compareceu"].includes(draft.status)
    ) {
      setError(
        "Já existe uma sessão neste horário. Ajuste a agenda antes de salvar.",
      );
      return;
    }
    setBusy(true);
    try {
      const payload = {
        projectId: draft.projectId,
        startAt,
        endAt,
        status: draft.status,
        plannedMinutes: Math.round(
          (Date.parse(endAt) - Date.parse(startAt)) / 60000,
        ),
        actualMinutes: edit?.actualMinutes || 0,
        realizedValueCents: moneyInput(draft.realizedValue),
        notes: draft.notes,
      };
      if (edit)
        await editRecord("sessions", edit.id, {
          ...payload,
          history: [
            ...((edit as Session & { history?: unknown[] }).history || []),
            {
              startAt: edit.startAt,
              endAt: edit.endAt,
              changedAt: new Date().toISOString(),
            },
          ],
        });
      else await createRecord("sessions", payload);
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="ATENDIMENTOS"
        title="Agenda"
        subtitle="Organize os horários e acompanhe o estado de cada sessão."
        action={
          <Button
            onClick={() => {
              close();
              setForm(true);
            }}
          >
            Nova sessão
          </Button>
        }
      />
      {form && (
        <Section title={edit ? "Editar sessão" : "Nova sessão"}>
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
                {data.projects
                  .filter((p) => p.status !== "cancelado")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ·{" "}
                      {data.clients.find((c) => c.id === p.clientId)?.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Início *">
              <input
                type="datetime-local"
                required
                value={draft.startAt}
                onChange={(e) =>
                  setDraft({ ...draft, startAt: e.target.value })
                }
              />
            </Field>
            <Field label="Fim *">
              <input
                type="datetime-local"
                required
                value={draft.endAt}
                onChange={(e) => setDraft({ ...draft, endAt: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor realizado (R$)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={draft.realizedValue}
                onChange={(e) =>
                  setDraft({ ...draft, realizedValue: e.target.value })
                }
              />
            </Field>
            <Field label="Notas">
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <FormActions busy={busy} cancel={close} />
          </form>
        </Section>
      )}
      <AgendaCalendar
        sessions={data.sessions}
        month={month}
        setMonth={setMonth}
        onEdit={openEdit}
      />
      <Section
        title="Sessões"
        action={
          <Field label="Mês">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
        }
      >
        {shown.length ? (
          <div className="list">
            {shown.map((s) => {
              const p = data.projects.find((p) => p.id === s.projectId);
              const c = data.clients.find((c) => c.id === p?.clientId);
              return (
                <div className="list-row" key={s.id}>
                  <div>
                    <strong>
                      {dateTimeBR(s.startAt)} · {c?.name || "Cliente"}
                    </strong>
                    <span>
                      {p?.name || "Projeto"} · {brl(s.realizedValueCents)}
                    </span>
                  </div>
                  <div className="row-end">
                    <Badge>{s.status}</Badge>
                    <Button variant="quiet" onClick={() => openEdit(s)}>
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>Nenhuma sessão neste mês.</Empty>
        )}
      </Section>
    </>
  );
}

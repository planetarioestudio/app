import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { Badge, Button, Empty, Field, Section } from "../components";
import { getRecord } from "../lib/data";
import {
  createInitialRequest,
  portalProjectTotals,
  registerClient,
  updatePortalContact,
  watchPortal,
  type PortalData,
  type Registration,
} from "../lib/portal";
import type { AnamneseSubmission, ClientAccess } from "../lib/types";
import { brl, dateBR, errorMessage } from "../lib/utils";

export function RegistrationPage({
  user,
  onRegistered,
  returnTo,
}: {
  user: User;
  onRegistered: (access: ClientAccess) => void;
  returnTo?: string;
}) {
  const [value, setValue] = useState<Registration>({
    name: user.displayName || "",
    birthDate: "",
    phone: "",
    instagram: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const access = await registerClient(user, value);
      onRegistered(access);
      location.hash = `#${returnTo || "/cliente"}`;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="client-form">
      <span className="eyebrow">ÁREA DO CLIENTE</span>
      <h1>Faça seu cadastro</h1>
      <p>
        Confirme seus dados para acompanhar seus projetos e preencher sua
        anamnese.
      </p>
      <form onSubmit={submit} className="form-grid">
        <Field label="Nome completo *">
          <input
            required
            maxLength={120}
            autoComplete="name"
            value={value.name}
            onChange={(event) =>
              setValue({ ...value, name: event.target.value })
            }
          />
        </Field>
        <Field label="Data de nascimento *">
          <input
            required
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={value.birthDate}
            onChange={(event) =>
              setValue({ ...value, birthDate: event.target.value })
            }
          />
        </Field>
        <Field label="WhatsApp *">
          <input
            required
            type="tel"
            autoComplete="tel"
            maxLength={30}
            value={value.phone}
            onChange={(event) =>
              setValue({ ...value, phone: event.target.value })
            }
          />
        </Field>
        <Field label="E-mail verificado pelo Google">
          <input type="email" value={user.email || ""} disabled />
        </Field>
        <Field label="Instagram (opcional)">
          <input
            maxLength={100}
            value={value.instagram}
            onChange={(event) =>
              setValue({ ...value, instagram: event.target.value })
            }
          />
        </Field>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="submit" disabled={busy}>
            {busy ? "Cadastrando…" : "Cadastrar-se"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ClientPortalPage({
  user,
  access,
  route,
}: {
  user: User;
  access: ClientAccess;
  route: string;
}) {
  const [data, setData] = useState<PortalData | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const requests = data?.requests;
  useEffect(
    () =>
      watchPortal(access.id, access.clientId, setData, (err) =>
        setError(errorMessage(err)),
      ),
    [access.id, access.clientId],
  );
  useEffect(() => {
    if (!data?.profile) return;
    setPhone(data.profile.phone);
    setInstagram(data.profile.instagram);
  }, [data?.profile?.phone, data?.profile?.instagram, data?.profile]);
  useEffect(() => {
    if (!requests) return;
    let cancelled = false;
    Promise.all(
      requests.map(async (request) => ({
        id: request.id,
        signed: !!(await getRecord<AnamneseSubmission>(
          "anamneseSubmissions",
          request.id,
        )),
      })),
    )
      .then((results) => {
        if (!cancelled)
          setAnswered(
            new Set(
              results.filter((item) => item.signed).map((item) => item.id),
            ),
          );
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [requests]);
  async function startInitial() {
    setBusy(true);
    setError("");
    try {
      const id = await createInitialRequest(user, access.clientId);
      location.hash = `#/anamnese/${id}`;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function saveContact(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updatePortalContact(access.clientId, phone, instagram);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <div className="client-welcome">Carregando sua área…</div>;
  if (!data.profile)
    return (
      <div className="client-welcome">
        Seu cadastro está em preparação. Contate o estúdio.
      </div>
    );
  const initialDone =
    !!data.profile.initialSignedAt || answered.has(`initial_${user.uid}`);
  const pending = data.requests.filter(
    (request) =>
      request.status !== "revogada" &&
      (!request.expiresAt || request.expiresAt.toMillis() > Date.now()) &&
      !answered.has(request.id),
  );
  const initialPending = pending.find((request) => request.kind === "initial");
  const section = route.split("/")[2] || "inicio";
  return (
    <>
      <div
        className="button-row"
        role="navigation"
        aria-label="Área do cliente"
      >
        {[
          ["inicio", "Início"],
          ["projetos", "Projetos"],
          ["financeiro", "Financeiro"],
          ["dados", "Meus dados"],
        ].map(([path, label]) => (
          <a
            key={path}
            className={section === path ? "button primary" : "button secondary"}
            href={`#/cliente/${path}`}
          >
            {label}
          </a>
        ))}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {section === "inicio" && (
        <>
          <div className="client-welcome">
            <span className="eyebrow">ÁREA DO CLIENTE</span>
            <h1>Olá, {data.profile.name}.</h1>
            {initialPending || !initialDone ? (
              <>
                <h2>Preencha sua anamnese</h2>
                <p>
                  Antes do atendimento, responda sua ficha e confirme o aceite
                  com sua conta Google.
                </p>
                <Button
                  onClick={() =>
                    initialPending
                      ? (location.hash = `#/anamnese/${initialPending.id}`)
                      : startInitial()
                  }
                  disabled={busy}
                >
                  {busy ? "Abrindo…" : "Preencher anamnese"}
                </Button>
              </>
            ) : (
              <p>Sua anamnese inicial foi recebida.</p>
            )}
          </div>
          {pending.filter((request) => request.kind !== "initial").length >
            0 && (
            <Section title="Anamnese pendente">
              {pending
                .filter((request) => request.kind !== "initial")
                .map((request) => (
                  <p key={request.id}>
                    <a href={`#/anamnese/${request.id}`}>
                      Preencher ficha solicitada pelo estúdio →
                    </a>
                  </p>
                ))}
            </Section>
          )}
          <Section title="Seus projetos">
            {data.projects.length ? (
              <p>
                Você acompanha {data.projects.length} projeto(s) nesta área.
              </p>
            ) : (
              <Empty>
                Seus projetos aparecerão aqui quando forem criados pelo estúdio.
              </Empty>
            )}
            <a href="#/cliente/projetos">Ver projetos →</a>
          </Section>
        </>
      )}
      {section === "projetos" && (
        <Section title="Seus projetos">
          {data.projects.length ? (
            data.projects.map((project) => {
              const totals = portalProjectTotals(project, data.payments);
              return (
                <div className="request-card" key={project.id}>
                  <div className="list-row">
                    <div>
                      <strong>{project.name}</strong>
                      <span>
                        {project.style || project.bodyArea || "Tatuagem"}
                      </span>
                    </div>
                    <Badge>{project.status}</Badge>
                  </div>
                  {project.description && <p>{project.description}</p>}
                  <p className="request-meta">
                    Valor combinado: {brl(project.priceCents)} · Pago:{" "}
                    {brl(totals.paid)} · Falta: {brl(totals.remaining)}
                  </p>
                </div>
              );
            })
          ) : (
            <Empty>Nenhum projeto vinculado ainda.</Empty>
          )}
        </Section>
      )}
      {section === "financeiro" && (
        <>
          <Section title="Resumo financeiro">
            {data.projects.length ? (
              data.projects.map((project) => {
                const totals = portalProjectTotals(project, data.payments);
                return (
                  <div className="request-card" key={project.id}>
                    <strong>{project.name}</strong>
                    <p className="request-meta">
                      Valor combinado: {brl(project.priceCents)} · Pago:{" "}
                      {brl(totals.paid)} · Falta: {brl(totals.remaining)}
                    </p>
                  </div>
                );
              })
            ) : (
              <Empty>Nenhum valor de projeto registrado ainda.</Empty>
            )}
          </Section>
          <Section title="Pagamentos">
            {data.payments.filter((payment) => !payment.voided).length ? (
              <div className="list">
                {data.payments
                  .filter((payment) => !payment.voided)
                  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                  .map((payment) => (
                    <div className="list-row" key={payment.id}>
                      <div>
                        <strong>{payment.kind}</strong>
                        <span>
                          {data.projects.find(
                            (project) => project.id === payment.projectId,
                          )?.name || "Projeto"}{" "}
                          · {dateBR(payment.occurredAt)} · {payment.method}
                        </span>
                      </div>
                      <strong>{brl(payment.signedAmountCents)}</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <Empty>Nenhum pagamento registrado ainda.</Empty>
            )}
          </Section>
        </>
      )}
      {section === "dados" && (
        <Section title="Meus dados">
          <form className="form-grid" onSubmit={saveContact}>
            <Field label="Nome completo">
              <input value={data.profile.name} disabled />
            </Field>
            <Field label="Data de nascimento">
              <input value={dateBR(data.profile.birthDate)} disabled />
            </Field>
            <Field label="E-mail Google">
              <input value={user.email || ""} disabled />
            </Field>
            <Field label="WhatsApp *">
              <input
                required
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
            <Field label="Instagram">
              <input
                value={instagram}
                onChange={(event) => setInstagram(event.target.value)}
              />
            </Field>
            <div className="form-actions">
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Salvar contato"}
              </Button>
            </div>
          </form>
        </Section>
      )}
    </>
  );
}

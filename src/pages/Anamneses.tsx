import { useEffect, useState, type FormEvent } from "react";
import { reauthenticateWithPopup, type User } from "firebase/auth";
import {
  Badge,
  Button,
  Empty,
  Field,
  FormActions,
  PageTitle,
  Section,
} from "../components";
import {
  createAnamneseRequest,
  createFixedRecord,
  editRecord,
  getAccess,
  getRecord,
  linkClient,
  publishTemplate,
  revokeClient,
  submitAnamnese,
} from "../lib/data";
import { googleProvider } from "../lib/firebase";
import { missingRequiredAnswer, visibleAnswers } from "../lib/domain";
import type {
  AdminData,
  AnamneseRequest,
  AnamneseSubmission,
  ClientAccess,
  FormQuestion,
  FormTemplate,
} from "../lib/types";
import {
  dateBR,
  dateTimeBR,
  errorMessage,
  escapeHtml,
  printDocument,
  toIso,
} from "../lib/utils";

function submissionHtml(
  sub: AnamneseSubmission,
  template: FormTemplate,
  clientName: string,
) {
  return `<h1>Planetário Estúdio</h1><h2>Anamnese e aceite eletrônico</h2><p><strong>Cliente:</strong> ${escapeHtml(clientName)}<br><strong>Conta Google:</strong> ${escapeHtml(sub.googleEmail)}<br><strong>UID:</strong> ${escapeHtml(sub.googleUid)}<br><strong>Protocolo:</strong> ${escapeHtml(sub.requestId)}<br><strong>Autenticação Google:</strong> ${dateTimeBR(new Date(sub.authTimeSeconds * 1000).toISOString())}<br><strong>Envio:</strong> ${dateTimeBR(sub.signedAt)}</p><hr><h3>Respostas</h3>${template.questions.map((q) => `<p><strong>${escapeHtml(q.label)}</strong><br>${escapeHtml(sub.answers[q.id] || "Sem resposta")}</p>${q.followUp && sub.answers[q.id] === q.followUp.when ? `<p><strong>${escapeHtml(q.followUp.label)}</strong><br>${escapeHtml(sub.answers[q.followUp.id] || "Sem resposta")}</p>` : ""}`).join("")}<hr><h3>Termo do procedimento · versão ${template.version}</h3><p>${escapeHtml(template.procedureTerm).replace(/\n/g, "<br>")}</p><p><strong>Aceite explícito:</strong> ${sub.procedureAccepted ? "Sim" : "Não"}</p><h3>Uso de imagem</h3><p>${escapeHtml(template.imageConsentTerm).replace(/\n/g, "<br>")}</p><p><strong>Autorizou:</strong> ${sub.imageUseAccepted ? "Sim" : "Não"}</p><hr><p>Registro associado a uma conta Google autenticada. A adequação jurídica do termo e da forma de aceite deve ser avaliada antes do uso real.</p>`;
}

function TemplateEditor({ data }: { data: AdminData }) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [term, setTerm] = useState("");
  const [imageTerm, setImageTerm] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latest = [...data.formTemplates].sort(
    (a, b) => b.version - a.version,
  )[0];
  const versions = [...data.formTemplates].sort(
    (a, b) => b.version - a.version,
  );
  function loadTemplate(template?: FormTemplate) {
    setSourceId(template?.id || "");
    setQuestions(
      template?.questions.map((q) => ({
        ...q,
        ...(q.followUp ? { followUp: { ...q.followUp } } : {}),
      })) || [],
    );
    setTerm(template?.procedureTerm || "");
    setImageTerm(template?.imageConsentTerm || "");
    setReviewed(false);
    setError("");
  }
  function changeQuestion(id: string, change: Partial<FormQuestion>) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...change } : question,
      ),
    );
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!reviewed) {
      setError(
        "Confirme a revisão do texto e das perguntas antes de publicar.",
      );
      return;
    }
    if (
      !questions.length ||
      questions.some(
        (q) =>
          !q.label.trim() ||
          (q.followUp && (!q.followUp.label.trim() || q.type !== "yesno")),
      )
    ) {
      setError("Inclua perguntas com rótulos completos.");
      return;
    }
    if (questions.reduce((count, q) => count + (q.followUp ? 2 : 1), 0) > 40) {
      setError("O modelo aceita até 40 perguntas, incluindo subrespostas.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await publishTemplate(
        {
          questions: questions.map((q) => ({
            id: q.id,
            label: q.label.trim(),
            required: q.required,
            type: q.type,
            ...(q.followUp
              ? { followUp: { ...q.followUp, label: q.followUp.label.trim() } }
              : {}),
          })),
          procedureTerm: term.trim(),
          imageConsentTerm: imageTerm.trim(),
        },
        (latest?.version || 0) + 1,
      );
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section
      title="Modelo da anamnese"
      action={
        <Button
          variant="secondary"
          onClick={() => {
            if (!open) loadTemplate(latest);
            setOpen(!open);
          }}
        >
          {open ? "Fechar" : latest ? "Criar nova versão" : "Criar modelo"}
        </Button>
      }
    >
      {latest ? (
        <p>
          Versão publicada: <strong>{latest.version}</strong> ·{" "}
          {latest.questions.length} perguntas. Versões enviadas permanecem
          intactas.
        </p>
      ) : (
        <Empty>
          Nenhum modelo publicado. Revise o conteúdo jurídico e sanitário antes
          de coletar respostas reais.
        </Empty>
      )}
      {open && (
        <form onSubmit={save} className="form-grid">
          {versions.length > 0 && (
            <Field label="Editar a partir do modelo publicado">
              <select
                value={sourceId}
                onChange={(e) =>
                  loadTemplate(
                    versions.find((version) => version.id === e.target.value),
                  )
                }
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    Versão {version.version} · {dateTimeBR(version.publishedAt)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {versions.length > 0 && (
            <p className="full request-meta">
              As alterações serão publicadas como versão{" "}
              {(latest?.version || 0) + 1}. As fichas já assinadas permanecem
              vinculadas ao modelo original.
            </p>
          )}
          <div className="full">
            <h3>Perguntas</h3>
            {questions.map((q, index) => (
              <div className="question-editor" key={q.id}>
                <Field label={`Pergunta ${index + 1}`}>
                  <input
                    required
                    value={q.label}
                    onChange={(e) =>
                      changeQuestion(q.id, { label: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tipo">
                  <select
                    value={q.type}
                    onChange={(e) =>
                      changeQuestion(q.id, {
                        type: e.target.value as FormQuestion["type"],
                        ...(e.target.value === "text"
                          ? { followUp: undefined }
                          : {}),
                      })
                    }
                  >
                    <option value="yesno">Sim / não</option>
                    <option value="text">Texto</option>
                  </select>
                </Field>
                <Field label="Obrigatória">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) =>
                      changeQuestion(q.id, { required: e.target.checked })
                    }
                  />
                </Field>
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() =>
                    setQuestions(questions.filter((item) => item.id !== q.id))
                  }
                >
                  Remover
                </Button>
                {q.type === "yesno" && (
                  <label className="check-row full">
                    <input
                      type="checkbox"
                      checked={!!q.followUp}
                      onChange={(e) =>
                        changeQuestion(q.id, {
                          followUp: e.target.checked
                            ? {
                                id: crypto.randomUUID(),
                                when: "Sim",
                                label: "",
                                required: true,
                                type: "text",
                              }
                            : undefined,
                        })
                      }
                    />
                    Subresposta condicional
                  </label>
                )}
                {q.followUp && (
                  <div className="full form-grid">
                    <Field label="Se responder">
                      <select
                        value={q.followUp.when}
                        onChange={(e) =>
                          changeQuestion(q.id, {
                            followUp: {
                              ...q.followUp!,
                              when: e.target.value as "Sim" | "Não",
                            },
                          })
                        }
                      >
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                      </select>
                    </Field>
                    <Field label="Perguntar">
                      <input
                        required
                        value={q.followUp.label}
                        onChange={(e) =>
                          changeQuestion(q.id, {
                            followUp: { ...q.followUp!, label: e.target.value },
                          })
                        }
                      />
                    </Field>
                    <Field label="Tipo da subresposta">
                      <select
                        value={q.followUp.type}
                        onChange={(e) =>
                          changeQuestion(q.id, {
                            followUp: {
                              ...q.followUp!,
                              type: e.target.value as FormQuestion["type"],
                            },
                          })
                        }
                      >
                        <option value="text">Texto</option>
                        <option value="yesno">Sim / não</option>
                      </select>
                    </Field>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={q.followUp.required}
                        onChange={(e) =>
                          changeQuestion(q.id, {
                            followUp: {
                              ...q.followUp!,
                              required: e.target.checked,
                            },
                          })
                        }
                      />
                      Subresposta obrigatória
                    </label>
                  </div>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setQuestions([
                  ...questions,
                  {
                    id: crypto.randomUUID(),
                    label: "",
                    required: true,
                    type: "yesno",
                  },
                ])
              }
            >
              Adicionar pergunta
            </Button>
          </div>
          <Field label="Termo do procedimento *">
            <textarea
              required
              rows={9}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </Field>
          <Field label="Texto da autorização de imagem *">
            <textarea
              required
              rows={6}
              value={imageTerm}
              onChange={(e) => setImageTerm(e.target.value)}
            />
          </Field>
          <label className="check-row">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />{" "}
            Revisei este texto e estas perguntas. Para testes, usarei apenas
            dados fictícios; antes de atender clientes reais, validarei o
            conteúdo jurídico e sanitário.
          </label>
          {error && <p className="notice error">{error}</p>}
          <FormActions
            busy={busy}
            label="Publicar versão"
            cancel={() => setOpen(false)}
          />
        </form>
      )}
    </Section>
  );
}

export function AnamnesesPage({
  data,
  ownerUid,
}: {
  data: AdminData;
  ownerUid: string;
}) {
  const [linkUid, setLinkUid] = useState("");
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function link(e: FormEvent) {
    e.preventDefault();
    const pending = data.pendingAccounts.find((p) => p.uid === linkUid);
    if (!pending || !clientId) return;
    if (
      !window.confirm(
        `Vincular ${pending.verifiedGoogleEmail} ao cadastro ${data.clients.find((c) => c.id === clientId)?.name}? Confira a conta com o cliente antes de continuar.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await linkClient(
        linkUid,
        clientId,
        pending.verifiedGoogleEmail,
        ownerUid,
      );
      setLinkUid("");
      setClientId("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(uid: string) {
    if (!window.confirm("Revogar o acesso desta conta?")) return;
    setBusy(true);
    try {
      await revokeClient(uid);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const unrevised = data.anamneseSubmissions.filter(
    (s) => !data.anamneseReviews.some((r) => r.id === s.id),
  );
  return (
    <>
      <PageTitle
        eyebrow="ATENDIMENTO"
        title="Anamneses"
        subtitle="Controle o vínculo Google, modelos, solicitações e revisão das fichas."
      />
      <div className="notice warning">
        Antes de receber respostas reais, valide perguntas, termos, retenção,
        menores e regras sanitárias locais. Login Google registra um aceite
        eletrônico, sem comprovar identidade civil por si só.
      </div>
      <TemplateEditor data={data} />
      <div className="two-col">
        <Section title="Contas aguardando vínculo">
          {data.pendingAccounts.filter(
            (p) => !data.clientAccess.some((a) => a.id === p.uid && a.active),
          ).length ? (
            <>
              <div className="list">
                {data.pendingAccounts
                  .filter(
                    (p) =>
                      !data.clientAccess.some(
                        (a) => a.id === p.uid && a.active,
                      ),
                  )
                  .map((p) => (
                    <div className="list-row" key={p.uid}>
                      <div>
                        <strong>{p.verifiedGoogleEmail}</strong>
                        <span>UID: {p.uid}</span>
                      </div>
                      <Button variant="quiet" onClick={() => setLinkUid(p.uid)}>
                        Vincular
                      </Button>
                    </div>
                  ))}
              </div>
              {linkUid && (
                <form onSubmit={link} className="form-grid">
                  <p className="full">
                    Conta:{" "}
                    <strong>
                      {
                        data.pendingAccounts.find((p) => p.uid === linkUid)
                          ?.verifiedGoogleEmail
                      }
                    </strong>
                  </p>
                  <Field label="Cliente conferido *">
                    <select
                      required
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {data.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button type="submit" disabled={busy}>
                    Aprovar vínculo
                  </Button>
                </form>
              )}
            </>
          ) : (
            <Empty>Nenhuma conta pendente.</Empty>
          )}
        </Section>
        <Section title="Contas vinculadas">
          {data.clientAccess.length ? (
            <div className="list">
              {data.clientAccess.map((a) => (
                <div className="list-row" key={a.id}>
                  <div>
                    <strong>
                      {data.clients.find((c) => c.id === a.clientId)?.name ||
                        "Cliente"}
                    </strong>
                    <span>
                      {a.verifiedGoogleEmail} ·{" "}
                      {a.active ? "ativo" : "revogado"}
                    </span>
                  </div>
                  {a.active && (
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onClick={() => revoke(a.id)}
                    >
                      Revogar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty>Nenhum vínculo aprovado.</Empty>
          )}
        </Section>
      </div>
      {error && <p className="notice error">{error}</p>}
      <Section title="Fichas para revisar">
        {unrevised.length ? (
          <div className="list">
            {unrevised.map((s) => (
              <a
                className="list-row"
                href={`#/clientes/${s.clientId}/anamneses`}
                key={s.id}
              >
                <div>
                  <strong>
                    {data.clients.find((c) => c.id === s.clientId)?.name ||
                      "Cliente"}
                  </strong>
                  <span>Enviada em {dateTimeBR(s.signedAt)}</span>
                </div>
                <Badge>Pendente de revisão</Badge>
              </a>
            ))}
          </div>
        ) : (
          <Empty>Nenhuma ficha aguardando revisão.</Empty>
        )}
      </Section>
      <Section title="Solicitações">
        {data.anamneseRequests.length ? (
          <div className="list">
            {data.anamneseRequests.map((r) => (
              <a
                className="list-row"
                href={`#/clientes/${r.clientId}/anamneses`}
                key={r.id}
              >
                <div>
                  <strong>
                    {data.clients.find((c) => c.id === r.clientId)?.name ||
                      "Cliente"}
                  </strong>
                  <span>Prazo {dateBR(r.expiresAt)}</span>
                </div>
                <Badge>
                  {data.anamneseSubmissions.some((s) => s.id === r.id)
                    ? "Respondida"
                    : r.status}
                </Badge>
              </a>
            ))}
          </div>
        ) : (
          <Empty>Solicite uma anamnese no cadastro do cliente.</Empty>
        )}
      </Section>
    </>
  );
}

export function ClientAnamnesePage({
  clientId,
  data,
  ownerUid,
}: {
  clientId: string;
  data: AdminData;
  ownerUid: string;
}) {
  const client = data.clients.find((c) => c.id === clientId);
  const [projectId, setProjectId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  if (!client) return <Empty>Cliente não encontrado.</Empty>;
  const access = data.clientAccess.find(
    (a) => a.clientId === clientId && a.active,
  );
  const latest = [...data.formTemplates].sort(
    (a, b) => b.version - a.version,
  )[0];
  const requests = data.anamneseRequests
    .filter((r) => r.clientId === clientId)
    .sort((a, b) => b.expiresAt.toMillis() - a.expiresAt.toMillis());
  async function create(e: FormEvent) {
    e.preventDefault();
    if (!access || !latest) {
      setError("Vincule a conta e publique o modelo primeiro.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const ref = await createAnamneseRequest({
        clientId,
        projectId,
        assignedUid: access.id,
        templateId: latest.id,
        expiresAt: toIso(`${expiresAt}T23:59`),
      });
      setCopied(ref.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function copy(id: string) {
    await navigator.clipboard.writeText(
      `${location.href.split("#")[0]}#/anamnese/${id}`,
    );
    setCopied(id);
  }
  async function review(id: string, outcome: string) {
    const note = window.prompt("Observação da revisão (opcional):") || "";
    setBusy(true);
    setError("");
    try {
      await createFixedRecord("anamneseReviews", id, {
        reviewerUid: ownerUid,
        reviewedAt: serverTimestamp(),
        outcome,
        note,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    if (!window.confirm("Revogar esta solicitação?")) return;
    try {
      await editRecord("anamneseRequests", id, { status: "revogada" });
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <>
      <a className="back-link" href={`#/clientes/${clientId}`}>
        ← {client.name}
      </a>
      <PageTitle
        eyebrow="FICHA DO CLIENTE"
        title="Anamnese"
        subtitle={`${client.name} · respostas e revisões preservadas por versão`}
      />
      <div className="two-col">
        <Section title="Criar solicitação">
          {!access && (
            <p className="notice warning">
              A conta Google deste cliente ainda não foi vinculada. Faça o
              vínculo em <a href="#/anamneses">Anamneses</a>.
            </p>
          )}
          {!latest && (
            <p className="notice warning">
              Publique um modelo de perguntas e termos antes de solicitar.
            </p>
          )}
          <form className="form-grid" onSubmit={create}>
            <Field label="Projeto *">
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Selecione</option>
                {data.projects
                  .filter((p) => p.clientId === clientId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Válida até *">
              <input
                required
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy || !access || !latest}>
              Criar link
            </Button>
          </form>
          {copied && (
            <p className="notice success">
              Solicitação criada.{" "}
              <Button variant="quiet" onClick={() => copy(copied)}>
                Copiar link do cliente
              </Button>
            </p>
          )}
        </Section>
        <Section title="Conta vinculada">
          {access ? (
            <div className="detail-lines">
              <p>
                <span>Email Google</span>
                <strong>{access.verifiedGoogleEmail}</strong>
              </p>
              <p>
                <span>UID</span>
                <strong className="break">{access.id}</strong>
              </p>
            </div>
          ) : (
            <Empty>Sem conta vinculada.</Empty>
          )}
        </Section>
      </div>
      {error && <p className="notice error">{error}</p>}
      <Section title="Histórico">
        {requests.length ? (
          <div className="list">
            {requests.map((r) => {
              const sub = data.anamneseSubmissions.find((s) => s.id === r.id);
              const template = data.formTemplates.find(
                (t) => t.id === r.templateId,
              );
              const reviewData = data.anamneseReviews.find(
                (x) => x.id === r.id,
              );
              return (
                <div className="request-card" key={r.id}>
                  <div className="list-row">
                    <div>
                      <strong>
                        {data.projects.find((p) => p.id === r.projectId)
                          ?.name || "Projeto"}
                      </strong>
                      <span>
                        {template
                          ? `Atualizada em ${dateTimeBR(template.publishedAt)}`
                          : "Modelo indisponível"}{" "}
                        · prazo {dateTimeBR(r.expiresAt)}
                      </span>
                    </div>
                    <Badge>
                      {reviewData ? "Revisada" : sub ? "Respondida" : r.status}
                    </Badge>
                  </div>
                  <div className="button-row">
                    {!sub && r.status !== "revogada" && (
                      <>
                        <Button variant="quiet" onClick={() => copy(r.id)}>
                          Copiar link
                        </Button>
                        <Button variant="quiet" onClick={() => revoke(r.id)}>
                          Revogar
                        </Button>
                      </>
                    )}
                    {sub && template && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          printDocument(
                            `Anamnese ${client.name}`,
                            submissionHtml(sub, template, client.name),
                          )
                        }
                      >
                        Imprimir ficha
                      </Button>
                    )}
                    {sub && !reviewData && (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() => review(r.id, "revisada")}
                        >
                          Marcar revisada
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => review(r.id, "esclarecimento")}
                        >
                          Pedir esclarecimento
                        </Button>
                      </>
                    )}
                  </div>
                  {sub && (
                    <p className="request-meta">
                      Assinada por {sub.googleEmail} em{" "}
                      {dateTimeBR(sub.signedAt)}. Uso de imagem:{" "}
                      {sub.imageUseAccepted ? "autorizado" : "não autorizado"}.
                    </p>
                  )}
                  {reviewData && (
                    <p className="request-meta">
                      Revisão: {reviewData.outcome} ·{" "}
                      {reviewData.note || "sem nota"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>Nenhuma solicitação para este cliente.</Empty>
        )}
      </Section>
    </>
  );
}

import { serverTimestamp } from "firebase/firestore";

export function PublicAnamnese({
  requestId,
  user,
  access,
  onAccessChange,
}: {
  requestId: string;
  user: User;
  access: ClientAccess | null;
  onAccessChange: (access: ClientAccess | null) => void;
}) {
  const [request, setRequest] = useState<AnamneseRequest | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [submission, setSubmission] = useState<AnamneseSubmission | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [procedureAccepted, setProcedureAccepted] = useState(false);
  const [imageUseAccepted, setImageUseAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const currentAccess = await getAccess(user.uid);
        if (cancelled) return;
        onAccessChange(currentAccess);
        if (!currentAccess?.active) {
          setLoading(false);
          return;
        }
        const r = await getRecord<AnamneseRequest>(
          "anamneseRequests",
          requestId,
        );
        if (!r)
          throw new Error(
            "Solicitação indisponível. Confira o link ou contate o estúdio.",
          );
        const [t, s] = await Promise.all([
          getRecord<FormTemplate>("formTemplates", r.templateId),
          getRecord<AnamneseSubmission>("anamneseSubmissions", requestId),
        ]);
        if (cancelled) return;
        setRequest(r);
        setTemplate(t);
        setSubmission(s);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [requestId, user.uid, onAccessChange]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!request || !template || !procedureAccepted) return;
    if (missingRequiredAnswer(template.questions, answers)) {
      setError("Responda às perguntas obrigatórias.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await reauthenticateWithPopup(user, googleProvider);
      if (result.user.uid !== user.uid)
        throw new Error("A conta usada na confirmação é diferente.");
      await submitAnamnese(
        user,
        request,
        template,
        visibleAnswers(template.questions, answers),
        imageUseAccepted,
      );
      setSubmission(
        await getRecord<AnamneseSubmission>("anamneseSubmissions", requestId),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return <div className="client-welcome">Carregando sua solicitação…</div>;
  if (!access?.active)
    return (
      <div className="client-welcome">
        <span className="eyebrow">ACESSO PENDENTE</span>
        <h1>Confirme sua conta com o estúdio</h1>
        <p>
          A conta <strong>{user.email}</strong> ainda não está vinculada ao seu
          cadastro. Envie esse email ao estúdio e volte a abrir o link depois da
          confirmação.
        </p>
      </div>
    );
  if (error && !request)
    return (
      <div className="client-welcome">
        <h1>Não foi possível abrir a ficha</h1>
        <p className="notice error">{error}</p>
      </div>
    );
  if (!request || !template)
    return (
      <div className="client-welcome">
        Solicitação indisponível. Contate o estúdio.
      </div>
    );
  if (submission)
    return (
      <div className="client-form">
        <span className="eyebrow">ENVIO CONCLUÍDO</span>
        <h1>Recebemos sua anamnese</h1>
        <p>
          Seu protocolo é <strong>{submission.requestId}</strong>. A ficha foi
          vinculada à conta {submission.googleEmail} e não pode ser editada após
          o envio.
        </p>
        <p>Enviada em {dateTimeBR(submission.signedAt)}.</p>
        <Button
          onClick={() =>
            printDocument(
              "Minha anamnese",
              submissionHtml(
                submission,
                template,
                user.displayName || user.email || "Cliente",
              ),
            )
          }
        >
          Imprimir minha cópia
        </Button>
      </div>
    );
  if (
    request.status === "revogada" ||
    request.expiresAt.toMillis() < Date.now()
  )
    return (
      <div className="client-welcome">
        <h1>Solicitação encerrada</h1>
        <p>Peça um novo link ao estúdio.</p>
      </div>
    );
  return (
    <div className="client-form">
      <span className="eyebrow">
        ANAMNESE · ATUALIZADA EM {dateTimeBR(template.publishedAt)}
      </span>
      <h1>Sua ficha de atendimento</h1>
      <p>
        Você está usando a conta <strong>{user.email}</strong>. Responda com
        atenção; o estúdio revisará suas informações antes do atendimento.
      </p>
      <form onSubmit={submit}>
        <Section title="Perguntas">
          {template.questions.map((q, i) => (
            <div key={q.id} className="form-grid">
              <Field label={`${i + 1}. ${q.label}${q.required ? " *" : ""}`}>
                {q.type === "yesno" ? (
                  <select
                    required={q.required}
                    value={answers[q.id] || ""}
                    onChange={(e) =>
                      setAnswers((current) => ({
                        ...current,
                        [q.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                ) : (
                  <textarea
                    required={q.required}
                    maxLength={2000}
                    value={answers[q.id] || ""}
                    onChange={(e) =>
                      setAnswers((current) => ({
                        ...current,
                        [q.id]: e.target.value,
                      }))
                    }
                  />
                )}
              </Field>
              {q.followUp && answers[q.id] === q.followUp.when && (
                <Field
                  label={`${q.followUp.label}${q.followUp.required ? " *" : ""}`}
                >
                  {q.followUp.type === "yesno" ? (
                    <select
                      required={q.followUp.required}
                      value={answers[q.followUp.id] || ""}
                      onChange={(e) =>
                        setAnswers((current) => ({
                          ...current,
                          [q.followUp!.id]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Selecione</option>
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  ) : (
                    <textarea
                      required={q.followUp.required}
                      maxLength={2000}
                      value={answers[q.followUp.id] || ""}
                      onChange={(e) =>
                        setAnswers((current) => ({
                          ...current,
                          [q.followUp!.id]: e.target.value,
                        }))
                      }
                    />
                  )}
                </Field>
              )}
            </div>
          ))}
        </Section>
        <Section title="Termo do procedimento">
          <p className="preserve-lines term-text">{template.procedureTerm}</p>
          <label className="check-row">
            <input
              required
              type="checkbox"
              checked={procedureAccepted}
              onChange={(e) => setProcedureAccepted(e.target.checked)}
            />{" "}
            Li e concordo com o termo acima. *
          </label>
        </Section>
        <Section title="Uso de imagem">
          <p className="preserve-lines term-text">
            {template.imageConsentTerm}
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={imageUseAccepted}
              onChange={(e) => setImageUseAccepted(e.target.checked)}
            />{" "}
            Autorizo o uso de imagem conforme o texto acima (opcional).
          </label>
        </Section>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="sign-box">
          <p>
            Ao confirmar, você entrará novamente com Google. O envio registrará
            sua conta, respostas, escolhas e horário do servidor.
          </p>
          <Button type="submit" disabled={busy || !procedureAccepted}>
            {busy ? "Confirmando…" : "Concordo e assino com Google"}
          </Button>
        </div>
      </form>
    </div>
  );
}

import { Badge, Empty, PageTitle, Section } from "../components";
import type { AdminData } from "../lib/types";
import { brl, dateTimeBR, today } from "../lib/utils";
import { expiringLots } from "../lib/domain";

export function Dashboard({ data }: { data: AdminData }) {
  const upcoming = data.sessions
    .filter(
      (s) =>
        !["cancelada", "não compareceu", "concluída"].includes(s.status) &&
        s.startAt >= new Date().toISOString(),
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5);
  const received = data.payments
    .filter((p) => !p.voidedAt && p.occurredAt?.startsWith(today()))
    .reduce((sum, p) => sum + p.signedAmountCents, 0);
  const low = data.products.filter(
    (p) => p.active && p.quantity <= p.minQuantity,
  );
  const expiry = expiringLots(data.stockLots);
  return (
    <>
      <PageTitle
        eyebrow="PAINEL DO ESTÚDIO"
        title="Seu espaço de trabalho"
        subtitle="Atendimentos, pendências e números em um só lugar."
      />
      <div className="stats-grid">
        <div className="stat-card">
          <span>Clientes</span>
          <strong>{data.clients.filter((c) => c.active).length}</strong>
          <small>cadastros ativos</small>
        </div>
        <div className="stat-card">
          <span>Projetos abertos</span>
          <strong>
            {
              data.projects.filter(
                (p) => !["concluído", "cancelado"].includes(p.status),
              ).length
            }
          </strong>
          <small>em andamento</small>
        </div>
        <div className="stat-card">
          <span>Recebido hoje</span>
          <strong>{brl(received)}</strong>
          <small>pagamentos registrados</small>
        </div>
        <div className="stat-card accent">
          <span>Estoque</span>
          <strong>{low.length + expiry.length}</strong>
          <small>alertas de saldo e validade</small>
        </div>
      </div>
      <div className="two-col">
        <Section
          title="Próximos atendimentos"
          action={<a href="#/agenda">Ver agenda →</a>}
        >
          {upcoming.length ? (
            <div className="list">
              {upcoming.map((s) => {
                const project = data.projects.find((p) => p.id === s.projectId);
                const client = data.clients.find(
                  (c) => c.id === project?.clientId,
                );
                return (
                  <a
                    className="list-row"
                    href={`#/projetos/${project?.id}`}
                    key={s.id}
                  >
                    <div>
                      <strong>{client?.name || "Cliente"}</strong>
                      <span>
                        {project?.name || "Projeto"} · {dateTimeBR(s.startAt)}
                      </span>
                    </div>
                    <Badge>{s.status}</Badge>
                  </a>
                );
              })}
            </div>
          ) : (
            <Empty>Nenhuma sessão futura cadastrada.</Empty>
          )}
        </Section>
        <Section
          title="Pendências"
          action={<a href="#/anamneses">Ver anamneses →</a>}
        >
          <div className="pending-list">
            <p>
              <strong>
                {
                  data.anamneseRequests.filter(
                    (r) =>
                      !data.anamneseSubmissions.some((s) => s.id === r.id) &&
                      r.status !== "revogada",
                  ).length
                }
              </strong>{" "}
              anamneses aguardando resposta
            </p>
            <p>
              <strong>
                {
                  data.anamneseSubmissions.filter(
                    (s) => !data.anamneseReviews.some((r) => r.id === s.id),
                  ).length
                }
              </strong>{" "}
              fichas para revisar
            </p>
            <p>
              <strong>
                {data.quotes.filter((q) => q.status === "enviado").length}
              </strong>{" "}
              orçamentos enviados
            </p>
            <p>
              <strong>{low.length}</strong> produtos em estoque mínimo
            </p>
            <p>
              <strong>{expiry.length}</strong> lotes próximos ao vencimento
            </p>
          </div>
        </Section>
      </div>
    </>
  );
}

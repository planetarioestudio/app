import { useState, type FormEvent } from "react";
import {
  Button,
  Empty,
  Field,
  FormActions,
  PageTitle,
  Section,
} from "../components";
import { createRecord, editRecord } from "../lib/data";
import { projectPaid } from "../lib/domain";
import type { AdminData, Payment } from "../lib/types";
import {
  brl,
  dateBR,
  download,
  errorMessage,
  moneyInput,
  today,
} from "../lib/utils";

const methods = [
  "Pix",
  "dinheiro",
  "débito",
  "crédito",
  "transferência",
  "outro",
];
export function FinancePage({ data }: { data: AdminData }) {
  const [form, setForm] = useState<"payment" | "expense" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState({
    projectId: "",
    sessionId: "",
    kind: "sinal",
    amount: "",
    method: "Pix",
    occurredAt: today(),
    note: "",
    originalPaymentId: "",
  });
  const [expense, setExpense] = useState({
    category: "materiais",
    amount: "",
    paidAt: today(),
    method: "Pix",
    projectId: "",
    note: "",
  });
  const [month, setMonth] = useState(today().slice(0, 7));
  const payments = data.payments.filter(
    (p) => !p.voidedAt && p.occurredAt?.startsWith(month),
  );
  const expenses = data.expenses.filter((e) => e.paidAt?.startsWith(month));
  const received = payments.reduce((sum, p) => sum + p.signedAmountCents, 0);
  const spent = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  async function savePayment(e: FormEvent) {
    e.preventDefault();
    setError("");
    const amount = moneyInput(payment.amount);
    const project = data.projects.find((p) => p.id === payment.projectId);
    if (!project || amount <= 0) {
      setError("Informe projeto e valor positivo.");
      return;
    }
    const refund = payment.kind === "devolução";
    const original = data.payments.find(
      (p) =>
        p.id === payment.originalPaymentId &&
        p.projectId === payment.projectId &&
        p.signedAmountCents > 0,
    );
    if (refund && !original) {
      setError("Selecione o pagamento original.");
      return;
    }
    if (refund && original) {
      const already = data.payments
        .filter((p) => p.originalPaymentId === original.id && !p.voidedAt)
        .reduce((sum, p) => sum - p.signedAmountCents, 0);
      if (already + amount > original.signedAmountCents) {
        setError("Devolução maior que o valor disponível.");
        return;
      }
    }
    if (
      !refund &&
      projectPaid(data.payments, project.id) + amount > project.priceCents
    ) {
      setError(
        "Pagamento supera o saldo do projeto. Ajuste o valor combinado antes.",
      );
      return;
    }
    setBusy(true);
    try {
      await createRecord("payments", {
        projectId: payment.projectId,
        sessionId: payment.sessionId,
        kind: payment.kind,
        signedAmountCents: refund ? -amount : amount,
        method: payment.method,
        occurredAt: payment.occurredAt,
        note: payment.note,
        originalPaymentId: refund ? payment.originalPaymentId : "",
      });
      setForm(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function saveExpense(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (moneyInput(expense.amount) <= 0) {
      setError("Informe valor positivo.");
      return;
    }
    setBusy(true);
    try {
      await createRecord("expenses", {
        category: expense.category,
        amountCents: moneyInput(expense.amount),
        paidAt: expense.paidAt,
        method: expense.method,
        projectId: expense.projectId,
        note: expense.note,
      });
      setForm(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function voidPayment(p: Payment) {
    const reason = window.prompt(
      "Motivo da anulação (somente se não houve movimentação real):",
    );
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await editRecord("payments", p.id, {
        voidedAt: new Date().toISOString(),
        voidReason: reason.trim(),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  function csv() {
    const rows = [
      [
        "tipo",
        "data",
        "projeto",
        "categoria",
        "valor_centavos",
        "metodo",
        "observacao",
      ],
      ...payments.map((p) => [
        "pagamento",
        p.occurredAt,
        p.projectId,
        p.kind,
        String(p.signedAmountCents),
        p.method,
        p.note,
      ]),
      ...expenses.map((e) => [
        "despesa",
        e.paidAt,
        e.projectId,
        e.category,
        String(-e.amountCents),
        e.method,
        e.note,
      ]),
    ];
    download(
      `planetario-financeiro-${month}.csv`,
      "\uFEFF" +
        rows
          .map((row) =>
            row
              .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
              .join(";"),
          )
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="CONTROLE"
        title="Financeiro"
        subtitle="Registros simples de entradas e saídas efetivas."
        action={
          <div className="button-row">
            <Button variant="secondary" onClick={() => setForm("expense")}>
              Nova despesa
            </Button>
            <Button onClick={() => setForm("payment")}>Novo pagamento</Button>
          </div>
        }
      />
      <div className="toolbar">
        <Field label="Período">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
        <Button variant="quiet" onClick={csv}>
          Exportar CSV
        </Button>
      </div>
      <div className="stats-grid compact">
        <div className="stat-card">
          <span>Recebido</span>
          <strong>{brl(received)}</strong>
        </div>
        <div className="stat-card">
          <span>Despesas pagas</span>
          <strong>{brl(spent)}</strong>
        </div>
        <div className="stat-card">
          <span>Caixa do período</span>
          <strong>{brl(received - spent)}</strong>
        </div>
      </div>
      {form === "payment" && (
        <Section title="Registrar pagamento">
          <form className="form-grid" onSubmit={savePayment}>
            <Field label="Projeto *">
              <select
                required
                value={payment.projectId}
                onChange={(e) =>
                  setPayment({
                    ...payment,
                    projectId: e.target.value,
                    sessionId: "",
                  })
                }
              >
                <option value="">Selecione</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · saldo{" "}
                    {brl(p.priceCents - projectPaid(data.payments, p.id))}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select
                value={payment.kind}
                onChange={(e) =>
                  setPayment({ ...payment, kind: e.target.value })
                }
              >
                {["sinal", "sessão", "outro", "devolução"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            {payment.kind === "devolução" && (
              <Field label="Pagamento original">
                <select
                  required
                  value={payment.originalPaymentId}
                  onChange={(e) =>
                    setPayment({
                      ...payment,
                      originalPaymentId: e.target.value,
                    })
                  }
                >
                  <option value="">Selecione</option>
                  {data.payments
                    .filter(
                      (p) =>
                        p.projectId === payment.projectId &&
                        p.signedAmountCents > 0 &&
                        !p.voidedAt,
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {dateBR(p.occurredAt)} · {brl(p.signedAmountCents)}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Valor (R$) *">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={payment.amount}
                onChange={(e) =>
                  setPayment({ ...payment, amount: e.target.value })
                }
              />
            </Field>
            <Field label="Data">
              <input
                required
                type="date"
                value={payment.occurredAt}
                onChange={(e) =>
                  setPayment({ ...payment, occurredAt: e.target.value })
                }
              />
            </Field>
            <Field label="Método">
              <select
                value={payment.method}
                onChange={(e) =>
                  setPayment({ ...payment, method: e.target.value })
                }
              >
                {methods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Sessão (opcional)">
              <select
                value={payment.sessionId}
                onChange={(e) =>
                  setPayment({ ...payment, sessionId: e.target.value })
                }
              >
                <option value="">Sem sessão</option>
                {data.sessions
                  .filter((s) => s.projectId === payment.projectId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {dateBR(s.startAt)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Observação">
              <input
                value={payment.note}
                onChange={(e) =>
                  setPayment({ ...payment, note: e.target.value })
                }
              />
            </Field>
            {error && <p className="notice error">{error}</p>}
            <FormActions busy={busy} cancel={() => setForm(null)} />
          </form>
        </Section>
      )}
      {form === "expense" && (
        <Section title="Registrar despesa paga">
          <form className="form-grid" onSubmit={saveExpense}>
            <Field label="Categoria">
              <select
                value={expense.category}
                onChange={(e) =>
                  setExpense({ ...expense, category: e.target.value })
                }
              >
                {[
                  "materiais",
                  "aluguel",
                  "energia",
                  "marketing",
                  "serviços",
                  "outro",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor (R$) *">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={expense.amount}
                onChange={(e) =>
                  setExpense({ ...expense, amount: e.target.value })
                }
              />
            </Field>
            <Field label="Data de pagamento">
              <input
                required
                type="date"
                value={expense.paidAt}
                onChange={(e) =>
                  setExpense({ ...expense, paidAt: e.target.value })
                }
              />
            </Field>
            <Field label="Método">
              <select
                value={expense.method}
                onChange={(e) =>
                  setExpense({ ...expense, method: e.target.value })
                }
              >
                {methods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Projeto (opcional)">
              <select
                value={expense.projectId}
                onChange={(e) =>
                  setExpense({ ...expense, projectId: e.target.value })
                }
              >
                <option value="">Geral</option>
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Observação">
              <input
                value={expense.note}
                onChange={(e) =>
                  setExpense({ ...expense, note: e.target.value })
                }
              />
            </Field>
            {error && <p className="notice error">{error}</p>}
            <FormActions busy={busy} cancel={() => setForm(null)} />
          </form>
        </Section>
      )}
      <div className="two-col">
        <Section title="Pagamentos">
          {payments.length ? (
            <div className="list">
              {payments.map((p) => (
                <div key={p.id} className="list-row">
                  <div>
                    <strong>
                      {data.projects.find((x) => x.id === p.projectId)?.name ||
                        "Projeto"}{" "}
                      · {p.kind}
                    </strong>
                    <span>
                      {dateBR(p.occurredAt)} · {p.method}
                    </span>
                  </div>
                  <div className="row-end">
                    <strong>{brl(p.signedAmountCents)}</strong>
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onClick={() => voidPayment(p)}
                    >
                      Anular
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Nenhum pagamento no período.</Empty>
          )}
        </Section>
        <Section title="Despesas">
          {expenses.length ? (
            <div className="list">
              {expenses.map((e) => (
                <div key={e.id} className="list-row">
                  <div>
                    <strong>{e.category}</strong>
                    <span>
                      {dateBR(e.paidAt)} · {e.method}
                    </span>
                  </div>
                  <strong>{brl(e.amountCents)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Nenhuma despesa no período.</Empty>
          )}
        </Section>
      </div>
    </>
  );
}

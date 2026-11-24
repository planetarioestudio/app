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
import { addProduct, recordStock, type StockAction } from "../lib/data";
import { expiringLots } from "../lib/domain";
import type { AdminData } from "../lib/types";
import { brl, dateBR, errorMessage, moneyInput } from "../lib/utils";

export function StockPage({ data }: { data: AdminData }) {
  const [form, setForm] = useState<"product" | "movement" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState({
    name: "",
    unit: "un",
    category: "",
    minQuantity: 0,
    defaultUnitCost: "",
  });
  const [action, setAction] = useState({
    operationId: crypto.randomUUID(),
    productId: "",
    lotId: "",
    lotNumber: "",
    expiryDate: "",
    supplierName: "",
    sessionId: "",
    type: "entrada",
    quantity: "",
    unitCost: "",
    note: "",
  });
  const low = data.products.filter(
    (p) => p.active && p.quantity <= p.minQuantity,
  );
  const expiring = expiringLots(data.stockLots);
  const lots = data.stockLots.filter((l) => l.productId === action.productId);
  function resetAction() {
    setAction({
      operationId: crypto.randomUUID(),
      productId: "",
      lotId: "",
      lotNumber: "",
      expiryDate: "",
      supplierName: "",
      sessionId: "",
      type: "entrada",
      quantity: "",
      unitCost: "",
      note: "",
    });
  }
  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await addProduct({
        name: product.name.trim(),
        unit: product.unit.trim(),
        category: product.category.trim(),
        minQuantity: Number(product.minQuantity),
        defaultUnitCostCents: moneyInput(product.defaultUnitCost),
        active: true,
      });
      setForm(null);
      setProduct({
        name: "",
        unit: "un",
        category: "",
        minQuantity: 0,
        defaultUnitCost: "",
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function saveMovement(e: FormEvent) {
    e.preventDefault();
    setError("");
    const quantity = Number(action.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantidade deve ser positiva.");
      return;
    }
    if (action.type !== "entrada" && !action.lotId) {
      setError("Selecione o lote para a baixa ou ajuste.");
      return;
    }
    if (["perda", "ajuste"].includes(action.type) && !action.note.trim()) {
      setError("Informe o motivo.");
      return;
    }
    const selected = lots.find((l) => l.id === action.lotId);
    const delta =
      action.type === "entrada"
        ? quantity
        : action.type === "ajuste"
          ? Number(action.quantity)
          : -quantity;
    const payload: StockAction = {
      operationId: action.operationId,
      productId: action.productId,
      lotId: action.lotId || undefined,
      lotNumber: action.lotNumber,
      expiryDate: action.expiryDate,
      supplierName: action.supplierName,
      sessionId: action.type === "consumo" ? action.sessionId : "",
      type: action.type as StockAction["type"],
      quantityDelta: delta,
      unitCostCents: action.unitCost
        ? moneyInput(action.unitCost)
        : selected?.unitCostCents ||
          data.products.find((p) => p.id === action.productId)
            ?.defaultUnitCostCents ||
          0,
      note: action.note.trim(),
    };
    setBusy(true);
    try {
      await recordStock(payload);
      resetAction();
      setForm(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="MATERIAIS"
        title="Estoque"
        subtitle="Produtos, lotes, entradas e consumo dos atendimentos."
        action={
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={() => {
                resetAction();
                setForm("movement");
              }}
            >
              Movimentar
            </Button>
            <Button onClick={() => setForm("product")}>Novo produto</Button>
          </div>
        }
      />
      <div className="stats-grid compact">
        <div className="stat-card">
          <span>Produtos ativos</span>
          <strong>{data.products.filter((p) => p.active).length}</strong>
        </div>
        <div className="stat-card">
          <span>Estoque baixo</span>
          <strong>{low.length}</strong>
        </div>
        <div className="stat-card">
          <span>Vencendo em 30 dias</span>
          <strong>{expiring.length}</strong>
        </div>
      </div>
      {form === "product" && (
        <Section title="Novo produto">
          <form className="form-grid" onSubmit={saveProduct}>
            <Field label="Nome *">
              <input
                required
                value={product.name}
                onChange={(e) =>
                  setProduct({ ...product, name: e.target.value })
                }
              />
            </Field>
            <Field label="Categoria">
              <input
                value={product.category}
                onChange={(e) =>
                  setProduct({ ...product, category: e.target.value })
                }
              />
            </Field>
            <Field label="Unidade">
              <input
                required
                value={product.unit}
                onChange={(e) =>
                  setProduct({ ...product, unit: e.target.value })
                }
                placeholder="un, ml, caixa"
              />
            </Field>
            <Field label="Estoque mínimo">
              <input
                type="number"
                min="0"
                step="0.001"
                value={product.minQuantity}
                onChange={(e) =>
                  setProduct({
                    ...product,
                    minQuantity: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Custo unitário padrão (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={product.defaultUnitCost}
                onChange={(e) =>
                  setProduct({ ...product, defaultUnitCost: e.target.value })
                }
              />
            </Field>
            {error && <p className="notice error">{error}</p>}
            <FormActions busy={busy} cancel={() => setForm(null)} />
          </form>
        </Section>
      )}
      {form === "movement" && (
        <Section title="Movimentar estoque">
          <form className="form-grid" onSubmit={saveMovement}>
            <Field label="Tipo">
              <select
                value={action.type}
                onChange={(e) =>
                  setAction({ ...action, type: e.target.value, lotId: "" })
                }
              >
                {["entrada", "consumo", "perda", "ajuste"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Produto *">
              <select
                required
                value={action.productId}
                onChange={(e) =>
                  setAction({ ...action, productId: e.target.value, lotId: "" })
                }
              >
                <option value="">Selecione</option>
                {data.products
                  .filter((p) => p.active)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name} · {p.quantity} {p.unit}
                    </option>
                  ))}
              </select>
            </Field>
            <Field
              label={
                action.type === "entrada" ? "Lote existente ou novo" : "Lote *"
              }
            >
              <select
                value={action.lotId}
                onChange={(e) =>
                  setAction({ ...action, lotId: e.target.value })
                }
              >
                <option value="">
                  {action.type === "entrada" ? "Criar novo lote" : "Selecione"}
                </option>
                {lots.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.lotNumber || "Sem número"} · {l.quantity} disponíveis
                    {l.expiryDate ? ` · validade ${l.expiryDate}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {action.type === "entrada" && !action.lotId && (
              <>
                <Field label="Número do lote">
                  <input
                    value={action.lotNumber}
                    onChange={(e) =>
                      setAction({ ...action, lotNumber: e.target.value })
                    }
                  />
                </Field>
                <Field label="Validade">
                  <input
                    type="date"
                    value={action.expiryDate}
                    onChange={(e) =>
                      setAction({ ...action, expiryDate: e.target.value })
                    }
                  />
                </Field>
                <Field label="Fornecedor">
                  <input
                    value={action.supplierName}
                    onChange={(e) =>
                      setAction({ ...action, supplierName: e.target.value })
                    }
                  />
                </Field>
              </>
            )}
            {action.type === "consumo" && (
              <Field label="Sessão *">
                <select
                  required
                  value={action.sessionId}
                  onChange={(e) =>
                    setAction({ ...action, sessionId: e.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  {data.sessions
                    .filter((s) => s.status === "concluída")
                    .map((s) => (
                      <option value={s.id} key={s.id}>
                        {data.projects.find((p) => p.id === s.projectId)?.name}{" "}
                        · {dateBR(s.startAt)}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field
              label={
                action.type === "ajuste"
                  ? "Quantidade acrescida"
                  : "Quantidade *"
              }
              hint={
                action.type === "ajuste"
                  ? "Para perda, use o tipo “perda”."
                  : undefined
              }
            >
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={action.quantity}
                onChange={(e) =>
                  setAction({ ...action, quantity: e.target.value })
                }
              />
            </Field>
            <Field label="Custo unitário (R$)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={action.unitCost}
                onChange={(e) =>
                  setAction({ ...action, unitCost: e.target.value })
                }
              />
            </Field>
            <Field label="Motivo / observação">
              <input
                required={["perda", "ajuste"].includes(action.type)}
                value={action.note}
                onChange={(e) => setAction({ ...action, note: e.target.value })}
              />
            </Field>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <FormActions
              busy={busy}
              cancel={() => setForm(null)}
              label="Registrar movimento"
            />
          </form>
        </Section>
      )}
      {(low.length > 0 || expiring.length > 0) && (
        <Section title="Alertas">
          <div className="notice warning">
            {low.length} produto(s) em estoque mínimo · {expiring.length}{" "}
            lote(s) próximos do vencimento ou vencidos.
          </div>
        </Section>
      )}
      <Section title="Produtos e lotes">
        {data.products.length ? (
          <div className="list">
            {[...data.products]
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
              .map((p) => (
                <div className="stock-item" key={p.id}>
                  <div className="list-row">
                    <div>
                      <strong>{p.name}</strong>
                      <span>
                        {p.category || "Sem categoria"} · mínimo {p.minQuantity}{" "}
                        {p.unit}
                      </span>
                    </div>
                    <div className="row-end">
                      <strong>
                        {p.quantity} {p.unit}
                      </strong>
                      {p.quantity <= p.minQuantity && <Badge>Baixo</Badge>}
                    </div>
                  </div>
                  <div className="lot-list">
                    {data.stockLots
                      .filter((l) => l.productId === p.id)
                      .map((l) => (
                        <span key={l.id}>
                          Lote {l.lotNumber || "sem número"} · {l.quantity}{" "}
                          {p.unit}
                          {l.expiryDate &&
                            ` · validade ${dateBR(l.expiryDate)}`}{" "}
                          · {brl(l.unitCostCents)}/un
                        </span>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <Empty>Cadastre um produto para começar.</Empty>
        )}
      </Section>
      <Section title="Últimos movimentos">
        {data.stockMovements.length ? (
          <div className="list">
            {[...data.stockMovements]
              .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
              .slice(0, 30)
              .map((m) => (
                <div className="list-row" key={m.id}>
                  <div>
                    <strong>
                      {data.products.find((p) => p.id === m.productId)?.name ||
                        "Produto"}{" "}
                      · {m.type}
                    </strong>
                    <span>
                      {dateBR(m.occurredAt)} · {m.note || "Sem observação"}
                    </span>
                  </div>
                  <strong>
                    {m.quantityDelta > 0 ? "+" : ""}
                    {m.quantityDelta}
                  </strong>
                </div>
              ))}
          </div>
        ) : (
          <Empty>Sem movimentos registrados.</Empty>
        )}
      </Section>
    </>
  );
}

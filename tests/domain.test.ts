import { describe, expect, it } from "vitest";
import {
  expiringLots,
  lotExpired,
  nextQuoteVersion,
  projectPaid,
  stockResult,
  suggestedPrice,
} from "../src/lib/domain";
import type { Payment, Quote, StockLot } from "../src/lib/types";

describe("valores gerenciais", () => {
  it("calcula preço sugerido em centavos", () => {
    expect(suggestedPrice(2, 10000, 5000, 0, 20)).toBe(31250);
    expect(() => suggestedPrice(1, 1000, 0, 0, 100)).toThrow();
  });
  it("conta sinal e devolução uma vez", () => {
    const payments = [
      { projectId: "p", signedAmountCents: 20000 },
      { projectId: "p", signedAmountCents: 30000 },
      { projectId: "p", signedAmountCents: -5000 },
      { projectId: "p", signedAmountCents: 9000, voidedAt: "now" },
    ] as Payment[];
    expect(projectPaid(payments, "p")).toBe(45000);
  });
  it("versiona orçamento sem alterar a versão anterior", () => {
    expect(
      nextQuoteVersion(
        [
          { projectId: "p", version: 1 },
          { projectId: "p", version: 2 },
        ] as Quote[],
        "p",
      ),
    ).toBe(3);
  });
  it("alerta apenas lotes com saldo e validade próxima", () => {
    const lots = [
      { id: "a", quantity: 1, expiryDate: "2026-12-01" },
      { id: "b", quantity: 0, expiryDate: "2026-12-01" },
      { id: "c", quantity: 1, expiryDate: "2027-02-01" },
    ] as StockLot[];
    expect(
      expiringLots(lots, 30, new Date("2026-11-24T12:00:00Z")).map((l) => l.id),
    ).toEqual(["a"]);
  });
  it("baixa produto e lote juntos sem permitir saldo negativo ou lote vencido", () => {
    expect(stockResult(10, 3, -2)).toEqual({ product: 8, lot: 1 });
    expect(() => stockResult(10, 1, -2)).toThrow("Saldo insuficiente");
    expect(lotExpired("2026-11-23", "2026-11-24")).toBe(true);
    expect(lotExpired("2026-11-24", "2026-11-24")).toBe(false);
  });
});

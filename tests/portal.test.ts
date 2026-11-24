import { describe, expect, it } from "vitest";
import { portalProjectTotals } from "../src/lib/portal";
import type { PortalPayment, PortalProject } from "../src/lib/types";

describe("saldo exibido ao cliente", () => {
  it("conta sinal, devolução e ignora pagamento anulado e outro projeto", () => {
    const project = { id: "p1", priceCents: 100000 } as PortalProject;
    const payments = [
      { projectId: "p1", signedAmountCents: 20000, voided: false },
      { projectId: "p1", signedAmountCents: 40000, voided: false },
      { projectId: "p1", signedAmountCents: -5000, voided: false },
      { projectId: "p1", signedAmountCents: 10000, voided: true },
      { projectId: "p2", signedAmountCents: 9000, voided: false },
    ] as PortalPayment[];
    expect(portalProjectTotals(project, payments)).toEqual({
      paid: 55000,
      remaining: 45000,
    });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { recordStock } from "../src/lib/data";

let env: RulesTestEnvironment;
const authTimeSeconds = Math.floor(Date.now() / 1000);
const ownerToken = {
  email: "planetariomkt@gmail.com",
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
  auth_time: authTimeSeconds,
};
const clientToken = (email: string) => ({
  email,
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
  auth_time: authTimeSeconds,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-planetario",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
});
afterAll(async () => {
  await env.cleanup();
});

describe("isolamento do estúdio e anamnese", () => {
  it("autoriza bootstrap só da conta proprietária Google", async () => {
    const owner = env.authenticatedContext("owner-uid", ownerToken).firestore();
    const outsider = env
      .authenticatedContext("other-uid", clientToken("outro@gmail.com"))
      .firestore();
    await assertFails(
      setDoc(doc(outsider, "settings", "owner"), {
        uid: "other-uid",
        email: "outro@gmail.com",
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(owner, "settings", "owner"), {
        uid: "owner-uid",
        email: "planetariomkt@gmail.com",
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(setDoc(doc(owner, "clients", "a"), { name: "Teste" }));
    await assertFails(getDoc(doc(outsider, "clients", "a")));
  });
  it("permite pedido pendente próprio e bloqueia leitura cruzada", async () => {
    const a = env
      .authenticatedContext("a-uid", clientToken("a@gmail.com"))
      .firestore();
    const b = env
      .authenticatedContext("b-uid", clientToken("b@gmail.com"))
      .firestore();
    await assertSucceeds(
      setDoc(doc(a, "pendingAccounts", "a-uid"), {
        uid: "a-uid",
        verifiedGoogleEmail: "a@gmail.com",
        requestedAt: serverTimestamp(),
      }),
    );
    await assertFails(getDoc(doc(b, "pendingAccounts", "a-uid")));
    await assertFails(getDocs(collection(a, "clients")));
  });
  it("restringe submissão a pedido, UID e versão corretos; impede alteração", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "settings", "owner"), {
        uid: "owner-uid",
        email: "planetariomkt@gmail.com",
      });
      await setDoc(doc(db, "clientAccess", "a-uid"), {
        clientId: "cliente-a",
        active: true,
        verifiedGoogleEmail: "a@gmail.com",
      });
      await setDoc(doc(db, "formTemplates", "t1"), {
        version: 1,
        questions: [
          { id: "q1", label: "Pergunta?", type: "yesno", required: true },
        ],
        questionIds: ["q1"],
        requiredQuestionIds: ["q1"],
        procedureTerm: "Termo",
        imageConsentTerm: "Imagem",
      });
      await setDoc(doc(db, "anamneseRequests", "r1"), {
        clientId: "cliente-a",
        projectId: "p1",
        assignedUid: "a-uid",
        templateId: "t1",
        status: "enviada",
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 86400000)),
      });
    });
    const a = env
      .authenticatedContext("a-uid", clientToken("a@gmail.com"))
      .firestore();
    const b = env
      .authenticatedContext("b-uid", clientToken("b@gmail.com"))
      .firestore();
    await assertSucceeds(getDoc(doc(a, "anamneseRequests", "r1")));
    await assertFails(getDoc(doc(b, "anamneseRequests", "r1")));
    const payload = {
      clientId: "cliente-a",
      projectId: "p1",
      requestId: "r1",
      googleUid: "a-uid",
      googleEmail: "a@gmail.com",
      templateId: "t1",
      version: 1,
      answers: { q1: "Não" },
      procedureAccepted: true,
      imageUseAccepted: false,
      authMethod: "google.com",
      authTimeSeconds: ownerToken.auth_time,
      signedAt: serverTimestamp(),
    };
    await assertFails(
      setDoc(doc(b, "anamneseSubmissions", "r1"), {
        ...payload,
        googleUid: "b-uid",
        googleEmail: "b@gmail.com",
      }),
    );
    await assertFails(
      setDoc(doc(a, "anamneseSubmissions", "r1"), {
        ...payload,
        clientId: "outro-cliente",
      }),
    );
    await assertFails(
      setDoc(doc(a, "anamneseSubmissions", "r1"), { ...payload, answers: {} }),
    );
    const stale = env
      .authenticatedContext("a-uid", {
        ...clientToken("a@gmail.com"),
        auth_time: Math.floor(Date.now() / 1000) - 600,
      })
      .firestore();
    await assertFails(
      setDoc(doc(stale, "anamneseSubmissions", "r1"), {
        ...payload,
        authTimeSeconds: Math.floor(Date.now() / 1000) - 600,
      }),
    );
    await assertSucceeds(setDoc(doc(a, "anamneseSubmissions", "r1"), payload));
    await assertFails(setDoc(doc(a, "anamneseSubmissions", "r1"), payload));
    await assertFails(getDoc(doc(b, "anamneseSubmissions", "r1")));
    const submission = await assertSucceeds(
      getDoc(doc(a, "anamneseSubmissions", "r1")),
    );
    expect(submission.exists()).toBe(true);
  });
  it("nega leitura depois de revogar o vínculo", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "settings", "owner"), {
        uid: "owner-uid",
        email: "planetariomkt@gmail.com",
      });
      await setDoc(doc(db, "clientAccess", "a-uid"), {
        clientId: "cliente-a",
        active: false,
        verifiedGoogleEmail: "a@gmail.com",
      });
      await setDoc(doc(db, "anamneseRequests", "r1"), {
        clientId: "cliente-a",
        assignedUid: "a-uid",
      });
    });
    const a = env
      .authenticatedContext("a-uid", clientToken("a@gmail.com"))
      .firestore();
    await assertFails(getDoc(doc(a, "anamneseRequests", "r1")));
  });
  it("baixa o estoque uma vez mesmo sob concorrência e repetição", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "settings", "owner"), {
        uid: "owner-uid",
        email: "planetariomkt@gmail.com",
      });
      await setDoc(doc(db, "products", "p1"), { name: "Tinta", quantity: 3 });
      await setDoc(doc(db, "stockLots", "l1"), {
        productId: "p1",
        quantity: 3,
        expiryDate: "",
        unitCostCents: 1000,
      });
    });
    const db = env.authenticatedContext("owner-uid", ownerToken).firestore();
    const action = (operationId: string) => ({
      operationId,
      productId: "p1",
      lotId: "l1",
      sessionId: "s1",
      type: "consumo" as const,
      quantityDelta: -2,
      unitCostCents: 1000,
      note: "",
    });
    const results = await Promise.allSettled([
      recordStock(action("op1"), db),
      recordStock(action("op2"), db),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const winner = results[0]?.status === "fulfilled" ? "op1" : "op2";
    await recordStock(action(winner), db);
    const product = await getDoc(doc(db, "products", "p1"));
    const lot = await getDoc(doc(db, "stockLots", "l1"));
    const movements = await getDocs(collection(db, "stockMovements"));
    expect(product.data()?.quantity).toBe(1);
    expect(lot.data()?.quantity).toBe(1);
    expect(movements.size).toBe(1);
  });
});

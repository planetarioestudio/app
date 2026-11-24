import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
  writeBatch,
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
  it("aceita um modelo com subresposta e mantém versões publicadas imutáveis", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "settings", "owner"), {
        uid: "owner-uid",
        email: "planetariomkt@gmail.com",
      });
    });
    const db = env.authenticatedContext("owner-uid", ownerToken).firestore();
    const ref = doc(db, "formTemplates", "condicional");
    const model = {
      version: 2,
      questions: [
        {
          id: "q1",
          label: "Possui alergia?",
          type: "yesno",
          required: true,
          followUp: {
            id: "q2",
            label: "Qual alergia?",
            type: "text",
            required: true,
            when: "Sim",
          },
        },
      ],
      questionIds: ["q1", "q2"],
      requiredQuestionIds: ["q1"],
      procedureTerm: "Termo",
      imageConsentTerm: "Imagem",
      publishedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(ref, model));
    await assertFails(setDoc(ref, { ...model, procedureTerm: "Alterado" }));
  });
  it("permite publicar e responder mais de 40 perguntas", async () => {
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
    });
    const owner = env.authenticatedContext("owner-uid", ownerToken).firestore();
    const client = env
      .authenticatedContext("a-uid", clientToken("a@gmail.com"))
      .firestore();
    const ids = Array.from({ length: 41 }, (_, index) => `q${index + 1}`);
    await assertSucceeds(
      setDoc(doc(owner, "formTemplates", "longa"), {
        version: 3,
        questions: ids.map((id) => ({
          id,
          label: `Pergunta ${id}?`,
          type: "yesno",
          required: true,
        })),
        questionIds: ids,
        requiredQuestionIds: ids,
        procedureTerm: "Termo",
        imageConsentTerm: "Imagem",
        publishedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(owner, "anamneseRequests", "longa"), {
        clientId: "cliente-a",
        projectId: "p1",
        assignedUid: "a-uid",
        templateId: "longa",
        status: "enviada",
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 86400000)),
      }),
    );
    await assertSucceeds(
      setDoc(doc(client, "anamneseSubmissions", "longa"), {
        clientId: "cliente-a",
        projectId: "p1",
        requestId: "longa",
        googleUid: "a-uid",
        googleEmail: "a@gmail.com",
        templateId: "longa",
        version: 3,
        answers: Object.fromEntries(ids.map((id) => [id, "Não"])),
        procedureAccepted: true,
        imageUseAccepted: false,
        authMethod: "google.com",
        authTimeSeconds,
        signedAt: serverTimestamp(),
      }),
    );
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
  it("permite autocadastro novo, mas isola o portal e impede vínculo forjado", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "settings", "owner"), {
        uid: "owner-uid",
        email: "planetariomkt@gmail.com",
      });
      await setDoc(doc(db, "portalSettings", "current"), {
        enabled: true,
        templateId: "t1",
        version: 1,
      });
      await setDoc(doc(db, "pendingAccounts", "a-uid"), {
        uid: "a-uid",
        verifiedGoogleEmail: "a@gmail.com",
        requestedAt: Timestamp.now(),
      });
    });
    const a = env
      .authenticatedContext("a-uid", clientToken("a@gmail.com"))
      .firestore();
    const b = env
      .authenticatedContext("b-uid", clientToken("b@gmail.com"))
      .firestore();
    const hash = createHash("sha256").update("a@gmail.com").digest("hex");
    const batch = writeBatch(a);
    batch.set(doc(a, "clients", "a-uid"), {
      name: "Cliente A",
      searchName: "cliente a",
      phone: "11999999999",
      email: "a@gmail.com",
      instagram: "",
      birthDate: "2000-01-01",
      source: "autocadastro",
      notes: "",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(a, "clientPortal", "a-uid"), {
      name: "Cliente A",
      phone: "11999999999",
      email: "a@gmail.com",
      instagram: "",
      birthDate: "2000-01-01",
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(a, "clientEmailIndex", hash), {
      emailLower: "a@gmail.com",
      clientId: "a-uid",
      status: "unique",
      claimedUid: "a-uid",
    });
    batch.set(doc(a, "clientAccess", "a-uid"), {
      clientId: "a-uid",
      verifiedGoogleEmail: "a@gmail.com",
      active: true,
      linkedAt: serverTimestamp(),
      linkedBy: "self",
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(a, "clientPortal", "a-uid")));
    await assertFails(getDoc(doc(b, "clientPortal", "a-uid")));
    await assertFails(getDoc(doc(a, "clients", "a-uid")));
    await assertFails(
      setDoc(doc(b, "clientAccess", "b-uid"), {
        clientId: "a-uid",
        verifiedGoogleEmail: "b@gmail.com",
        active: true,
        linkedAt: serverTimestamp(),
        linkedBy: "self",
      }),
    );
  });
  it("associa pelo e-mail Google único, mas bloqueia outro UID e notas internas", async () => {
    const hash = createHash("sha256").update("a@gmail.com").digest("hex");
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "settings", "owner"), {
        uid: "owner-uid",
        email: "planetariomkt@gmail.com",
      });
      await setDoc(doc(db, "portalSettings", "current"), {
        enabled: true,
        templateId: "t1",
        version: 1,
      });
      await setDoc(doc(db, "clients", "old-client"), {
        name: "Antigo",
        phone: "",
        email: "a@gmail.com",
        instagram: "",
        birthDate: "",
        searchName: "antigo",
        notes: "Nota privada",
        active: true,
      });
      await setDoc(doc(db, "clientPortal", "old-client"), {
        name: "Antigo",
        phone: "",
        email: "a@gmail.com",
        instagram: "",
        birthDate: "",
      });
      await setDoc(doc(db, "clientEmailIndex", hash), {
        emailLower: "a@gmail.com",
        clientId: "old-client",
        status: "unique",
        claimedUid: "",
      });
    });
    const a = env
      .authenticatedContext("a-uid", clientToken("a@gmail.com"))
      .firestore();
    const b = env
      .authenticatedContext("b-uid", clientToken("b@gmail.com"))
      .firestore();
    const batch = writeBatch(a);
    batch.update(doc(a, "clients", "old-client"), {
      name: "Novo nome",
      searchName: "novo nome",
      phone: "11999999999",
      email: "a@gmail.com",
      instagram: "",
      birthDate: "2000-01-01",
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(a, "clientPortal", "old-client"), {
      name: "Novo nome",
      phone: "11999999999",
      email: "a@gmail.com",
      instagram: "",
      birthDate: "2000-01-01",
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(a, "clientEmailIndex", hash), { claimedUid: "a-uid" });
    batch.set(doc(a, "clientAccess", "a-uid"), {
      clientId: "old-client",
      verifiedGoogleEmail: "a@gmail.com",
      active: true,
      linkedAt: serverTimestamp(),
      linkedBy: "self",
    });
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(a, "clients", "old-client")));
    await assertSucceeds(getDoc(doc(a, "clientPortal", "old-client")));
    await assertFails(getDoc(doc(b, "clientPortal", "old-client")));
    const contact = writeBatch(a);
    contact.update(doc(a, "clients", "old-client"), {
      phone: "11888888888",
      instagram: "@cliente",
      updatedAt: serverTimestamp(),
    });
    contact.update(doc(a, "clientPortal", "old-client"), {
      phone: "11888888888",
      instagram: "@cliente",
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(contact.commit());
    await assertFails(
      setDoc(
        doc(a, "clientPortal", "old-client"),
        { notes: "tentar" },
        { merge: true },
      ),
    );
  });
  it("assina uma solicitação inicial sem projeto uma única vez", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "settings", "owner"), { uid: "owner-uid" });
      await setDoc(doc(db, "clientAccess", "a-uid"), {
        clientId: "client-a",
        active: true,
        verifiedGoogleEmail: "a@gmail.com",
      });
      await setDoc(doc(db, "clientPortal", "client-a"), {
        name: "Cliente A",
        email: "a@gmail.com",
        phone: "11999999999",
        birthDate: "2000-01-01",
        instagram: "",
      });
      await setDoc(doc(db, "formTemplates", "t1"), {
        version: 1,
        questionIds: ["q1"],
        requiredQuestionIds: ["q1"],
      });
      await setDoc(doc(db, "anamneseRequests", "new-initial"), {
        kind: "initial",
        clientId: "client-a",
        projectId: "",
        assignedUid: "a-uid",
        templateId: "t1",
        status: "enviada",
      });
    });
    const a = env
      .authenticatedContext("a-uid", clientToken("a@gmail.com"))
      .firestore();
    const b = env
      .authenticatedContext("b-uid", clientToken("b@gmail.com"))
      .firestore();
    const batch = writeBatch(a);
    const submission = doc(a, "anamneseSubmissions", "new-initial");
    batch.set(submission, {
      clientId: "client-a",
      projectId: "",
      requestId: "new-initial",
      googleUid: "a-uid",
      googleEmail: "a@gmail.com",
      templateId: "t1",
      version: 1,
      answers: { q1: "Não" },
      procedureAccepted: true,
      imageUseAccepted: false,
      authMethod: "google.com",
      authTimeSeconds,
      signedAt: serverTimestamp(),
    });
    batch.update(doc(a, "clientPortal", "client-a"), {
      initialSignedAt: serverTimestamp(),
      initialRequestId: "new-initial",
      updatedAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(submission, { tampered: true }));
    await assertFails(getDoc(doc(b, "clientPortal", "client-a")));
  });
  it("mantém e-mail ambíguo sem associação automática e revogação efetiva", async () => {
    const hash = createHash("sha256").update("a@gmail.com").digest("hex");
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "settings", "owner"), { uid: "owner-uid" });
      await setDoc(doc(db, "portalSettings", "current"), {
        enabled: true,
        templateId: "t1",
      });
      await setDoc(doc(db, "clientEmailIndex", hash), {
        emailLower: "a@gmail.com",
        clientId: "",
        status: "ambiguous",
        claimedUid: "",
      });
      await setDoc(doc(db, "clientPortal", "old-a"), { name: "Antigo" });
      await setDoc(doc(db, "clientPortal", "old-a", "projects", "project-1"), {
        name: "Privado",
      });
    });
    const a = env
      .authenticatedContext("a-uid", clientToken("a@gmail.com"))
      .firestore();
    const batch = writeBatch(a);
    batch.set(doc(a, "clients", "a-uid"), {
      name: "Novo",
      searchName: "novo",
      phone: "11999999999",
      email: "a@gmail.com",
      instagram: "",
      birthDate: "2000-01-01",
      source: "autocadastro",
      notes: "",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(a, "clientPortal", "a-uid"), {
      name: "Novo",
      phone: "11999999999",
      email: "a@gmail.com",
      instagram: "",
      birthDate: "2000-01-01",
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(a, "clientAccess", "a-uid"), {
      clientId: "a-uid",
      verifiedGoogleEmail: "a@gmail.com",
      active: true,
      linkedAt: serverTimestamp(),
      linkedBy: "self",
    });
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(a, "clientPortal", "old-a")));
    await assertFails(
      getDoc(doc(a, "clientPortal", "old-a", "projects", "project-1")),
    );
    const owner = env.authenticatedContext("owner-uid", ownerToken).firestore();
    await assertSucceeds(
      setDoc(
        doc(owner, "clientAccess", "a-uid"),
        { active: false },
        { merge: true },
      ),
    );
    await assertFails(getDoc(doc(a, "clientPortal", "a-uid")));
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

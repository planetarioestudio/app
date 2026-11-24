import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { requireDb } from "./firebase";
import { normalize, today } from "./utils";
import type {
  AdminData,
  AnamneseRequest,
  Client,
  ClientAccess,
  Payment,
  PortalPayment,
  PortalProfile,
  PortalProject,
  Project,
} from "./types";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function emailIndexId(email: string) {
  const bytes = new TextEncoder().encode(normalizeEmail(email));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export type Registration = {
  name: string;
  birthDate: string;
  phone: string;
  instagram: string;
};

function profileFields(value: Registration, email: string) {
  return {
    name: value.name.trim(),
    birthDate: value.birthDate,
    phone: value.phone.trim(),
    instagram: value.instagram.trim(),
    email: normalizeEmail(email),
  };
}

export function portalProjectFields(project: Project) {
  return {
    clientId: project.clientId,
    name: project.name,
    description: project.description,
    style: project.style,
    bodyArea: project.bodyArea,
    status: project.status,
    priceCents: project.priceCents,
  };
}

export function portalPaymentFields(payment: Payment, clientId: string) {
  return {
    clientId,
    projectId: payment.projectId,
    kind: payment.kind,
    signedAmountCents: payment.signedAmountCents,
    method: payment.method,
    occurredAt: payment.occurredAt,
    voided: !!payment.voidedAt,
  };
}

export function portalProjectTotals(
  project: PortalProject,
  payments: PortalPayment[],
) {
  const paid = payments
    .filter((payment) => payment.projectId === project.id && !payment.voided)
    .reduce((sum, payment) => sum + payment.signedAmountCents, 0);
  return { paid, remaining: Math.max(0, project.priceCents - paid) };
}

export async function registerClient(user: User, value: Registration) {
  const email = normalizeEmail(user.email || "");
  if (
    !user.emailVerified ||
    !email ||
    !value.name.trim() ||
    !value.phone.trim()
  )
    throw new Error(
      "Preencha os dados obrigatórios com uma conta Google verificada.",
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.birthDate) || value.birthDate > today())
    throw new Error("Informe uma data de nascimento válida.");
  const db = requireDb();
  const settings = await getDoc(doc(db, "portalSettings", "current"));
  if (!settings.exists() || settings.data().enabled !== true)
    throw new Error("O cadastro público ainda está em preparação.");
  const indexRef = doc(db, "clientEmailIndex", await emailIndexId(email));
  const accessRef = doc(db, "clientAccess", user.uid);
  const fields = profileFields(value, email);
  return runTransaction(db, async (tx) => {
    const [access, index] = await Promise.all([
      tx.get(accessRef),
      tx.get(indexRef),
    ]);
    if (access.exists() && !access.data().active)
      throw new Error("Este acesso foi revogado. Contate o estúdio.");
    if (access.exists())
      return {
        id: user.uid,
        clientId: access.data().clientId,
        active: true,
        verifiedGoogleEmail: user.email,
      } as ClientAccess;
    const match =
      index.exists() &&
      index.data().status === "unique" &&
      (!index.data().claimedUid || index.data().claimedUid === user.uid);
    const clientId = match ? index.data().clientId : user.uid;
    const clientRef = doc(db, "clients", clientId);
    const profileRef = doc(db, "clientPortal", clientId);
    if (clientId === user.uid) {
      tx.set(clientRef, {
        ...fields,
        searchName: normalize(fields.name),
        source: "autocadastro",
        notes: "",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (!index.exists())
        tx.set(indexRef, {
          emailLower: email,
          clientId,
          status: "unique",
          claimedUid: user.uid,
        });
    } else {
      tx.update(clientRef, {
        ...fields,
        searchName: normalize(fields.name),
        updatedAt: serverTimestamp(),
      });
      tx.update(indexRef, { claimedUid: user.uid });
    }
    tx.set(accessRef, {
      clientId,
      verifiedGoogleEmail: user.email,
      active: true,
      linkedAt: serverTimestamp(),
      linkedBy: "self",
    });
    tx.set(
      profileRef,
      { ...fields, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return {
      id: user.uid,
      clientId,
      active: true,
      verifiedGoogleEmail: user.email,
    } as ClientAccess;
  });
}

export async function updatePortalContact(
  clientId: string,
  phone: string,
  instagram: string,
) {
  if (!phone.trim()) throw new Error("Informe o WhatsApp.");
  const db = requireDb();
  const batch = writeBatch(db);
  const fields = {
    phone: phone.trim(),
    instagram: instagram.trim(),
    updatedAt: serverTimestamp(),
  };
  batch.update(doc(db, "clients", clientId), fields);
  batch.update(doc(db, "clientPortal", clientId), fields);
  await batch.commit();
}

export type PortalData = {
  profile: PortalProfile | null;
  projects: PortalProject[];
  payments: PortalPayment[];
  requests: AnamneseRequest[];
};

export function watchPortal(
  uid: string,
  clientId: string,
  onChange: (data: PortalData) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const db = requireDb();
  const state: PortalData = {
    profile: null,
    projects: [],
    payments: [],
    requests: [],
  };
  const seen = new Set<string>();
  const emit = (part: string) => {
    seen.add(part);
    if (seen.size === 4) onChange({ ...state });
  };
  const stops = [
    onSnapshot(
      doc(db, "clientPortal", clientId),
      (snap) => {
        state.profile = snap.exists()
          ? ({ id: snap.id, ...snap.data() } as PortalProfile)
          : null;
        emit("profile");
      },
      onError,
    ),
    onSnapshot(
      collection(db, "clientPortal", clientId, "projects"),
      (snap) => {
        state.projects = snap.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as PortalProject,
        );
        emit("projects");
      },
      onError,
    ),
    onSnapshot(
      collection(db, "clientPortal", clientId, "payments"),
      (snap) => {
        state.payments = snap.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as PortalPayment,
        );
        emit("payments");
      },
      onError,
    ),
    onSnapshot(
      query(
        collection(db, "anamneseRequests"),
        where("assignedUid", "==", uid),
        where("clientId", "==", clientId),
      ),
      (snap) => {
        state.requests = snap.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as AnamneseRequest,
        );
        emit("requests");
      },
      onError,
    ),
  ];
  return () => stops.forEach((stop) => stop());
}

export async function createInitialRequest(user: User, clientId: string) {
  const db = requireDb();
  const settingsRef = doc(db, "portalSettings", "current");
  const requestRef = doc(db, "anamneseRequests", `initial_${user.uid}`);
  return runTransaction(db, async (tx) => {
    const [settings, request] = await Promise.all([
      tx.get(settingsRef),
      tx.get(requestRef),
    ]);
    if (
      !settings.exists() ||
      !settings.data().enabled ||
      !settings.data().templateId
    )
      throw new Error("A anamnese inicial ainda não está disponível.");
    if (request.exists()) return requestRef.id;
    tx.set(requestRef, {
      kind: "initial",
      clientId,
      projectId: "",
      assignedUid: user.uid,
      templateId: settings.data().templateId,
      status: "enviada",
      requestedAt: serverTimestamp(),
    });
    return requestRef.id;
  });
}

export async function preparePortal(data: AdminData) {
  const db = requireDb();
  const latest = [...data.formTemplates].sort(
    (a, b) => b.version - a.version,
  )[0];
  if (!latest) throw new Error("Publique a anamnese antes de ativar o portal.");
  const groups = new Map<string, Client[]>();
  for (const client of data.clients) {
    const email = normalizeEmail(client.email || "");
    if (!email) continue;
    groups.set(email, [...(groups.get(email) || []), client]);
  }
  for (const client of data.clients) {
    const profileRef = doc(db, "clientPortal", client.id);
    const existing = await getDoc(profileRef);
    const signed = data.anamneseSubmissions.find(
      (item) => item.clientId === client.id,
    );
    if (!existing.exists()) {
      await setDoc(profileRef, {
        name: client.name,
        birthDate: client.birthDate,
        phone: client.phone,
        email: normalizeEmail(client.email || ""),
        instagram: client.instagram,
        ...(signed ? { initialSignedAt: signed.signedAt } : {}),
        updatedAt: serverTimestamp(),
      });
    } else if (signed && !existing.data().initialSignedAt) {
      await updateDoc(profileRef, { initialSignedAt: signed.signedAt });
    }
  }
  for (const [email, clients] of groups) {
    const indexRef = doc(db, "clientEmailIndex", await emailIndexId(email));
    const linked = data.clientAccess.filter(
      (item) => item.clientId === clients[0]?.id,
    );
    const unique = clients.length === 1 && linked.length <= 1;
    await setDoc(indexRef, {
      emailLower: email,
      clientId: unique ? clients[0]!.id : "",
      status: unique ? "unique" : "ambiguous",
      claimedUid: unique && linked.length === 1 ? linked[0]!.id : "",
    });
  }
  const batchSize = 150;
  const writes: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  for (const project of data.projects)
    writes.push((batch) =>
      batch.set(
        doc(db, "clientPortal", project.clientId, "projects", project.id),
        {
          ...portalProjectFields(project),
          updatedAt: serverTimestamp(),
        },
      ),
    );
  for (const payment of data.payments) {
    const project = data.projects.find((item) => item.id === payment.projectId);
    if (!project) continue;
    writes.push((batch) =>
      batch.set(
        doc(db, "clientPortal", project.clientId, "payments", payment.id),
        {
          ...portalPaymentFields(payment, project.clientId),
          updatedAt: serverTimestamp(),
        },
      ),
    );
  }
  for (let offset = 0; offset < writes.length; offset += batchSize) {
    const batch = writeBatch(db);
    writes.slice(offset, offset + batchSize).forEach((write) => write(batch));
    await batch.commit();
  }
  await setDoc(doc(db, "portalSettings", "current"), {
    enabled: true,
    templateId: latest.id,
    version: latest.version,
    updatedAt: serverTimestamp(),
  });
  return {
    clients: data.clients.length,
    projects: data.projects.length,
    payments: data.payments.length,
    ambiguousEmails: [...groups.values()].filter(
      (clients) => clients.length > 1,
    ).length,
  };
}

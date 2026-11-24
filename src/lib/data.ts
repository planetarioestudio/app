import { getIdTokenResult, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { requireDb, ownerEmail } from "./firebase";
import { lotExpired, stockResult } from "./domain";
import { today } from "./utils";
import type {
  AdminData,
  AnamneseRequest,
  AnamneseSubmission,
  ClientAccess,
  FormTemplate,
  Product,
  StockLot,
} from "./types";

export const collectionNames: (keyof AdminData)[] = [
  "clients",
  "projects",
  "sessions",
  "quotes",
  "payments",
  "expenses",
  "products",
  "stockLots",
  "stockMovements",
  "pendingAccounts",
  "clientAccess",
  "formTemplates",
  "anamneseRequests",
  "anamneseSubmissions",
  "anamneseReviews",
];

export function emptyAdminData(): AdminData {
  return {
    clients: [],
    projects: [],
    sessions: [],
    quotes: [],
    payments: [],
    expenses: [],
    products: [],
    stockLots: [],
    stockMovements: [],
    pendingAccounts: [],
    clientAccess: [],
    formTemplates: [],
    anamneseRequests: [],
    anamneseSubmissions: [],
    anamneseReviews: [],
  };
}

export async function initializeIdentity(
  user: User,
): Promise<"owner" | "client"> {
  const db = requireDb();
  const email = user.email?.toLowerCase();
  const google = user.providerData.some((p) => p.providerId === "google.com");
  if (!user.emailVerified || !google)
    throw new Error("Entre com uma conta Google com email verificado.");
  if (email === ownerEmail.toLowerCase()) {
    const ref = doc(db, "settings", "owner");
    const current = await getDoc(ref);
    if (!current.exists()) {
      await setDoc(ref, { uid: user.uid, email, createdAt: serverTimestamp() });
    } else if (current.data().uid !== user.uid) {
      throw new Error("A conta proprietária já está vinculada a outro UID.");
    }
    return "owner";
  }
  const pending = doc(db, "pendingAccounts", user.uid);
  if (!(await getDoc(pending)).exists()) {
    await setDoc(pending, {
      uid: user.uid,
      verifiedGoogleEmail: email,
      requestedAt: serverTimestamp(),
    });
  }
  return "client";
}

export function watchAdmin(
  onChange: (data: AdminData) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const db = requireDb();
  const state = emptyAdminData();
  const seen = new Set<string>();
  const stops = collectionNames.map((name) =>
    onSnapshot(
      collection(db, name),
      (snap) => {
        // Only the owner receives collection listeners. Clients use single-document reads.
        (state as unknown as Record<string, DocumentData[]>)[name] =
          snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        seen.add(name);
        if (seen.size === collectionNames.length) onChange({ ...state });
      },
      onError,
    ),
  );
  return () => stops.forEach((stop) => stop());
}

export async function createRecord(name: keyof AdminData, data: DocumentData) {
  return addDoc(collection(requireDb(), name), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
export async function editRecord(
  name: keyof AdminData,
  id: string,
  data: DocumentData,
) {
  return updateDoc(doc(requireDb(), name, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}
export async function createFixedRecord(
  name: keyof AdminData,
  id: string,
  data: DocumentData,
) {
  return setDoc(doc(requireDb(), name, id), {
    ...data,
    createdAt: serverTimestamp(),
  });
}
export async function getRecord<T>(
  name: string,
  id: string,
): Promise<T | null> {
  const snap = await getDoc(doc(requireDb(), name, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
}

export async function linkClient(
  uid: string,
  clientId: string,
  email: string,
  ownerUid: string,
) {
  await setDoc(doc(requireDb(), "clientAccess", uid), {
    clientId,
    verifiedGoogleEmail: email,
    active: true,
    linkedAt: serverTimestamp(),
    linkedBy: ownerUid,
  });
}
export async function revokeClient(uid: string) {
  await updateDoc(doc(requireDb(), "clientAccess", uid), { active: false });
}
export async function publishTemplate(
  data: Pick<FormTemplate, "questions" | "procedureTerm" | "imageConsentTerm">,
  version: number,
) {
  return createRecord("formTemplates", {
    ...data,
    questionIds: data.questions.flatMap((q) =>
      q.followUp ? [q.id, q.followUp.id] : [q.id],
    ),
    requiredQuestionIds: data.questions
      .filter((q) => q.required)
      .map((q) => q.id),
    version,
    publishedAt: serverTimestamp(),
  });
}
export async function createAnamneseRequest(
  data: Pick<
    AnamneseRequest,
    "clientId" | "projectId" | "assignedUid" | "templateId"
  > & { expiresAt: string },
) {
  return createRecord("anamneseRequests", {
    ...data,
    expiresAt: Timestamp.fromDate(new Date(data.expiresAt)),
    status: "enviada",
    requestedAt: serverTimestamp(),
  });
}

export async function submitAnamnese(
  user: User,
  request: AnamneseRequest,
  template: FormTemplate,
  answers: Record<string, string>,
  imageUseAccepted: boolean,
) {
  const db = requireDb();
  const ref = doc(db, "anamneseSubmissions", request.id);
  const token = await getIdTokenResult(user, true);
  const authTimeSeconds = Math.floor(Date.parse(token.authTime) / 1000);
  const payload: Omit<AnamneseSubmission, "id"> = {
    clientId: request.clientId,
    projectId: request.projectId,
    requestId: request.id,
    googleUid: user.uid,
    googleEmail: user.email || "",
    templateId: template.id,
    version: template.version,
    answers,
    procedureAccepted: true,
    imageUseAccepted,
    authMethod: "google.com",
    authTimeSeconds,
    signedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
}

export async function addProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt" | "quantity">,
) {
  return createRecord("products", { ...data, quantity: 0 });
}

export type StockAction = {
  operationId: string;
  productId: string;
  lotId?: string;
  lotNumber?: string;
  expiryDate?: string;
  supplierName?: string;
  sessionId?: string;
  type: "entrada" | "consumo" | "perda" | "ajuste";
  quantityDelta: number;
  unitCostCents: number;
  note: string;
};

export async function recordStock(
  action: StockAction,
  db: Firestore = requireDb(),
) {
  if (!Number.isFinite(action.quantityDelta) || action.quantityDelta === 0)
    throw new Error("Informe uma quantidade válida.");
  if (action.type === "entrada" && action.quantityDelta < 0)
    throw new Error("Entrada deve ser positiva.");
  if (["consumo", "perda"].includes(action.type) && action.quantityDelta > 0)
    throw new Error("Baixa deve ser negativa.");
  if (action.type === "consumo" && !action.sessionId)
    throw new Error("Selecione a sessão.");
  const productRef = doc(db, "products", action.productId);
  const lotRef = action.lotId
    ? doc(db, "stockLots", action.lotId)
    : doc(collection(db, "stockLots"));
  const movementRef = doc(db, "stockMovements", action.operationId);
  return runTransaction(db, async (transaction) => {
    const [prior, productSnap, lotSnap] = await Promise.all([
      transaction.get(movementRef),
      transaction.get(productRef),
      action.lotId ? transaction.get(lotRef) : Promise.resolve(null),
    ]);
    if (prior.exists()) return prior.id;
    if (!productSnap.exists()) throw new Error("Produto não encontrado.");
    if (action.lotId && !lotSnap?.exists())
      throw new Error("Lote não encontrado.");
    if (!action.lotId && action.type !== "entrada")
      throw new Error("Selecione um lote.");
    const product = productSnap.data() as Product;
    const lot = lotSnap?.data() as StockLot | undefined;
    if (lot && lot.productId !== action.productId)
      throw new Error("Lote de outro produto.");
    if (action.type === "consumo" && lotExpired(lot?.expiryDate || "", today()))
      throw new Error("Lote vencido.");
    const { product: productQuantity, lot: lotQuantity } = stockResult(
      product.quantity,
      lot?.quantity || 0,
      action.quantityDelta,
    );
    transaction.update(productRef, {
      quantity: productQuantity,
      updatedAt: serverTimestamp(),
    });
    if (lot) transaction.update(lotRef, { quantity: lotQuantity });
    else
      transaction.set(lotRef, {
        productId: action.productId,
        lotNumber: action.lotNumber || "",
        expiryDate: action.expiryDate || "",
        supplierName: action.supplierName || "",
        unitCostCents: action.unitCostCents,
        quantity: lotQuantity,
        createdAt: serverTimestamp(),
      });
    transaction.set(movementRef, {
      productId: action.productId,
      lotId: lotRef.id,
      sessionId: action.sessionId || "",
      type: action.type,
      quantityDelta: action.quantityDelta,
      unitCostCents: action.unitCostCents,
      occurredAt: new Date().toISOString(),
      note: action.note,
      operationId: action.operationId,
      createdAt: serverTimestamp(),
    });
    return movementRef.id;
  });
}

export async function getAccess(uid: string): Promise<ClientAccess | null> {
  return getRecord<ClientAccess>("clientAccess", uid);
}

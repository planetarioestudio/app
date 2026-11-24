import type { Timestamp } from "firebase/firestore";

export type RecordBase = {
  id: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};
export type Client = RecordBase & {
  name: string;
  searchName: string;
  phone: string;
  email: string;
  instagram: string;
  birthDate: string;
  source: string;
  notes: string;
  active: boolean;
};
export type Project = RecordBase & {
  clientId: string;
  name: string;
  description: string;
  style: string;
  bodyArea: string;
  status: string;
  priceCents: number;
  estimatedMinutes: number;
  notes: string;
};
export type Session = RecordBase & {
  projectId: string;
  startAt: string;
  endAt: string;
  status: string;
  plannedMinutes: number;
  actualMinutes: number;
  realizedValueCents: number;
  notes: string;
};
export type Quote = RecordBase & {
  projectId: string;
  version: number;
  status: string;
  description: string;
  hours: number;
  hourlyCostCents: number;
  materialsCents: number;
  otherCents: number;
  marginPercent: number;
  priceCents: number;
  depositCents: number;
  validUntil: string;
  terms: string;
  sentAt?: unknown;
  decidedAt?: unknown;
};
export type Payment = RecordBase & {
  projectId: string;
  sessionId: string;
  kind: string;
  signedAmountCents: number;
  method: string;
  occurredAt: string;
  note: string;
  originalPaymentId: string;
  voidedAt?: unknown;
  voidReason?: string;
};
export type Expense = RecordBase & {
  category: string;
  amountCents: number;
  paidAt: string;
  method: string;
  projectId: string;
  note: string;
};
export type Product = RecordBase & {
  name: string;
  unit: string;
  category: string;
  quantity: number;
  minQuantity: number;
  defaultUnitCostCents: number;
  active: boolean;
};
export type StockLot = RecordBase & {
  productId: string;
  lotNumber: string;
  expiryDate: string;
  supplierName: string;
  quantity: number;
  unitCostCents: number;
};
export type StockMovement = RecordBase & {
  productId: string;
  lotId: string;
  sessionId: string;
  type: string;
  quantityDelta: number;
  unitCostCents: number;
  occurredAt: string;
  note: string;
  operationId: string;
};
export type PendingAccount = RecordBase & {
  uid: string;
  verifiedGoogleEmail: string;
  requestedAt?: unknown;
};
export type ClientAccess = RecordBase & {
  clientId: string;
  verifiedGoogleEmail: string;
  active: boolean;
  linkedAt?: unknown;
  linkedBy: string;
};
export type FormQuestion = {
  id: string;
  label: string;
  required: boolean;
  type: "text" | "yesno";
};
export type FormTemplate = RecordBase & {
  version: number;
  questions: FormQuestion[];
  questionIds: string[];
  requiredQuestionIds: string[];
  procedureTerm: string;
  imageConsentTerm: string;
  publishedAt?: unknown;
};
export type AnamneseRequest = RecordBase & {
  clientId: string;
  projectId: string;
  assignedUid: string;
  templateId: string;
  expiresAt: Timestamp;
  status: "criada" | "enviada" | "revogada";
  requestedAt?: unknown;
};
export type AnamneseSubmission = RecordBase & {
  clientId: string;
  projectId: string;
  requestId: string;
  googleUid: string;
  googleEmail: string;
  templateId: string;
  version: number;
  answers: Record<string, string>;
  procedureAccepted: boolean;
  imageUseAccepted: boolean;
  signedAt?: unknown;
  authMethod: string;
  authTimeSeconds: number;
};
export type AnamneseReview = RecordBase & {
  reviewerUid: string;
  reviewedAt?: unknown;
  outcome: string;
  note: string;
};
export type AdminData = {
  clients: Client[];
  projects: Project[];
  sessions: Session[];
  quotes: Quote[];
  payments: Payment[];
  expenses: Expense[];
  products: Product[];
  stockLots: StockLot[];
  stockMovements: StockMovement[];
  pendingAccounts: PendingAccount[];
  clientAccess: ClientAccess[];
  formTemplates: FormTemplate[];
  anamneseRequests: AnamneseRequest[];
  anamneseSubmissions: AnamneseSubmission[];
  anamneseReviews: AnamneseReview[];
};

import type { FormQuestion, Payment, Quote, StockLot } from "./types";

export function visibleAnswers(
  questions: FormQuestion[],
  answers: Record<string, string>,
) {
  const result: Record<string, string> = {};
  for (const question of questions) {
    const answer = answers[question.id]?.trim();
    if (answer) result[question.id] = answer;
    if (question.followUp && answer === question.followUp.when) {
      const followUpAnswer = answers[question.followUp.id]?.trim();
      if (followUpAnswer) result[question.followUp.id] = followUpAnswer;
    }
  }
  return result;
}

export function missingRequiredAnswer(
  questions: FormQuestion[],
  answers: Record<string, string>,
) {
  return questions.some(
    (question) =>
      (question.required && !answers[question.id]?.trim()) ||
      (question.followUp?.required &&
        answers[question.id] === question.followUp.when &&
        !answers[question.followUp.id]?.trim()),
  );
}

export function suggestedPrice(
  hours: number,
  hourlyCostCents: number,
  materialsCents: number,
  otherCents: number,
  marginPercent: number,
) {
  if (marginPercent < 0 || marginPercent >= 100)
    throw new Error("A margem deve estar entre 0% e 99%.");
  const cost = hours * hourlyCostCents + materialsCents + otherCents;
  return Math.round(cost / (1 - marginPercent / 100));
}
export function projectPaid(payments: Payment[], projectId: string) {
  return payments
    .filter((p) => p.projectId === projectId && !p.voidedAt)
    .reduce((sum, p) => sum + p.signedAmountCents, 0);
}
export function nextQuoteVersion(quotes: Quote[], projectId: string) {
  return (
    Math.max(
      0,
      ...quotes.filter((q) => q.projectId === projectId).map((q) => q.version),
    ) + 1
  );
}
export function expiringLots(lots: StockLot[], days = 30, now = new Date()) {
  const limit = new Date(now.getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
  return lots.filter(
    (l) => l.quantity > 0 && !!l.expiryDate && l.expiryDate <= limit,
  );
}
export function stockResult(
  productQuantity: number,
  lotQuantity: number,
  delta: number,
) {
  if (
    ![productQuantity, lotQuantity, delta].every(Number.isFinite) ||
    delta === 0
  )
    throw new Error("Quantidade inválida.");
  const product = Number((productQuantity + delta).toFixed(3));
  const lot = Number((lotQuantity + delta).toFixed(3));
  if (product < 0 || lot < 0) throw new Error("Saldo insuficiente.");
  return { product, lot };
}
export function lotExpired(expiryDate: string, today: string) {
  return !!expiryDate && expiryDate < today;
}

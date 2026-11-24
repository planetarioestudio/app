import { readFile } from "node:fs/promises";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const names = [
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
const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const file = value("--file");
const projectId = value("--project");
const confirmation = value("--confirm");

if (!file || !projectId) {
  console.error(
    "Uso: npm run backup:restore -- --file backups/arquivo.json --project ID [--confirm ID]",
  );
  process.exit(1);
}
const backup = JSON.parse(await readFile(file, "utf8"));
if (
  backup.format !== "planetario-backup-v1" ||
  !backup.collections ||
  !names.every((name) => Array.isArray(backup.collections[name]))
) {
  throw new Error("Arquivo de backup incompatível.");
}
const counts = Object.fromEntries(
  names.map((name) => [name, backup.collections[name].length]),
);
console.log({
  arquivo: file,
  projetoDoBackup: backup.projectId,
  projetoDestino: projectId,
  registros: counts,
});
if (!confirmation) {
  console.log(
    "Prévia concluída. Para escrever em um banco vazio, repita com --confirm ID_DO_PROJETO.",
  );
  process.exit(0);
}
if (confirmation !== projectId)
  throw new Error("A confirmação precisa ser igual ao ID do projeto destino.");
if (
  backup.projectId !== projectId &&
  !args.includes("--allow-different-project")
)
  throw new Error(
    "Projeto diferente do backup. Para ensaio isolado, adicione --allow-different-project.",
  );
if (
  !process.env.FIRESTORE_EMULATOR_HOST &&
  !process.env.GOOGLE_APPLICATION_CREDENTIALS
)
  throw new Error(
    "Defina GOOGLE_APPLICATION_CREDENTIALS apontando para um arquivo local de conta de serviço. Nunca coloque esse arquivo no Git.",
  );

initializeApp({
  projectId,
  ...(!process.env.FIRESTORE_EMULATOR_HOST
    ? { credential: applicationDefault() }
    : {}),
});
const db = getFirestore();
for (const name of names) {
  const existing = await db.collection(name).limit(1).get();
  if (!existing.empty)
    throw new Error(
      `Banco não está vazio: ${name}. Restauração cancelada antes de gravar.`,
    );
}
function revive(value) {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === "object") {
    if (
      value.type === "firestore/timestamp/1.0" &&
      Number.isInteger(value.seconds) &&
      Number.isInteger(value.nanoseconds)
    )
      return new Timestamp(value.seconds, value.nanoseconds);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, revive(item)]),
    );
  }
  return value;
}
const records = names.flatMap((name) =>
  backup.collections[name].map((record) => ({ name, record })),
);
for (const { name, record } of records) {
  if (
    !record ||
    typeof record !== "object" ||
    typeof record.id !== "string" ||
    !record.id ||
    record.id.includes("/")
  )
    throw new Error(`Registro inválido em ${name}.`);
}
for (let i = 0; i < records.length; i += 400) {
  const batch = db.batch();
  for (const { name, record } of records.slice(i, i + 400)) {
    const { id, ...body } = record;
    batch.create(db.collection(name).doc(id), revive(body));
  }
  await batch.commit();
  console.log(
    `${Math.min(i + 400, records.length)}/${records.length} registros restaurados`,
  );
}
console.log(
  "Restauração concluída. Confira vínculos, termos e fichas antes do uso real.",
);

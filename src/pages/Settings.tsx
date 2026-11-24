import { useState } from "react";
import type { User } from "firebase/auth";
import { Button, PageTitle, Section } from "../components";
import type { AdminData } from "../lib/types";
import { requireDb } from "../lib/firebase";
import { download } from "../lib/utils";
import { normalizeEmail, preparePortal } from "../lib/portal";
import { errorMessage } from "../lib/utils";

export function SettingsPage({
  data,
  user,
  theme,
  setTheme,
}: {
  data: AdminData;
  user: User;
  theme: string;
  setTheme: (theme: string) => void;
}) {
  const [exported, setExported] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [portalReport, setPortalReport] = useState("");
  const [portalError, setPortalError] = useState("");
  const emails = data.clients
    .map((client) => normalizeEmail(client.email || ""))
    .filter(Boolean);
  const duplicateEmails = new Set(
    emails.filter((email, index) => emails.indexOf(email) !== index),
  );
  async function activatePortal() {
    setPreparing(true);
    setPortalError("");
    try {
      const result = await preparePortal(data);
      setPortalReport(
        `${result.clients} clientes, ${result.projects} projetos e ${result.payments} pagamentos preparados. ${result.ambiguousEmails} e-mails duplicados precisam de conciliação manual.`,
      );
    } catch (err) {
      setPortalError(errorMessage(err));
    } finally {
      setPreparing(false);
    }
  }
  function exportData() {
    const payload = {
      format: "planetario-backup-v1",
      exportedAt: new Date().toISOString(),
      projectId: requireDb().app.options.projectId,
      ownerUid: user.uid,
      collections: data,
    };
    download(
      `planetario-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    setExported(true);
  }
  return (
    <>
      <PageTitle
        eyebrow="PREFERÊNCIAS"
        title="Configurações"
        subtitle="Sua conta, aparência e cópia de segurança."
      />
      <div className="two-col">
        <Section title="Conta proprietária">
          <div className="detail-lines">
            <p>
              <span>Email</span>
              <strong>{user.email}</strong>
            </p>
            <p>
              <span>UID</span>
              <strong className="break">{user.uid}</strong>
            </p>
            <p>
              <span>Projeto Firebase</span>
              <strong>{requireDb().app.options.projectId}</strong>
            </p>
          </div>
        </Section>
        <Section title="Aparência">
          <p>Escolha o tema que fica mais confortável para trabalhar.</p>
          <div className="button-row">
            <Button
              variant={theme === "light" ? "primary" : "secondary"}
              onClick={() => setTheme("light")}
            >
              Claro
            </Button>
            <Button
              variant={theme === "dark" ? "primary" : "secondary"}
              onClick={() => setTheme("dark")}
            >
              Escuro
            </Button>
          </div>
        </Section>
      </div>
      <Section title="Cópia de segurança">
        <p>
          Baixe regularmente uma cópia dos registros. O arquivo contém dados
          pessoais e de saúde em texto legível: guarde-o em local protegido,
          fora do Git e de pastas compartilhadas.
        </p>
        <Button onClick={exportData}>Baixar backup JSON</Button>
        {exported && (
          <p className="notice success">
            Backup baixado. Guarde o arquivo com cuidado.
          </p>
        )}
        <p>
          A restauração exige uma ferramenta administrativa local e deve ser
          ensaiada em um projeto Firebase isolado antes de atender clientes
          reais. O procedimento está no README.
        </p>
      </Section>
      <Section title="Ativar cadastro e área do cliente">
        <p>
          Antes de compartilhar o link único, confira os cadastros existentes e
          baixe o backup acima. A preparação cria uma visão segura de projetos e
          pagamentos para cada cliente.
        </p>
        <p>
          {data.clients.length} clientes ·{" "}
          {
            data.clients.filter((client) => !normalizeEmail(client.email || ""))
              .length
          }{" "}
          sem e-mail · {duplicateEmails.size} e-mails duplicados.
        </p>
        {duplicateEmails.size > 0 && (
          <p className="notice warning">
            E-mails duplicados: {[...duplicateEmails].join(", ")}. Eles não
            serão associados automaticamente.
          </p>
        )}
        {data.clients.filter((client) => !normalizeEmail(client.email || ""))
          .length > 0 && (
          <p className="notice warning">
            Cadastros sem e-mail:{" "}
            {data.clients
              .filter((client) => !normalizeEmail(client.email || ""))
              .map((client) => client.name)
              .join(", ")}
            .
          </p>
        )}
        <Button onClick={activatePortal} disabled={!exported || preparing}>
          {preparing ? "Preparando…" : "Preparar e ativar portal"}
        </Button>
        {!exported && (
          <p className="request-meta">
            Baixe o backup JSON nesta sessão para liberar a preparação.
          </p>
        )}
        {portalReport && <p className="notice success">{portalReport}</p>}
        {portalError && (
          <p className="notice error" role="alert">
            {portalError}
          </p>
        )}
      </Section>
      <Section title="Sobre o aplicativo">
        <p>
          Planetário Estúdio · uso pessoal. Código no GitHub; registros no
          Firebase. A URL pública não concede acesso aos dados.
        </p>
      </Section>
    </>
  );
}

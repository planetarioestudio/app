# Planetário Estúdio

Aplicativo pessoal para clientes, projetos, agenda, anamnese com login Google, orçamentos, caixa e estoque. O frontend roda localmente com Vite e poderá ser publicado pelo GitHub Pages. Os dados ficam no Firebase Auth/Firestore. Fotos e arquivos ficam para uma fase posterior.

## Rodar localmente

Requisitos: Node.js 22 ou superior, npm e um projeto Firebase próprio.

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha os valores do aplicativo Web do Firebase. Use `VITE_OWNER_EMAIL=planetariomkt@gmail.com`.
3. `npm run dev` e abra `http://localhost:5173`.

O app não mostra dados sem a configuração. O arquivo `.env.local` não entra no Git. A configuração Web do Firebase pode aparecer no frontend; nenhuma chave de conta de serviço deve ser colocada ali.

## Configurar Firebase e Google

1. Entre em [Firebase Console](https://console.firebase.google.com/) com a conta que administrará o projeto. Crie o projeto **Planetário Estúdio** e registre um aplicativo **Web**. Copie os campos `apiKey`, `authDomain`, `projectId`, `appId` e `messagingSenderId` para `.env.local` com os nomes de `.env.example`.
2. Em **Authentication → Sign-in method**, ative **Google** e defina o email de suporte solicitado. Em **Authentication → Settings → Authorized domains**, adicione `localhost`. Projetos criados após abril de 2025 não incluem `localhost` automaticamente. Para publicar no Pages mais tarde, adicione também `maximusgugu.github.io`.
3. Em **Firestore Database**, crie o banco `(default)` em **Production mode** e escolha a região antes de salvar. O modo de produção começa bloqueado.
4. Instale/deixe disponível o Firebase CLI, entre com `npx firebase login`, e publique as regras deste repositório: `npx firebase deploy --only firestore:rules,firestore:indexes --project SEU_PROJECT_ID`. Confira no Console que as regras publicadas correspondem a `firestore.rules` **antes** de usar o app.
5. Inicie o app e entre com `planetariomkt@gmail.com`. No primeiro login, essa conta cria o documento `settings/owner` com o próprio UID. A partir daí, as regras exigem esse UID para a área privada. O email precisa estar verificado e o provedor deve ser Google.
6. Para um cliente: cadastre-o no painel; peça que ele entre com a própria conta Google pelo link do app; em **Anamneses**, confira pessoalmente a conta pendente e vincule ao cadastro certo. Publique perguntas e termos revisados, crie a solicitação no cadastro do cliente e envie o link. O cliente reautentica com Google ao acionar **Concordo e assino**.

**Antes de dados reais de saúde:** valide termos, perguntas, retenção, menores e exigências locais; teste regras com duas contas distintas; exporte um backup e ensaie a restauração em projeto isolado. O login Google registra um aceite eletrônico associado à conta, sem substituir avaliação jurídica da assinatura.

## Verificações

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run firebase:rules:test` (requer Java 21 e Emulator Suite)

## Backups

Baixe o JSON em **Configurações** e guarde fora do Git. Para restaurar, use um ambiente local com `firebase-admin` e credenciais administrativas em arquivo protegido:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS='C:\caminho\seguro\firebase-admin-key.json'
npm run backup:restore -- --file backups\planetario-backup.json --project SEU_PROJECT_ID
npm run backup:restore -- --file backups\planetario-backup.json --project SEU_PROJECT_ID --confirm SEU_PROJECT_ID
```

O primeiro comando só mostra a prévia. A restauração recusa banco com registros existentes. Para ensaiar em outro projeto vazio, acrescente `--allow-different-project` ao comando confirmado. Contas Auth não são recriadas pelo backup; num projeto diferente, os UIDs de clientes precisarão ser vinculados novamente. Nunca envie o arquivo de credenciais ou backup ao GitHub.

## GitHub Pages

O workflow `.github/workflows/pages.yml` constrói o site quando o repositório receber um push na `main`. Configure no GitHub **Settings → Secrets and variables → Actions → Variables** os campos `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` e `FIREBASE_MESSAGING_SENDER_ID`. Em **Settings → Pages**, selecione **GitHub Actions**. O Firebase precisa autorizar `maximusgugu.github.io` para login. Publique regras Firestore antes de compartilhar a URL com clientes.

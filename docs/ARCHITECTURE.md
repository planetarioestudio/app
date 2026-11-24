# Planetário Estúdio — arquitetura simples

## 1. Como o sistema roda

```text
GitHub (código) → GitHub Actions (build Vite) → GitHub Pages (HTML/CSS/JS)
                                                   ↓ áreas admin e cliente
Firebase Authentication (Google) ───────────────────┤
Cloud Firestore (registros e anamneses) ────────────┤
Firebase Storage (fotos, fase 5) ────────────────────┘
```

**Stack:** Vite + React + TypeScript, CSS/Tailwind conforme necessidade, Firebase SDK modular, Firestore, Auth e Storage opcional. GitHub Pages publica apenas arquivos estáticos. Next.js com servidor, Vercel, Supabase, PostgreSQL e API própria saem do plano. A [documentação do Vite](https://vite.dev/guide/static-deploy.html#github-pages) descreve o build por GitHub Actions e o `base` exigido para repositórios em `/<repo>/`. Usar hash routing (`/#/clientes`) evita erro 404 em rotas internas do Pages.

O Firebase oferece acesso direto do navegador ao Firestore mediante Auth e Security Rules. O cliente pode ser inspecionado; configuração pública do SDK não é senha. Nenhum segredo de serviço, credencial administrativa ou dado de cliente pode entrar no bundle. As [regras do Firestore](https://firebase.google.com/docs/firestore/security/overview) são a barreira de autorização.

O [lista-queeridas](https://github.com/MaximusGugu/lista-queeridas/blob/main/firestore.rules) serve de referência para separar área administrativa e entrada pública. Aqui a entrada da anamnese **não é anônima**: exige conta Google verificada e vínculo `UID → clientId` aprovado pelo proprietário. Reaproveitar o conceito de regras por papel, sem copiar as regras de inscrições públicas ou credenciais OAuth do outro projeto. Para o login, partir do fluxo do [botão Google do app de referência](https://github.com/MaximusGugu/lista-queeridas/blob/main/google-signin.js): credencial Google → Firebase Auth; configurar um OAuth client próprio e testar navegadores móveis.

## 2. Organização de arquivos

```text
src/app/                  shell, rotas e inicialização
src/features/clients/     telas e operações de clientes
src/features/projects/    projetos e sessões
src/features/agenda/      calendário e conflitos
src/features/anamnesis/   formulário, aceite e revisão
src/features/quotes/      precificação e PDF
src/features/finance/     pagamentos e despesas
src/features/stock/       estoque e lotes (fase 4)
src/components/           design system compartilhado
src/lib/firebase/         SDK, Auth, Firestore e Storage
src/lib/                   datas, BRL, validação e exportação
firestore.rules            regras versionadas e testadas
storage.rules              regras versionadas (fase 5)
tests/                    regras e fluxos críticos
.github/workflows/         build e deploy do Pages
docs/                     especificação
```

Domínios compartilham IDs, não cópias de registros. Consultas são limitadas e ordenadas; não baixar a coleção inteira para montar cada tela. Estado de interface e validação ficam no React; operações atômicas usam `runTransaction`/batch do Firestore, segundo a [documentação Firebase](https://firebase.google.com/docs/firestore/manage-data/transactions).

## 3. Deploy e ambientes

1. Criar repositório GitHub dedicado; o workspace atual ainda não é repositório Git.
2. Criar projeto Firebase de desenvolvimento e configurar login Google + Firestore em modo restrito. O primeiro login Google verificado de `planetariomkt@gmail.com` cria `settings/owner` com o UID da conta; depois as regras exigem esse UID. Clientes Google autenticados recebem somente acesso pendente até vínculo explícito ao cadastro.
3. Configurar `base` do Vite para `/<nome-do-repositorio>/`, autorizando o domínio GitHub Pages no Auth. No GitHub Pages, selecionar **GitHub Actions** como fonte e publicar `dist` após `npm ci`, testes e build.
4. Separar projeto Firebase de produção antes de dados reais. Configuração web (API key, project ID) pode estar no build; segredos administrativos não. Regras de produção são implantadas junto com a versão do app e testadas antes. Configurar OAuth próprio do Planetário Estúdio; não usar o client ID do `lista-queeridas`.

Uma instalação pessoal não precisa de backend, Cloud Functions, fila ou serviço de email no início. O cliente recebe o endereço da anamnese manualmente. **O aceite autenticado via Google é um registro eletrônico de ação**, não certificado de identidade civil ou assinatura qualificada; se a avaliação jurídica exigir prova adicional, reavaliar backend/provedor de assinatura antes do lançamento.

## 4. Limites técnicos assumidos

- O Pages não executa lógica no servidor. Gerar PDF e CSV no navegador; o proprietário envia o arquivo ou link manualmente. Sem webhook e sem agendamento de mensagens pelo app.
- Cliente entra com Google pelo Firebase Auth; primeira entrada cria apenas solicitação pendente (`UID`, email verificado, momento). O proprietário confere e vincula ao `clientId`. Só então a conta pode abrir a versão vigente da anamnese, enviar uma submissão e consultar a própria cópia. A área administrativa continua exclusiva do proprietário.
- Formulário publicado é versionado; submissão armazena `clientId`, UID Google, email verificado, versão/texto do termo, respostas, escolhas de consentimento e horário do servidor. Reautenticar com Google antes do botão **“Concordo e assino”** ou exigir sessão recente; submissão é criada uma vez e não pode ser editada pelo cliente. Correção gera nova revisão. A revisão profissional fica em registro separado.
- A agenda verifica conflitos ao salvar e avisa o usuário. Como as regras do Firestore não consultam intervalos arbitrários de outras sessões, não prometer bloqueio transacional forte de sobreposição nesta versão de um usuário. Reavaliar para equipe simultânea.
- Dinheiro é guardado em **centavos inteiros**; cálculos percentuais usam decimal e arredondamento explícito. Instantes em UTC; exibição em `America/Sao_Paulo`.
- O Firestore não é banco relacional: a aplicação valida referências e usa IDs estáveis; regras validam proprietário, campos permitidos e formatos básicos. Evitar duplicar totais persistidos quando podem ser derivados em consultas pequenas.
- Transações Firestore precisam de rede. Consumo/entrada atualizam saldo do produto, saldo do lote e movimento numa transação; cliente não vê sucesso provisório no cache offline. Operações financeiras e mudanças de estado críticas também exigem confirmação do servidor.

## 5. Operação e qualidade

Testar funções de preço/saldo/status, regras do Firestore com Emulator Suite, fluxos E2E de login admin→cliente→projeto→sessão, solicitação de vínculo→aprovação→anamnese→aceite→revisão, responsividade e acesso negado. No deploy, rodar `typecheck`, lint, testes e build; publicar somente se passarem. Monitorar erros, uso e cobrança pelo console Firebase. Exportar dados periodicamente; **testar restauração antes da primeira coleta de saúde**. O [Firebase Storage exige plano Blaze](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), mesmo quando o consumo permanece em faixa sem cobrança.

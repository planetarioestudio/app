# Planetário Estúdio — segurança, anamnese e privacidade

## 1. Duas áreas, uma base privada

O GitHub Pages publica HTML/CSS/JS para todos. O [lista-queeridas](https://github.com/MaximusGugu/lista-queeridas/blob/main/firestore.rules) inspira a separação entre **área privada de administração** e **entrada pública de formulário**. O Planetário usa regras próprias: o formulário é alcançável por URL, mas **não é anônimo**. Cliente precisa entrar com Google e ter o UID vinculado ao cadastro do estúdio. Firebase Authentication identifica a conta; [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/overview) autorizam cada leitura/gravação. Esconder menus não protege dados.

| Ação | Proprietário Google autorizado | Cliente Google vinculado | Pendente/outro UID/visitante |
|---|---|---|---|
| Clientes, projetos, agenda, financeiro e estoque | Ler/gravar | Negado | Negado |
| Pendências de vínculo | Listar, aprovar e revogar | Criar/ler apenas a própria solicitação | Visitante negado |
| Solicitação/modelo de anamnese | Criar e revisar | Ler somente solicitação atribuída e modelo publicado | Negado |
| Respostas e aceite | Ler; não sobrescrever submissão assinada | Criar uma vez para a própria solicitação; ler própria cópia | Negado |
| Fotos/arquivos da fase 5 | Ler/gravar | Negado por padrão | Negado |

## 2. Vínculo Google → cliente

Login usa provedor Google via [Firebase Auth](https://firebase.google.com/docs/auth/web/google-signin). Verificar `email_verified`, provedor Google e UID. A primeira entrada de um cliente cria apenas `pendingAccounts/{uid}` com email da credencial, sem acesso a clientes ou saúde. O proprietário confere com a pessoa qual conta usar e cria `clientAccess/{uid}` apontando ao **`clientId` existente**, além de email verificado e estado ativo. Só o proprietário pode criar, alterar ou revogar o vínculo. Não vincular automaticamente por nome, email digitado ou posse do link. Mudança de conta Google exige novo vínculo; revogação corta futuras leituras.

Configurar domínio GitHub Pages no Auth e OAuth próprio do Planetário Estúdio; não reutilizar o client ID do outro app. Proteger conta do proprietário e console Google com MFA. Configuração web Firebase pode ser pública; credenciais de serviço, tokens de sessão e dados de clientes não entram no Git ou build.

## 3. Regras Firestore e integridade

- Começar com **deny all**. O bootstrap de `settings/owner` exige a conta Google verificada `planetariomkt@gmail.com`; após isso, a regra administrativa exige o UID exato armazenado. Não usar `request.auth != null` como autorização geral.
- Cliente só pode criar `pendingAccounts/{seuUid}` com UID/email igual ao token Google verificado, sem campos extras. Não pode escrever `clientAccess`, `clients`, projetos ou modelos.
- Solicitação `anamneseRequests/{id}` é criada pelo proprietário com `assignedUid`, `clientId`, projeto e versão do formulário. Cliente só faz `get` dessa solicitação quando `clientAccess/{uid}` ativo aponta ao mesmo `clientId` e `assignedUid == uid`. Link/ID sozinho não autoriza. Pedido vencido ou revogado bloqueia envio.
- Submissão `anamneseSubmissions/{requestId}` aceita **create somente uma vez**, pelo UID vinculado, com `clientId`, `projectId`, versão e pedido coerentes. Regras limitam chaves/tipos/tamanho e exigem `signedAt == request.time`; `update`/`delete` do cliente são negados. O proprietário registra revisão em documento separado, sem editar a resposta assinada.
- A ação final exige login Google recente. O app solicita reautenticação antes de “Concordo e assino”; regras devem conferir `auth_time` recente, com teste no emulador. O token do usuário é validado pelo Firebase nas regras, e o horário de assinatura vem do servidor. Sessão velha ou rede indisponível impedem confirmar.
- Templates publicados são versionados e imutáveis; a submissão referencia o template exato e guarda escolhas separadas. Regras conferem que versão e pedido coincidem. A cópia combina submissão e texto desse template. Não armazenar senha, token OAuth ou foto de documento de identidade como substituto de validação jurídica.

## 4. O que a “assinatura” registra

Guardar UID Firebase, email Google verificado, método de login, momento de autenticação, horário de envio do servidor, solicitação, `clientId`, respostas, ID/versão do termo imutável e aceite explícito. Gerar cópia imprimível que reúna respostas e texto daquela versão para cliente e estúdio. Autorização de uso de imagem é escolha separada, opcional e não pré-marcada. Registrar eventual revogação posterior sem apagar o aceite histórico.

Esse processo documenta um **aceite eletrônico associado a uma conta Google**. Login não comprova sozinho identidade civil, autoria incontestável ou assinatura qualificada. A [MP 2.200-2/2001, art. 10, §2º](https://www.gov.br/iti/pt-br/acesso-a-informacao/perguntas-frequentes/certificacao-digital) admite outros meios de comprovação de autoria/integridade sob condições; um profissional jurídico deve avaliar o termo e a prova adequada para o caso concreto antes do uso real. Se for exigida modalidade mais forte, integrar provedor apropriado ou mudar o fluxo antes do lançamento.

## 5. LGPD, retenção e operação

Respostas de saúde são dados pessoais sensíveis pela [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm). Definir finalidade, hipótese do art. 11, aviso de privacidade, perguntas mínimas, prazo de guarda, acesso/correção/exclusão e tratamento de menores antes de publicar o formulário. Não copiar respostas para observações gerais, analytics, logs ou URL. Proprietário revisa ficha por finalidade de atendimento; cliente vê somente a própria. A [Anvisa](https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/saloes-tatuagens-creches/tatuagem-e-piercing) indica que exigências sanitárias de tatuagem podem ser estaduais/municipais; validar localmente.

Backup JSON de saúde deve ser separado ou claramente identificado, guardado pelo proprietário em local protegido. Testar exportação e restauração em projeto isolado **antes da primeira anamnese real**. Fotos da fase 5 ficam em Firebase Storage privado, sem URL permanente; [Storage exige Blaze](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

## 6. Testes mínimos para lançamento

No Emulator Suite: proprietário lê e revisa; cliente A só acessa pedido/submissão próprios; cliente B, conta pendente, conta não Google, visitante e vínculo revogado são negados. Testar dupla submissão, template trocado, `clientId` forjado, texto alterado, timestamp falso, sessão antiga, pedido expirado e perda de conexão. Em E2E móvel, confirmar login, vínculo pendente, formulário, aceite e cópia. Validar que o artefato GitHub Pages e logs não contêm saúde ou credenciais.

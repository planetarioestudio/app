# Planetário Estúdio — requisitos do produto

## 1. Objetivo e decisões de escopo

Aplicativo **pessoal** para organizar o trabalho de um estúdio de tatuagem. O proprietário controla clientes, projetos, agenda, orçamentos, estoque e registros financeiros simples. **No lançamento, clientes também entram com Google para responder e aceitar eletronicamente a anamnese**, vinculada ao ID do cliente no app. O site estático será publicado pelo GitHub Pages; os dados ficam no Firebase. O sistema não será comercializado, não terá planos de assinatura do software, multiestúdio, cobrança online nem administração complexa de equipes.

O repositório contém **somente código e documentação**. Nenhum dado de cliente, foto, chave administrativa ou documento preenchido vai para Git/GitHub. O painel exige login, embora os arquivos estáticos do site possam ser vistos por qualquer pessoa. A segurança dos dados depende das regras do Firebase, não de esconder telas.

A referência SVG anexada fornece a organização do painel. A identidade usa o tema `planetario` do [projeto contas](https://github.com/MaximusGugu/contas/blob/main/style.css): fundo creme, laranja e verdes de apoio, DM Sans e nome textual **Planetário Estúdio**.

## 2. Usuário e fluxo diário

**Usuários iniciais:** proprietário/tatuador, com conta Google autorizada como administrador; clientes, com conta Google verificada e acesso limitado à própria anamnese. O sistema pode registrar o nome de outro profissional no futuro sem abrir acesso a ele. A separação entre área privada administrativa e entrada pública limitada segue a ideia do [lista-queeridas](https://github.com/MaximusGugu/lista-queeridas/blob/main/firestore.rules), com regras próprias para dados de saúde.

1. Cadastrar o cliente e a origem do contato.
2. Criar um projeto ligado ao cliente, com descrição, estilo, região, valor combinado e referências opcionais.
3. Registrar uma ou mais sessões na agenda e acompanhar confirmação, conclusão, cancelamento ou falta.
4. Calcular um preço sugerido, criar orçamento simples e gerar PDF local para envio manual por WhatsApp.
5. Enviar ao cliente a entrada Google do app. O primeiro acesso gera pedido pendente; o proprietário confere a conta e vincula o UID ao ID do cliente.
6. Criar a solicitação para esse cliente e enviar o link específico. Ele responde às perguntas, vê o texto vigente e aciona **“Concordo e assino”**; respostas, aceite e evidências são gravados como versão imutável. O proprietário revisa a ficha antes da sessão.
7. Marcar manualmente a resposta ao orçamento e o sinal recebido; o sinal abate o saldo do projeto.
8. Concluir a sessão, registrar o lote e a quantidade de materiais consumidos, pagamento, despesa e notas de acompanhamento.
9. Consultar painel, histórico e relatórios simples; exportar dados quando necessário.

As informações do cliente são reaproveitadas em projetos, agenda, anamnese e financeiro. O sistema não envia mensagens nem aceita decisão pública de orçamento nesta primeira versão. Login Google é evidência de controle de uma conta, **não prova automática de identidade civil nem garantia de validade jurídica da assinatura**; texto e procedimento precisam de validação antes do uso real.

## 3. Entregas por fase

| Fase | Entrega | Critério de aceitação |
|---|---|---|
| 1. Base | Vite/React/TypeScript, GitHub Pages, Firebase Auth Google, regras separadas para proprietário e cliente, layout | Site abre na URL Pages; cliente não lê dados administrativos ou de outro cliente |
| 2. Operação | Clientes, projetos, agenda e painel operacional | Fluxo cliente→projeto→sessão funciona no celular e desktop; histórico não duplica cadastro |
| 3. Anamnese | Cadastro de vínculo Google↔cliente, formulário móvel, consentimentos separados, aceite autenticado, histórico e revisão | Cada ficha é ligada ao `clientId` correto; somente cliente vinculado envia a própria ficha; versão enviada é imutável |
| 4. Comercial, caixa, estoque e lançamento | Precificação, orçamento/PDF, sinal, pagamentos, despesas, produtos, lotes/validade, entradas, consumo e alertas | Caixa concilia; consumo baixa o lote uma vez e compõe custo da sessão; anamnese está pronta e validada |
| 5. Arquivos | Firebase Storage privado para fotos e referências | Arquivos protegidos e recuperáveis; uso de Storage requer Blaze |
| 6. Opcional | Kits, lista de compras, equipe, relatórios avançados, automações e integrações | Cada recurso é reavaliado antes de entrar no produto |

O **primeiro lançamento é o fim da fase 4**, reunindo clientes, projetos, agenda, anamnese autenticada, orçamentos, caixa simples e estoque com rastreio de lote quando aplicável. Fotos entram na fase 5, que exige Blaze. A fase 6 **não é compromisso de implementação**.

## 4. Capacidades da versão pessoal

| Módulo | Nesta versão | Adiado |
|---|---|---|
| Painel | Próximas sessões, projetos abertos, orçamentos pendentes, recebido, despesas, saldo e alertas de estoque/validade | Lucro contábil, comparativos complexos e previsão avançada |
| Agenda | Visão mês/semana/lista, duração, estados, reagendamento e aviso de conflito | Sincronização Google Calendar, múltiplas agendas simultâneas |
| Clientes | Contato, aniversário, origem, observações e histórico | CRM com campanhas e automações |
| Projetos | Ideia, estilo, região, sessões, preço, referências e status | Fluxo artístico rígido com múltiplas aprovações |
| Orçamentos | Simulação simples, valores, validade, PDF e status alterado pelo proprietário | Link público, aprovação digital, assinatura |
| Financeiro | Sinal, pagamentos, despesas, métodos, saldos e CSV | Parcelamento automatizado, conciliação bancária, impostos e comissões |
| Arquivos | Referências e fotos privadas quando Storage estiver ativo | Portal público de envio pelo cliente |
| Estoque | Produto, categoria, unidade, custo, fornecedor registrado, lote e validade quando aplicáveis, entradas, consumo por sessão, perdas/ajustes e alertas de mínimo/vencimento | Kits, pedidos de compra e gestão avançada de fornecedores |
| Pós-atendimento | Anotações e lembrete manual no projeto | Mensagens automáticas e portal do cliente |
| Anamnese | Perguntas e termo versionados; login Google; vínculo manual por UID; respostas e aceite autenticado; revisão privada; consentimento de imagem separado e opcional | Assinatura qualificada, portal amplo do cliente e automação de envio |
| Equipe/relatórios | Relatórios simples de uso pessoal | Papéis, repasses e análises avançadas |

## 5. Requisitos de interface e dados

Interface em português brasileiro, datas `DD/MM/AAAA`, BRL e fuso `America/Sao_Paulo`; guardar instantes UTC. Desktop-first no painel e celular funcional para as tarefas diárias. Modo claro/escuro, navegação por teclado, contraste, feedback de sucesso/erro e estados vazios. Tabelas com busca/filtro; usar paginação quando o volume justificar.

Dados financeiros são registro gerencial, não contabilidade fiscal. Respostas de saúde e fotos exigem acesso privado, finalidade e política de retenção. O proprietário precisa poder exportar seus registros para não depender exclusivamente do aplicativo.

## 6. Validações e adiamentos

- Confirmar a conta Google que será o UID proprietário e o procedimento manual de vincular uma conta Google de cliente ao cadastro correto.
- Confirmar política de sinal, cancelamento e falta antes de registrar descontos ou devoluções automáticas; inicialmente tudo é ajuste manual explícito.
- **Antes do primeiro lançamento**, validar conteúdo da anamnese, base legal, retenção, política para menores, forma de aceite e regras sanitárias da cidade/estado. A [Anvisa](https://www.gov.br/anvisa/pt-br/assuntos/servicosdesaude/saloes-tatuagens-creches/tatuagem-e-piercing) remete a fiscalização e regras locais.
- Links públicos de orçamento, automações de WhatsApp, assinatura qualificada, multiusuário e multiestúdio exigem nova decisão de arquitetura; não devem surgir como botões inativos no MVP.

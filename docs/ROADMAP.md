# Planetário Estúdio — roadmap e custos da versão pessoal

## 1. Entregas

| Fase | Marco | Dependências | Complexidade |
|---|---|---|---|
| 1. Base | Projeto Vite, Git/GitHub, deploy Pages, Google Auth para proprietário/cliente, regras por papel, shell e tema | Conta GitHub, projeto Firebase e UID proprietário | Média |
| 2. Operação | Clientes, projetos, agenda e painel com dados reais | 1 | Média |
| 3. Anamnese | Vínculo Google↔cliente, formulário móvel, aceite autenticado, revisão privada, cópia e restauração testada | 1–2; termo e regras locais validados | Alta |
| 4. Comercial, caixa, estoque e lançamento | Preço sugerido, orçamento/PDF, pagamentos, despesas, produtos, lotes/validade, consumo por sessão e alertas | 2–3 | Alta |
| 5. Arquivos | Storage privado, fotos/referências e recuperação de arquivos | 3–4; ativação Blaze | Média |
| 6. Opcional | Kits, lista de compras, equipe, relatórios avançados e integrações, **somente se necessários** | Validação de demanda e nova avaliação técnica | Alta |

O **primeiro lançamento é o fim da fase 4**: cadastro, projetos, agenda, anamnese Google do cliente, orçamentos, caixa simples **e estoque**. A fase 5 acrescenta fotos; a 6 não deve ser iniciada automaticamente. O lançamento depende de validação dos termos, política de saúde/menores, regras sanitárias locais, testes de isolamento e restauração; sem isso, usar somente dados fictícios.

## 2. Custo recorrente

| Item | Cenário inicial | Observação |
|---|---|---|
| GitHub Pages | Sem cobrança de hospedagem no uso pessoal elegível | Publica apenas o frontend; verificar regras e limites do [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). Repositório público no GitHub Free; repo privado depende do plano/condições da conta. |
| Firebase Auth + Firestore | Pode caber nas cotas sem cobrança do Spark | Clientes autenticados e anamneses aumentam leituras/escritas; consultar [preços atuais](https://firebase.google.com/pricing). |
| Firebase Storage, fase 5 | **Blaze obrigatório**, cobrança por consumo acima de faixas gratuitas aplicáveis | Exige conta de faturamento mesmo com baixo uso; [regra oficial](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024). Configurar alertas de orçamento. |
| Domínio personalizado | Opcional | Usar URL `github.io` no início. |
| Mensagens, assinatura e backend | Zero no MVP | Envio manual; recursos futuros podem criar custos. |

Estimativa em **24/11/2026**: anamnese textual no Firestore não exige Storage. Não há valor mensal fixo obrigatório para o primeiro lançamento sem fotos se o uso ficar dentro das cotas e o GitHub Pages for elegível; isso **não garante custo zero**. Ao ativar Storage, Blaze passa a ser obrigatório, embora possa haver consumo sem cobrança. A fatura real depende de região, operações, tráfego e volume. Não fixar preços em BRL sem saber câmbio e impostos.

## 3. Esforço e riscos

Ordem de grandeza para uma pessoa desenvolvendo em tempo integral, com testes: fase 1, 1–2 semanas; fase 2, 3–5; fase 3, 3–6; fase 4, 4–7; fase 5, 1–3. Primeiro lançamento (1–4): **11–20 semanas**; fases 1–5: **12–23 semanas**. É estimativa de planejamento, sujeita a revisão após os primeiros fluxos, validação jurídica e conteúdo visual.

| Risco | Efeito | Mitigação |
|---|---|---|
| Regras Firebase abertas ou fracas | Exposição de clientes | Deny all, UID único, testes no emulador antes do deploy |
| Confundir Pages com banco privado | Dados no GitHub | Proibir dados reais no repo e no bundle; Firestore/Storage apenas |
| Firestore cobrar por leitura excessiva | Custo inesperado | Consultas limitadas, paginação, monitoramento e alertas |
| Storage exigir Blaze | Necessidade de faturamento | Manter fotos para fase 5 e ativar apenas quando necessário |
| Agenda concorrente sem servidor | Sobreposição eventual | Um usuário no MVP; checagem visual e revisão antes de equipe |
| Perda de dados por erro/exclusão | Falta de histórico | Exportação regular, confirmação e teste de restauração |
| Conta Google errada vinculada ao cliente | Resposta de saúde atribuída à pessoa errada | Aprovação manual do UID pelo proprietário; revogação e testes de troca de conta |
| Confundir login Google com identidade civil/assinatura qualificada | Prova inadequada do aceite | Registro de evidências e revisão jurídica antes do lançamento |
| Exposição cruzada de anamneses | Dano grave de privacidade | Regras por UID+`clientId`, criação única e testes de ataque no emulador |
| Saldo ou lote incorreto | Compra/falta de material e custo errado | Movimentos idempotentes, transação produto+lote, testes de vencimento e perda |

## 4. Portões de aceitação

Cada fase passa por build, testes de regras e revisão no celular com dados fictícios. Nenhum deploy publica coleção aberta. O lançamento da fase 4 exige vínculo correto, formulário/termo versionados, consentimento de imagem separado, aceite com autenticação recente, isolamento entre clientes, cópia da ficha, revisão do proprietário, validação jurídica/local, restauração testada, conciliação de sinal/pagamentos **e estoque com lote, validade e alertas**. A fase 5 exige Blaze, regras Storage restritas, exportação/recuperação de arquivos e alerta de custo. A fase 6 exige nova especificação e decisão de escopo.

## 5. Decisões ainda necessárias

Nome do repositório e conta GitHub de destino; contas Google proprietária e dos primeiros clientes; procedimento de conferir vínculo com cliente; perguntas e texto do termo; base legal, retenção, menores e cidade/estado para regras sanitárias; política de sinal/cancelamento; necessidade real de fotos e tamanho esperado; periodicidade de backup. Essas escolhas não impedem construir a base local e testar com dados fictícios, mas as decisões sobre anamnese bloqueiam o lançamento com dados reais.

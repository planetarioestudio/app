# Planetário Estúdio — backlog da versão pessoal

**P0** bloqueia a fase/lançamento; **P1** completa o módulo; **P2** é opcional. `Dep.` indica IDs anteriores. Toda tarefa termina com comportamento verificável, regras Firebase testadas quando aplicável e documentação alinhada. A [matriz de acesso](SECURITY_AND_PRIVACY.md) e o [modelo de dados](DATABASE_SCHEMA.md) são contratos para a implementação.

## Fase 1 — Base GitHub Pages + Google/Firebase

| ID | Pri. | Dep. | Tarefa | Conclusão |
|---|---|---|---|---|
| 1.01 | P0 | — | Inicializar Git e Vite/React/TypeScript | App local abre; typecheck, lint e build passam |
| 1.02 | P0 | 1.01 | Criar repo GitHub e workflow Pages | Push publica `dist`; rota com `#` recarrega |
| 1.03 | P0 | 1.01 | Configurar Firebase Auth Google e Firestore de desenvolvimento; adaptar fluxo do botão Google do app de referência | Proprietário e cliente de teste entram em desktop/celular; OAuth é do Planetário |
| 1.04 | P0 | 1.03 | Escrever regras deny all com papéis admin/cliente pendente/vinculado | Emulador nega visitante e leitura cruzada; cliente não acessa administração |
| 1.05 | P1 | 1.01 | Criar shell, tema `planetario`, login e telas de acesso pendente | Desktop/mobile e claro/escuro acessíveis |
| 1.06 | P0 | 1.02–1.05 | Separar Firebase de produção e pipeline de regras | Build sem segredos/dados; regras testadas antes de publicar |

## Fase 2 — Operação

| ID | Pri. | Dep. | Tarefa | Conclusão |
|---|---|---|---|---|
| 2.01 | P0 | 1.04–1.06 | Criar cadastro e busca de clientes | Cliente reutilizado; apenas proprietário lê/escreve |
| 2.02 | P0 | 2.01 | Criar projetos, status e notas | Projeto vinculado ao cliente; mudanças registradas |
| 2.03 | P0 | 2.02 | Criar sessões e checagem de conflito | Agenda avisa sobre sobreposição e impede salvar no fluxo normal |
| 2.04 | P1 | 2.03 | Criar calendário e reagendamento | Dia/semana/mês, lista móvel e histórico do horário funcionam |
| 2.05 | P1 | 2.01–2.04 | Criar painel operacional | Próximas sessões/pendências batem com registros |

## Fase 3 — Anamnese

| ID | Pri. | Dep. | Tarefa | Conclusão |
|---|---|---|---|---|
| 3.01 | P0 | 2.01 | Validar perguntas, termo, imagem, menores, retenção e regras locais | Conteúdo e base legal documentados e revisados antes de dados reais |
| 3.02 | P0 | 1.04, 2.01 | Criar pedido pendente e vínculo manual `googleUid → clientId` | Só proprietário aprova/revoga; email digitado não vincula |
| 3.03 | P0 | 3.01–3.02, 2.02 | Criar modelos versionados e solicitações por projeto | Link sem dados pessoais; pedido atribuído ao UID correto, expira/revoga |
| 3.04 | P0 | 3.03 | Criar formulário móvel e validação de respostas | Cliente vinculado responde; conta errada/pendente vê estado seguro |
| 3.05 | P0 | 3.04 | Criar aceite explícito com nova autenticação Google e submissão imutável | UID/email/termo/versão/respostas/horário do servidor preservados; dupla submissão negada |
| 3.06 | P0 | 3.05 | Criar revisão privada e cópia imprimível para cliente/estúdio | Proprietário revisa sem editar resposta; cliente lê só a própria |
| 3.07 | P0 | 3.06 | Criar exportação protegida e ensaiar restauração | Ficha e vínculo restaurados em projeto isolado antes do lançamento |
| 3.08 | P0 | 3.02–3.07 | Testar regras e E2E com dois clientes e múltiplas contas | Sem leitura cruzada; expiração, revogação, timestamp falso e rede falha são tratados |

## Fase 4 — Comercial, caixa, estoque e primeiro lançamento

| ID | Pri. | Dep. | Tarefa | Conclusão |
|---|---|---|---|---|
| 4.01 | P0 | 2.02 | Criar simulação de preço e testes de centavos | Custo, margem e sugestão fecham com casos documentados |
| 4.02 | P0 | 4.01 | Criar versões de orçamento e PDF no navegador | PDF baixa; versão enviada permanece intacta |
| 4.03 | P1 | 4.02 | Registrar resposta ao orçamento e envio manual | Status/data mudam apenas por ação do proprietário |
| 4.04 | P0 | 2.02, 4.02 | Registrar sinal, outros pagamentos e devoluções | Total pago/saldo fecham; sinal não duplica preço |
| 4.05 | P0 | 4.04 | Registrar despesas e painel de caixa simples | Caixa usa eventos efetivos do período |
| 4.06 | P1 | 4.05 | Exportar CSV financeiro e ampliar backup JSON | Arquivos baixam com dados consistentes e aviso de privacidade |
| 4.07 | P0 | 2.03 | Cadastrar produtos, unidades, estoque mínimo e lotes com validade quando aplicável | Produto e lote padrão ou identificado são criados; saldo inicial vem de uma entrada registrada |
| 4.08 | P0 | 4.07 | Registrar entradas, perdas e ajustes em transação com motivo e ID de operação | Movimento, saldo do lote e saldo do produto fecham; clique duplo e saldo negativo são negados |
| 4.09 | P0 | 4.08, 2.03 | Registrar consumo de produto e lote por sessão | Baixa única, vínculo com sessão e custo unitário preservado; lote vencido é bloqueado |
| 4.10 | P1 | 4.08 | Exibir alertas de estoque mínimo e validade | Lista e painel mostram produto baixo e lote perto de vencer; regra de prazo é configurável |
| 4.11 | P0 | 4.09–4.10, 4.05 | Testar concorrência, idempotência e conciliação de estoque e caixa | Emulador cobre baixa simultânea, perda, vencimento e repetição; compra afeta caixa uma vez e consumo afeta custo da sessão uma vez |

## Fase 5 — Arquivos

| ID | Pri. | Dep. | Tarefa | Conclusão |
|---|---|---|---|---|
| 5.01 | P0 | 1.04, 3.07 | Ativar Blaze, alertas de gasto e Storage privado | Regras negam visitante/cliente/outro UID; custos acompanhados |
| 5.02 | P0 | 5.01 | Adicionar fotos/referências com metadados e exportação | Arquivos associados ao projeto e recuperáveis; sem URL pública permanente |

## Fase 6 — Somente após nova decisão

| ID | Pri. | Dep. | Tarefa | Conclusão |
|---|---|---|---|---|
| 6.01 | P2 | 1–5 | Reavaliar demanda por kits, lista de compras, equipe, assinatura mais forte e integrações | Requisitos, risco, custo e possível backend documentados |
| 6.02 | P2 | 6.01 | Implementar somente funcionalidades aprovadas | Critérios e tarefas próprios definidos antes de desenvolver |

## Verificações de cada fase

Executar teste de regras Firestore/Storage no emulador quando o serviço estiver em uso, acesso autenticado/negado, falha de rede, teclado, celular, datas/BRL e build do Pages. Na fase 3, testar também troca de conta Google, vínculo incorreto, múltiplas submissões, revisão e recuperação. Na fase 4, testar saldo de produto e lote, consumo por sessão, vencimento, operações repetidas e indicadores sem custo duplicado. Não colocar dados reais em fixtures, Git, logs ou artefato `dist`.

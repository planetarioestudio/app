# Planetário Estúdio — regras de negócio simplificadas

## 1. Estados

| Registro | Estados iniciais | Regra |
|---|---|---|
| Projeto | ideia, orçamento, agendado, em andamento, concluído, cancelado | só proprietário altera; conclusão pede sessão encerrada ou motivo |
| Sessão | aguardando, confirmada, em atendimento, concluída, cancelada, não compareceu | sessão cancelada/falta não ocupa horário futuro; alteração guarda histórico |
| Orçamento | rascunho, enviado, aprovado, recusado, expirado, cancelado | status de aprovação é registrado **manualmente** pelo proprietário após contato com cliente |
| Solicitação de anamnese | criada, enviada, revogada | respondida/revisada são estados derivados da submissão/revisão; expiração deriva do prazo; correção pede nova solicitação |

Enviar orçamento congela sua versão; mudança de preço cria nova versão. O projeto continua o mesmo. Não há aprovação automática nem documento assinado pelo cliente no MVP.

## 2. Agenda

Início/fim são instantes UTC; interface exibe `America/Sao_Paulo`. Intervalos `[início, fim)` permitem atendimentos contíguos. Ao salvar, consultar sessões ativas sobrepostas e apresentar aviso claro; bloquear no fluxo normal, com opção de correção pelo proprietário. Como esta versão tem um único administrador e não há backend, essa verificação **não é garantia forte contra duas gravações concorrentes**. Gestão simultânea por equipe requer outro mecanismo antes da fase 6 opcional.

Reagendar altera horário da mesma sessão e acrescenta data anterior, nova data e motivo ao histórico. Cancelar ou registrar falta não apaga o projeto nem pagamentos. Duração realizada pode diferir da prevista.

## 3. Precificação e orçamento

Simulação simples: `custo_estimado = horas_est × custo_hora + materiais_estimados + outros_custos`; `preço_sugerido = custo_estimado / (1 - margem_alvo)` para `0 ≤ margem_alvo < 1`. Mostrar entradas, custo, preço sugerido e diferença em relação ao preço manual. Taxas e comissões são campos opcionais de custo quando relevantes. Usar decimal nos cálculos e arredondar o valor final para centavos.

Orçamento inclui cliente/projeto, descrição, sessões estimadas, preço, desconto, sinal, validade e condições. `preço_final ≥ 0`, `0 ≤ sinal ≤ preço_final`. O PDF é gerado e baixado localmente; envio por WhatsApp é manual. Status enviado/aprovado/recusado é anotado pelo proprietário com data. Orçamento expirado pode ser renovado criando versão nova.

## 4. Recebimentos, despesas e painel

- `project.priceCents` é o valor combinado. `totalRecebido = soma dos signedAmountCents de pagamentos válidos do projeto`, incluindo devoluções negativas. `saldo = preço - totalRecebido`. Se o preço é R$ 1.000 e o sinal pago R$ 200, o saldo é R$ 800; o sinal não aumenta o preço nem cria segunda receita.
- Registrar cada recebimento real uma vez, com data, valor positivo e método (Pix, dinheiro, débito ou crédito). Avisar quando exceder saldo; excesso exige ajuste explícito do preço ou devolução. Devolução é um novo movimento negativo vinculado ao recebimento original, limitado ao valor ainda não devolvido. Lançamento sem movimentação real pode ser anulado com motivo, mantendo histórico.
- Despesa representa saída efetivamente paga, com categoria, data e vínculo opcional ao projeto. Não criar obrigação futura ou parcela automática na versão simples.
- `caixa do período = soma dos signedAmountCents dos movimentos válidos ocorridos no período - despesas pagas no período`. Assim, uma devolução aparece no mês em que ocorreu sem apagar o recebimento do mês anterior. `ticket médio = soma de realizedValueCents das sessões concluídas ÷ quantidade de sessões concluídas`; sinal recebido em outro mês não se transforma em serviço realizado. Valor realizado independe da data de recebimento.
- `resultado simples = valor de serviços realizados - despesas atribuídas ao período`. Rotular como estimativa gerencial, nunca como lucro líquido contábil. Quando estoque for usado, compra de material entra no caixa; consumo por sessão entra no custo do projeto e não deve ser subtraído novamente do caixa.
- Painel usa datas locais do estúdio, período claramente indicado e “sem dados” para divisor zero. Não mostrar número inventado. CSV é exportação da lista filtrada, com valores e datas formatados.

## 5. Estoque no lançamento e arquivos na fase 5

Arquivos só entram na fase 5, privados no Firebase Storage. Uma foto ou arte pertence a um projeto ou sessão, com tipo e metadados; remover arquivo exige confirmação e atualização do metadado. Foto compartilhada com cliente é baixada e enviada manualmente; nenhum link permanente é publicado.

Produto tem saldo em unidade definida e um ou mais lotes. Entrada informa quantidade, custo unitário, fornecedor e, quando aplicável, número do lote e validade. Consumo por sessão escolhe o lote, diminui saldo do lote e do produto e guarda custo unitário daquele movimento. Lote vencido não pode ser consumido; saldo negativo é proibido. Perda e ajuste exigem motivo; correção cria movimento reverso e novo movimento. Atualizar os dois saldos e o movimento em transação idempotente.

Alertar quando saldo total ≤ mínimo e quando lote com saldo vence nos próximos 30 dias (prazo configurável), sem compra automática. Compra de material é saída de caixa; o consumo é custo do projeto. Não subtrair a mesma compra duas vezes do resultado.

## 6. Anamnese autenticada no lançamento

- Primeiro acesso Google de cliente cria apenas um pedido de vínculo. Proprietário confere a conta com a pessoa e associa **UID Google → `clientId`**. Email pode ajudar a conferir, mas igualdade de email digitado ou posse do link não cria vínculo automático. Revogar o vínculo corta acesso posterior.
- Proprietário cria solicitação para cliente, projeto e versão publicada do formulário. Link contém `requestId` sem dado pessoal; cliente só abre após login Google verificado e vínculo ativo. Pedido expirado, revogado, de outro UID ou já respondido não aceita envio.
- Perguntas obrigatórias são validadas antes do botão final. O cliente revisa respostas e termo; o consentimento de **uso de imagem é separado e opcional**. A ação “Concordo e assino” exige nova autenticação Google ou sessão recentemente autenticada. Salvar respostas, texto/versão do termo, UID, email verificado, método Google e horário do servidor numa submissão imutável.
- Login Google e clique constituem **aceite eletrônico autenticado registrado**. Eles não comprovam, por si, identidade civil ou modalidade de assinatura qualificada. A forma de documentação e sua adequação jurídica/sanitária devem ser validadas antes do uso real.
- Proprietário revisa a anamnese antes da sessão e marca resultado em registro separado. O app não diagnostica nem decide automaticamente aptidão. Se o cliente informar condição que exige esclarecimento, a sessão fica pendente de avaliação humana. Correção de resposta preserva versão anterior e exige nova solicitação.

## 7. Ausência de regras automáticas perigosas

Sinal, cancelamento, falta, devolução e autorização de imagem exigem política validada antes de automação. O sistema pessoal registra decisão e motivo manualmente. Dados de saúde ficam somente na anamnese protegida; não os copiar para observações gerais do cliente ou projeto.

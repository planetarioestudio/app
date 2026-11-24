# Planetário Estúdio — telas e experiência

## 1. Navegação compacta

Menu lateral recolhível da área privada: **Visão geral, Agenda, Clientes, Projetos, Anamneses, Orçamentos, Financeiro, Estoque**. **Configurações** fica no rodapé. Equipe e relatórios avançados não aparecem no MVP. Precificação é parte do orçamento, e notas de pós-atendimento ficam dentro do projeto. A área do cliente tem navegação própria e mínima, sem menu administrativo.

GitHub Pages servirá uma SPA estática. Usar rotas com `#` para a navegação interna, evitando 404 ao atualizar a página: `/#/agenda`, `/#/clientes/ID`. O login pode preservar a rota desejada e retornar a ela após autenticação. A URL não deve conter nome, telefone ou informação de saúde.

## 2. Rotas e componentes

| Rota | Conteúdo | Fase |
|---|---|---|
| `/#/login` | Login Google e estado de acesso (proprietário, cliente vinculado, pendente) | 1 |
| `/#/` | Próximas sessões, projetos abertos, orçamentos pendentes e caixa simples | 2–3 |
| `/#/agenda` | Calendário mês/semana, lista diária móvel, criação e edição de sessão | 2 |
| `/#/clientes` | Busca, lista, novo cliente | 2 |
| `/#/clientes/:id` | Contato, projetos e histórico | 2 |
| `/#/projetos` | Lista com filtro de estado e ação “Novo projeto” | 2 |
| `/#/projetos/:id` | Resumo, sessões, anamnese, orçamento, pagamentos, notas e arquivos na fase 5 | 2–5 |
| `/#/anamneses` | Fila privada: pendentes, respondidas, revisadas e ações de vínculo | 3 |
| `/#/clientes/:id/anamneses` | Histórico, nova solicitação, revisão e cópia imprimível | 3 |
| `/#/anamnese/:requestId` | Entrada do cliente: login Google, perguntas, termos, aceite e recibo | 3 |
| `/#/acesso-pendente` | Confirmação de solicitação de vínculo e instruções para contatar o estúdio | 1–3 |
| `/#/orcamentos` | Rascunhos, enviados, aprovados/recusados | 4 |
| `/#/orcamentos/:id` | Editor, simulação, versões e baixar PDF | 4 |
| `/#/financeiro` | Pagamentos, despesas, resumo e exportação CSV | 4 |
| `/#/estoque` | Produtos, lotes/validade, entradas, consumo por sessão e alertas | 4 |
| `/#/configuracoes` | Dados do estúdio, horários, tema e exportação/restauração | 1–5 |

A rota `/#/anamnese/:requestId` é **publicamente alcançável**, mas só revela conteúdo e aceita respostas após login Google e autorização nas regras Firestore. Não há rota pública de orçamento nem upload externo. O endereço pode ser enviado manualmente pelo proprietário.

## 3. Fluxos essenciais

1. Cliente → novo projeto → sessão: formulários curtos e contexto mantido; o perfil do cliente lista tudo.
2. Projeto → precificar → orçamento → baixar PDF: proposta usa os dados já cadastrados e mantém versões.
3. Proprietário envia a entrada `/#/login` → cliente entra com Google → proprietário aprova o vínculo ao cadastro → cria pedido e envia `/#/anamnese/:requestId` → cliente revisa perguntas/termos → “Concordo e assino” → recibo. No app privado, o proprietário vê a ficha no cadastro do cliente e revisa antes da sessão.
4. Projeto → registrar sinal → agendar/concluir sessão → registrar restante: valor pago e saldo ficam visíveis no mesmo lugar.
5. Agenda → abrir sessão → atualizar status/horário → voltar à agenda: histórico de mudanças permanece acessível.
6. Sessão concluída → registrar produtos e lotes consumidos → saldo e custo da sessão atualizam juntos; painel alerta estoque baixo ou lote próximo ao vencimento.
7. Fase 5: projeto → adicionar foto/referência privada.

## 4. Direção visual

Usar a hierarquia da imagem anexada: navegação lateral, cabeçalho enxuto, cartões de indicadores e área de próximos atendimentos. A cor vem do [tema `planetario` no CSS do projeto contas](https://github.com/MaximusGugu/contas/blob/main/style.css): creme `#FFF8E7`, superfície `#F8EED7`, laranja `#D78341`, verdes `#586E5F`/`#3C5558`, texto `#392B22`/`#191615`. Transformar em tokens semânticos e criar equivalentes escuros com contraste verificado. Fonte DM Sans; logotipo textual **Planetário Estúdio**. O ícone de cifrão do projeto contas não faz parte da marca.

O [fundo ilustrado](https://github.com/MaximusGugu/contas/blob/main/img/bg-site-planetario.webp) é opcional e discreto, fora de tabelas e formulários. Evitar aspecto genérico de dashboard e excesso de decoração.

## 5. Componentes e estados

Botões, campos, seletor de data, cards, tabela, status badge, modal de confirmação e notificações reutilizáveis. Acessibilidade: foco visível, teclado, rótulos, contraste, mensagens de erro junto ao campo e alternativa em lista para calendário/gráficos. Estados de carregamento, vazio, sucesso, falta de conexão e acesso negado. Em celular, priorizar agenda do dia, cliente e registro de pagamento. Formatar `DD/MM/AAAA`, `R$` e horários do estúdio.

### Formulário do cliente

Mobile-first, etapas curtas e progresso visível: identificação da conta vinculada (sem expor cadastro completo), perguntas de saúde aprovadas, revisão, termo do procedimento, autorização opcional de uso de imagem e confirmação final. Mostrar claramente a conta Google em uso e permitir trocá-la antes de responder. Nenhuma caixa pré-marcada. Depois do envio, exibir número/ID de protocolo, data/hora e acesso à própria cópia; respostas não são editáveis. Link vencido, conta pendente, conta errada, falta de conexão e envio já concluído têm mensagens específicas sem revelar dados de outra pessoa.

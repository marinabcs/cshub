import { collection, doc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../services/firebase'

// Helper para criar timestamps
const now = new Date()
const daysAgo = (days) => Timestamp.fromDate(new Date(now.getTime() - days * 24 * 60 * 60 * 1000))
const hoursAgo = (hours) => Timestamp.fromDate(new Date(now.getTime() - hours * 60 * 60 * 1000))

// Dados dos clientes
const clientes = [
  {
    team_id: "662fbb61e15cd764d1cfd501",
    team_name: "Serasa",
    team_type: "BR LCS",
    responsavel_email: "cesar@trakto.io",
    responsavel_nome: "César Oliveira",
    tags: ["Enterprise", "VIP"],
    health_score: 45,
    health_status: "risco",
    total_usuarios: 8,
    ultima_interacao: daysAgo(1),
    created_at: daysAgo(120),
    updated_at: daysAgo(1)
  },
  {
    team_id: "685aa168becb721a445d77bb",
    team_name: "Atacadão",
    team_type: "BR LCS",
    responsavel_email: "cesar@trakto.io",
    responsavel_nome: "César Oliveira",
    tags: ["Enterprise"],
    health_score: 82,
    health_status: "saudavel",
    total_usuarios: 5,
    ultima_interacao: daysAgo(3),
    created_at: daysAgo(90),
    updated_at: daysAgo(3)
  },
  {
    team_id: "69414b3540196eb2a70e5725",
    team_name: "UNISA",
    team_type: "BR MMS",
    responsavel_email: "natalia@trakto.io",
    responsavel_nome: "Natália Silva",
    tags: ["Educação"],
    health_score: 58,
    health_status: "atencao",
    total_usuarios: 3,
    ultima_interacao: daysAgo(5),
    created_at: daysAgo(60),
    updated_at: daysAgo(5)
  }
]

// Dados dos usuários por cliente
const usuarios = {
  "662fbb61e15cd764d1cfd501": [
    {
      user_id: "usr_serasa_001",
      email: "patricia@serasa.com.br",
      nome: "Patrícia Mendes",
      dominio: "serasa.com.br"
    },
    {
      user_id: "usr_serasa_002",
      email: "joao@serasa.com.br",
      nome: "João Carlos Santos",
      dominio: "serasa.com.br"
    }
  ],
  "685aa168becb721a445d77bb": [
    {
      user_id: "usr_atacadao_001",
      email: "marketing@atacadao.com.br",
      nome: "Fernanda Lima",
      dominio: "atacadao.com.br"
    },
    {
      user_id: "usr_atacadao_002",
      email: "design@atacadao.com.br",
      nome: "Ricardo Souza",
      dominio: "atacadao.com.br"
    }
  ],
  "69414b3540196eb2a70e5725": [
    {
      user_id: "usr_unisa_001",
      email: "comunicacao@unisa.edu.br",
      nome: "Mariana Costa",
      dominio: "unisa.edu.br"
    },
    {
      user_id: "usr_unisa_002",
      email: "reitoria@unisa.edu.br",
      nome: "Prof. Antonio Ferreira",
      dominio: "unisa.edu.br"
    }
  ]
}

// Dados das threads por cliente
const threads = {
  "662fbb61e15cd764d1cfd501": [
    {
      thread_id: "thread_serasa_001",
      assunto: "Erro ao exportar apresentação em PDF",
      categoria: "erro_bug",
      sentimento: "negativo",
      status: "aguardando_equipe",
      resumo_chat: "Cliente reportou erro 500 ao tentar exportar apresentações em PDF. O problema ocorre especificamente com arquivos que contêm mais de 20 slides. Equipe técnica está investigando.",
      ultima_msg_cliente: daysAgo(1),
      ultima_msg_equipe: daysAgo(2),
      dias_sem_resposta_cliente: 1,
      total_mensagens: 3,
      colaborador_responsavel: "cesar@trakto.io",
      created_at: daysAgo(5),
      updated_at: daysAgo(1)
    },
    {
      thread_id: "thread_serasa_002",
      assunto: "Solicitação de novos templates corporativos",
      categoria: "solicitacao",
      sentimento: "neutro",
      status: "ativo",
      resumo_chat: "Serasa solicita criação de templates personalizados com a identidade visual da empresa para uso interno. Pedido inclui 5 modelos diferentes para apresentações executivas.",
      ultima_msg_cliente: daysAgo(3),
      ultima_msg_equipe: daysAgo(2),
      dias_sem_resposta_cliente: 0,
      total_mensagens: 3,
      colaborador_responsavel: "cesar@trakto.io",
      created_at: daysAgo(10),
      updated_at: daysAgo(2)
    }
  ],
  "685aa168becb721a445d77bb": [
    {
      thread_id: "thread_atacadao_001",
      assunto: "Dúvida sobre integração com Canva",
      categoria: "duvida_pergunta",
      sentimento: "positivo",
      status: "resolvido",
      resumo_chat: "Cliente perguntou sobre possibilidade de importar designs do Canva para a Trakto. Explicamos o processo de exportação e importação de arquivos. Cliente ficou satisfeito com a solução.",
      ultima_msg_cliente: daysAgo(3),
      ultima_msg_equipe: daysAgo(3),
      dias_sem_resposta_cliente: 0,
      total_mensagens: 2,
      colaborador_responsavel: "cesar@trakto.io",
      created_at: daysAgo(7),
      updated_at: daysAgo(3)
    }
  ],
  "69414b3540196eb2a70e5725": [
    {
      thread_id: "thread_unisa_001",
      assunto: "Problemas de performance no editor",
      categoria: "problema_tecnico",
      sentimento: "negativo",
      status: "aguardando_equipe",
      resumo_chat: "Universidade reporta lentidão significativa no editor ao trabalhar com apresentações para aulas. Problema afeta múltiplos professores. Urgente resolver antes do início do semestre.",
      ultima_msg_cliente: daysAgo(5),
      ultima_msg_equipe: daysAgo(7),
      dias_sem_resposta_cliente: 5,
      total_mensagens: 2,
      colaborador_responsavel: "natalia@trakto.io",
      created_at: daysAgo(14),
      updated_at: daysAgo(5)
    }
  ]
}

// Mensagens das threads
const mensagens = {
  "thread_serasa_001": [
    {
      message_id: "msg_001",
      data: daysAgo(5),
      remetente_email: "patricia@serasa.com.br",
      remetente_nome: "Patrícia Mendes",
      tipo_remetente: "cliente",
      assunto: "Erro ao exportar apresentação em PDF",
      snippet: "Olá, estamos enfrentando um problema sério ao tentar exportar nossas apresentações em PDF. O sistema retorna um erro e não conseguimos baixar o arquivo. Isso está impactando nossa operação pois precisamos enviar relatórios urgentes."
    },
    {
      message_id: "msg_002",
      data: daysAgo(2),
      remetente_email: "cesar@trakto.io",
      remetente_nome: "César Oliveira",
      tipo_remetente: "equipe",
      assunto: "Re: Erro ao exportar apresentação em PDF",
      snippet: "Olá Patrícia! Obrigado por nos informar. Identificamos que o erro ocorre em apresentações com mais de 20 slides. Nossa equipe técnica já está trabalhando na correção. Enquanto isso, você pode exportar dividindo em partes menores?"
    },
    {
      message_id: "msg_003",
      data: daysAgo(1),
      remetente_email: "patricia@serasa.com.br",
      remetente_nome: "Patrícia Mendes",
      tipo_remetente: "cliente",
      assunto: "Re: Erro ao exportar apresentação em PDF",
      snippet: "César, a solução temporária ajudou, mas precisamos de uma correção definitiva o mais rápido possível. Temos uma apresentação importante para o board na próxima semana com 45 slides. Quando vocês preveem a correção?"
    }
  ],
  "thread_serasa_002": [
    {
      message_id: "msg_004",
      data: daysAgo(10),
      remetente_email: "joao@serasa.com.br",
      remetente_nome: "João Carlos Santos",
      tipo_remetente: "cliente",
      assunto: "Solicitação de novos templates corporativos",
      snippet: "Bom dia! Gostaríamos de solicitar a criação de templates personalizados com a identidade visual da Serasa. Precisamos de modelos para apresentações executivas, relatórios mensais e comunicados internos. É possível?"
    },
    {
      message_id: "msg_005",
      data: daysAgo(8),
      remetente_email: "cesar@trakto.io",
      remetente_nome: "César Oliveira",
      tipo_remetente: "equipe",
      assunto: "Re: Solicitação de novos templates corporativos",
      snippet: "Olá João! Claro, podemos criar templates personalizados para vocês. Para isso, precisamos do manual de identidade visual da Serasa e alguns exemplos de apresentações atuais. Você pode nos enviar esses materiais?"
    },
    {
      message_id: "msg_006",
      data: daysAgo(3),
      remetente_email: "joao@serasa.com.br",
      remetente_nome: "João Carlos Santos",
      tipo_remetente: "cliente",
      assunto: "Re: Solicitação de novos templates corporativos",
      snippet: "Segue em anexo o manual de marca e 3 exemplos de apresentações que usamos atualmente. Ficamos no aguardo do orçamento e prazo para entrega dos templates."
    }
  ],
  "thread_atacadao_001": [
    {
      message_id: "msg_007",
      data: daysAgo(7),
      remetente_email: "marketing@atacadao.com.br",
      remetente_nome: "Fernanda Lima",
      tipo_remetente: "cliente",
      assunto: "Dúvida sobre integração com Canva",
      snippet: "Oi! Nossa equipe tem alguns designs feitos no Canva que gostaríamos de usar na Trakto. Existe alguma forma de importar esses arquivos diretamente? Ou precisamos refazer tudo do zero?"
    },
    {
      message_id: "msg_008",
      data: daysAgo(3),
      remetente_email: "cesar@trakto.io",
      remetente_nome: "César Oliveira",
      tipo_remetente: "equipe",
      assunto: "Re: Dúvida sobre integração com Canva",
      snippet: "Olá Fernanda! Você pode exportar seus designs do Canva em formato PNG ou PDF e depois importá-los na Trakto como imagens de fundo. Se precisar editar elementos individuais, recomendo exportar em SVG quando possível. Qualquer dúvida, estou à disposição!"
    }
  ],
  "thread_unisa_001": [
    {
      message_id: "msg_009",
      data: daysAgo(14),
      remetente_email: "comunicacao@unisa.edu.br",
      remetente_nome: "Mariana Costa",
      tipo_remetente: "cliente",
      assunto: "Problemas de performance no editor",
      snippet: "Prezados, vários professores estão reclamando de lentidão extrema no editor da Trakto. O sistema demora mais de 30 segundos para carregar uma apresentação simples. Isso está inviabilizando o uso da ferramenta para preparação de aulas. Precisamos de uma solução urgente!"
    },
    {
      message_id: "msg_010",
      data: daysAgo(7),
      remetente_email: "natalia@trakto.io",
      remetente_nome: "Natália Silva",
      tipo_remetente: "equipe",
      assunto: "Re: Problemas de performance no editor",
      snippet: "Olá Mariana, lamentamos o inconveniente. Estamos investigando o problema de performance. Você poderia nos informar quais navegadores os professores estão usando e se o problema ocorre em todas as apresentações ou apenas em algumas específicas?"
    }
  ]
}

export async function seedDatabase() {
  const results = {
    clientes: 0,
    usuarios: 0,
    threads: 0,
    mensagens: 0,
    errors: []
  }

  try {
    // 1. Criar clientes
    for (const cliente of clientes) {
      try {
        const clienteRef = doc(db, 'clientes', cliente.team_id)
        await setDoc(clienteRef, cliente)
        results.clientes++
        console.log(`Cliente criado: ${cliente.team_name}`)
      } catch (err) {
        results.errors.push(`Erro ao criar cliente ${cliente.team_name}: ${err.message}`)
      }
    }

    // 2. Criar usuários
    for (const [teamId, userList] of Object.entries(usuarios)) {
      for (const usuario of userList) {
        try {
          const usuarioRef = doc(db, 'clientes', teamId, 'usuarios', usuario.user_id)
          await setDoc(usuarioRef, usuario)
          results.usuarios++
          console.log(`Usuário criado: ${usuario.nome}`)
        } catch (err) {
          results.errors.push(`Erro ao criar usuário ${usuario.nome}: ${err.message}`)
        }
      }
    }

    // 3. Criar threads (em times/{teamId}/threads)
    for (const [teamId, threadList] of Object.entries(threads)) {
      for (const thread of threadList) {
        try {
          const threadRef = doc(db, 'times', teamId, 'threads', thread.thread_id)
          await setDoc(threadRef, { ...thread, team_id: teamId })
          results.threads++
          console.log(`Thread criada: ${thread.assunto}`)
        } catch (err) {
          results.errors.push(`Erro ao criar thread ${thread.assunto}: ${err.message}`)
        }
      }
    }

    // 4. Criar mensagens (em times/{teamId}/threads/{threadId}/mensagens)
    for (const [threadId, msgList] of Object.entries(mensagens)) {
      // Encontrar o teamId da thread
      let teamId = null
      for (const [tId, tList] of Object.entries(threads)) {
        if (tList.some(t => t.thread_id === threadId)) {
          teamId = tId
          break
        }
      }

      if (teamId) {
        for (const msg of msgList) {
          try {
            const msgRef = doc(db, 'times', teamId, 'threads', threadId, 'mensagens', msg.message_id)
            await setDoc(msgRef, msg)
            results.mensagens++
            console.log(`Mensagem criada: ${msg.message_id}`)
          } catch (err) {
            results.errors.push(`Erro ao criar mensagem ${msg.message_id}: ${err.message}`)
          }
        }
      }
    }

    console.log('Seed concluído!', results)
    return results

  } catch (err) {
    console.error('Erro no seed:', err)
    results.errors.push(`Erro geral: ${err.message}`)
    return results
  }
}

// API Key - Carregada via vite.config.js do arquivo .env
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

// Categorias de thread
export const THREAD_CATEGORIAS = {
  erro_bug: {
    value: 'erro_bug',
    label: 'Erro/Bug',
    color: '#ef4444', // vermelho
    icon: 'Bug',
  },
  reclamacao: {
    value: 'reclamacao',
    label: 'Reclamação',
    color: '#dc2626', // vermelho escuro
    icon: 'AlertTriangle',
  },
  problema_tecnico: {
    value: 'problema_tecnico',
    label: 'Problema Técnico',
    color: '#f97316', // laranja
    icon: 'Wrench',
  },
  feedback: {
    value: 'feedback',
    label: 'Feedback',
    color: '#3b82f6', // azul
    icon: 'MessageSquare',
  },
  duvida_pergunta: {
    value: 'duvida_pergunta',
    label: 'Dúvida/Pergunta',
    color: '#8b5cf6', // roxo
    icon: 'HelpCircle',
  },
  solicitacao: {
    value: 'solicitacao',
    label: 'Solicitação',
    color: '#10b981', // verde
    icon: 'FileText',
  },
  outro: {
    value: 'outro',
    label: 'Outro',
    color: '#6b7280', // cinza
    icon: 'MoreHorizontal',
  },
};

// Sentimentos
export const THREAD_SENTIMENTOS = {
  positivo: {
    value: 'positivo',
    label: 'Positivo',
    color: '#10b981', // verde
    emoji: '😊',
  },
  neutro: {
    value: 'neutro',
    label: 'Neutro',
    color: '#6b7280', // cinza
    emoji: '😐',
  },
  negativo: {
    value: 'negativo',
    label: 'Negativo',
    color: '#ef4444', // vermelho
    emoji: '😞',
  },
  urgente: {
    value: 'urgente',
    label: 'Urgente',
    color: '#dc2626', // vermelho escuro
    emoji: '🚨',
    pulse: true,
  },
};

// Funções utilitárias
export function getCategoriaInfo(categoria) {
  return THREAD_CATEGORIAS[categoria] || THREAD_CATEGORIAS.outro;
}

export function getSentimentoInfo(sentimento) {
  return THREAD_SENTIMENTOS[sentimento] || THREAD_SENTIMENTOS.neutro;
}

// Classificar thread com IA
export async function classificarThread(conversa) {
  if (!OPENAI_API_KEY) {
    throw new Error('VITE_OPENAI_API_KEY não configurada. Adicione no arquivo .env');
  }

  const prompt = `Analise a seguinte conversa entre uma equipe de Customer Success e um cliente.

CONVERSA:
${conversa}

Retorne APENAS um JSON válido (sem markdown, sem explicações) com:
{
  "categoria": "erro_bug" | "reclamacao" | "problema_tecnico" | "feedback" | "duvida_pergunta" | "solicitacao" | "outro",
  "sentimento": "positivo" | "neutro" | "negativo" | "urgente",
  "resumo": "Resumo em 1-2 frases do que foi discutido"
}

Critérios para CATEGORIA (escolha a mais adequada):
- erro_bug = cliente reportou erro, bug ou falha no sistema
- reclamacao = cliente está reclamando ou insatisfeito com o serviço/produto
- problema_tecnico = dificuldade técnica ou de configuração (não é bug)
- feedback = sugestão, elogio ou crítica construtiva sobre o produto
- duvida_pergunta = pergunta sobre como usar uma funcionalidade
- solicitacao = pedido de feature, recurso ou ajuda específica
- outro = não se encaixa nas anteriores

Critérios para SENTIMENTO:
- positivo = cliente satisfeito, agradecendo ou elogiando
- neutro = conversa normal, sem emoção forte detectada
- negativo = cliente insatisfeito, frustrado ou reclamando
- urgente = problema crítico que impede o uso ou precisa atenção imediata`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um assistente que classifica conversas de suporte. Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Erro na API da OpenAI');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse do JSON (remove possíveis backticks)
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    const resultado = JSON.parse(jsonStr);

    // Validar campos
    if (!THREAD_CATEGORIAS[resultado.categoria]) {
      resultado.categoria = 'outro';
    }
    if (!THREAD_SENTIMENTOS[resultado.sentimento]) {
      resultado.sentimento = 'neutro';
    }
    if (!resultado.resumo || typeof resultado.resumo !== 'string') {
      resultado.resumo = 'Não foi possível gerar um resumo.';
    }

    return resultado;
  } catch (error) {
    console.error('Erro ao classificar thread:', error);
    throw error;
  }
}

// Verificar se a API está configurada
export function isOpenAIConfigured() {
  return !!OPENAI_API_KEY;
}

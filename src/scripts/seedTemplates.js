// Script para popular templates de comunicação no Firestore
// Templates de E-mail — Playbook de Ongoing — V2 (Fevereiro 2026)
// Revisado por: Gabriel Aguiar, Rafael Nascimento, Nathalia Montiel

import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export const TEMPLATES_ONGOING = [
  // ==================== RESGATE ====================
  {
    id: 'resgate_diagnostico_pt',
    titulo: '🔴 Resgate - E-mail de Diagnóstico (PT)',
    tipo: 'email',
    categoria: 'resgate',
    assunto: '[Nome do cliente], como podemos ajudar?',
    conteudo: `Oi [nome do contato],

Tudo bem? Sou [nome do CS] aqui da Trakto e cuido da conta de vocês.

Percebi que nas últimas semanas o uso da plataforma diminuiu bastante e queria entender se aconteceu algo específico: um bug que não foi resolvido? Uma dúvida que ficou pendente? Ou até uma mudança interna na equipe?

Seja qual for o cenário, estou aqui para ajudar.

Podemos marcar uma conversa rápida de 30 minutos essa semana? Quero garantir que vocês estejam extraindo o máximo da Trakto.

Seguem algumas sugestões de horário:
- [opção 1]
- [opção 2]
- [opção 3]

Se preferir, pode me responder por aqui mesmo com o que está acontecendo.

Abraço,
[nome do CS]`,
    tags: ['diagnóstico', 'português', 'D1-2']
  },
  {
    id: 'resgate_diagnostico_es',
    titulo: '🔴 Resgate - E-mail de Diagnóstico (ES)',
    tipo: 'email',
    categoria: 'resgate',
    assunto: '[Nombre del cliente], ¿cómo podemos ayudarles?',
    conteudo: `Hola [nombre del contacto],

¿Cómo estás? Soy [nombre del CS] de Trakto responsable de su cuenta.

Noté que en las últimas semanas el uso de la plataforma ha disminuido bastante, me encantaría entender si todo está bien de su lado. A veces puede ser un bug que no se resolvió, una duda pendiente, o incluso un cambio interno en el equipo — y en cualquier caso, estoy aquí para ayudar.

¿Podemos hacer una llamada rápida de 30 minutos esta semana? Me gustaría asegurarme de que estén aprovechando Trakto al máximo.

Algunas opciones de horario:
- [opción 1]
- [opción 2]
- [opción 3]

Si prefieren, pueden responderme por aquí con lo que está pasando.

Saludos,
[nombre del CS]`,
    tags: ['diagnóstico', 'español', 'D1-2']
  },
  {
    id: 'resgate_diagnostico_en',
    titulo: '🔴 Resgate - E-mail de Diagnóstico (EN)',
    tipo: 'email',
    categoria: 'resgate',
    assunto: '[Client name], how can we help?',
    conteudo: `Hi [contact name],

Hope you're doing well! I'm [CS name] from Trakto, and I take care of your account.

I noticed that platform usage has dropped significantly over the past few weeks, and I wanted to check in to understand if something specific happened: an unresolved bug? A pending question? Or maybe an internal team change?

Whatever the case, I'm here to help.

Could we schedule a quick 30-minute call this week? I want to make sure you're getting the most out of Trakto.

Here are a few time options:
- [option 1]
- [option 2]
- [option 3]

Feel free to reply here if you'd prefer to share what's going on via email.

Best,
[CS name]`,
    tags: ['diagnóstico', 'english', 'D1-2']
  },

  // ==================== ALERTA - Comunicação Rápida (D0-1) ====================
  {
    id: 'alerta_comunicacao_rapida_pt',
    titulo: '🟡 Alerta - Comunicação Rápida D0-1 (PT)',
    tipo: 'email',
    categoria: 'alerta',
    assunto: 'Oi [nome do contato], um breve update sobre sua conta',
    conteudo: `Oi [nome do contato],

Tudo bem? Sou [nome do CS] da Trakto.

Vi aqui que [surgiu um ponto / vocês reportaram um problema] e queria avisar que já estamos de olho. Se precisar de alguma coisa, pode me chamar direto por aqui.

Abraço,
[nome do CS]`,
    tags: ['comunicação rápida', 'D0-1', 'português']
  },
  {
    id: 'alerta_comunicacao_rapida_es',
    titulo: '🟡 Alerta - Comunicação Rápida D0-1 (ES)',
    tipo: 'email',
    categoria: 'alerta',
    assunto: 'Hola [nombre del contacto], un breve update sobre su cuenta',
    conteudo: `Hola [nombre del contacto],

¿Cómo estás? Soy [nombre del CS] de Trakto.

Vi que [surgió un tema / reportaron un problema] y quería avisarles que ya estamos al tanto. Si necesitan algo, pueden escribirme directamente.

Saludos,
[nombre del CS]`,
    tags: ['comunicação rápida', 'D0-1', 'español']
  },
  {
    id: 'alerta_comunicacao_rapida_en',
    titulo: '🟡 Alerta - Comunicação Rápida D0-1 (EN)',
    tipo: 'email',
    categoria: 'alerta',
    assunto: 'Hi [contact name], a quick update on your account',
    conteudo: `Hi [contact name],

Hope you're doing well! I'm [CS name] from Trakto.

I noticed [an issue came up / you reported a problem] and wanted to let you know we're already looking into it. If you need anything, feel free to reach out directly.

Best,
[CS name]`,
    tags: ['comunicação rápida', 'D0-1', 'english']
  },

  // ==================== ALERTA - Bug/Reclamação (D7-8) ====================
  {
    id: 'alerta_bug_reclamacao_pt',
    titulo: '🟡 Alerta A - Bug/Reclamação D7-8 (PT)',
    tipo: 'email',
    categoria: 'alerta',
    assunto: 'Atualização sobre [descrição breve do problema] — [nome do cliente]',
    conteudo: `Oi [nome do contato],

Queria te dar um retorno sobre [o problema/bug que reportaram]. Já estamos cuidando disso e [status atual: "a equipe técnica está analisando" / "temos previsão de correção para X"].

Sei que isso impacta o trabalho de vocês e quero garantir que estejam amparados enquanto resolvemos. Se precisarem de algum suporte extra nesse meio tempo, é só me chamar.

Assim que tivermos uma resolução, aviso por aqui.

Abraço,
[nome do CS]`,
    tags: ['bug', 'reclamação', 'D7-8', 'português']
  },
  {
    id: 'alerta_bug_reclamacao_es',
    titulo: '🟡 Alerta A - Bug/Reclamação D7-8 (ES)',
    tipo: 'email',
    categoria: 'alerta',
    assunto: 'Actualización sobre [descripción breve del problema] — [nombre del cliente]',
    conteudo: `Hola [nombre del contacto],

Quería darles una actualización sobre [el problema/bug que reportaron]. Ya estamos trabajando en ello y [estado actual: "el equipo técnico lo está analizando" / "estimamos una corrección para X"].

Sé que esto afecta su trabajo y quiero asegurarme de que tengan todo el soporte necesario mientras lo resolvemos. Si necesitan algo extra en este tiempo, no duden en contactarme.

En cuanto tengamos una resolución, les aviso por aquí.

Saludos,
[nombre del CS]`,
    tags: ['bug', 'reclamação', 'D7-8', 'español']
  },
  {
    id: 'alerta_bug_reclamacao_en',
    titulo: '🟡 Alerta A - Bug/Reclamação D7-8 (EN)',
    tipo: 'email',
    categoria: 'alerta',
    assunto: 'Update on [brief issue description] — [client name]',
    conteudo: `Hi [contact name],

I wanted to give you an update on [the issue/bug you reported]. We're already working on it and [current status: "our technical team is looking into it" / "we expect a fix by X"].

I know this impacts your workflow, and I want to make sure you're fully supported while we resolve it. If you need any extra help in the meantime, just let me know.

I'll follow up as soon as we have a resolution.

Best,
[CS name]`,
    tags: ['bug', 'reclamação', 'D7-8', 'english']
  },

  // ==================== ALERTA - Queda de Uso (D7-8) ====================
  {
    id: 'alerta_queda_uso_pt',
    titulo: '🟡 Alerta B - Queda de Uso D7-8 (PT)',
    tipo: 'email',
    categoria: 'alerta',
    assunto: 'Tudo certo por aí, [nome do contato]?',
    conteudo: `Oi [nome do contato],

Passando para saber como estão as coisas com a Trakto. Notei que o uso ficou um pouco mais baixo recentemente e queria entender se tem algo em que eu possa ajudar.

Pode ser que a equipe esteja num período mais tranquilo de campanhas, ou talvez tenha alguma dúvida sobre funcionalidades — de qualquer forma, estou aqui.

Podemos marcar uma conversa rápida de 20 minutos? Quero entender melhor o momento de vocês e ver se tem algo que a gente possa fazer para facilitar.

Abraço,
[nome do CS]`,
    tags: ['queda de uso', 'D7-8', 'português']
  },
  {
    id: 'alerta_queda_uso_es',
    titulo: '🟡 Alerta B - Queda de Uso D7-8 (ES)',
    tipo: 'email',
    categoria: 'alerta',
    assunto: '¿Todo bien por ahí, [nombre del contacto]?',
    conteudo: `Hola [nombre del contacto],

Paso por aquí para saber cómo van las cosas con el uso de Trakto. Noté que el uso bajó un poco últimamente y quería entender si hay algo en lo que pueda ayudar.

Me gustaría saber si están en un período más tranquilo de campañas, o tal vez haya alguna duda sobre funcionalidades — de cualquier forma, estoy aquí para ayudarlos en lo que necesiten.

Si quieren, podemos hacer una llamada rápida de 20 minutos para entender mejor el momento en el que se encuentran y ver qué podemos hacer para ayudarles.

Saludos,
[nombre del CS]`,
    tags: ['queda de uso', 'D7-8', 'español']
  },
  {
    id: 'alerta_queda_uso_en',
    titulo: '🟡 Alerta B - Queda de Uso D7-8 (EN)',
    tipo: 'email',
    categoria: 'alerta',
    assunto: 'Everything okay, [contact name]?',
    conteudo: `Hi [contact name],

Just checking in to see how things are going with Trakto. I noticed usage has been a bit lower recently and wanted to understand if there's anything I can help with.

It could be that your team is in a quieter campaign period, or maybe there's a question about features — either way, I'm here.

Could we schedule a quick 20-minute call? I'd love to better understand where things stand and see how we can help.

Best,
[CS name]`,
    tags: ['queda de uso', 'D7-8', 'english']
  },

  // ==================== ESTÁVEL - Gancho 1: Data/Novidade ====================
  {
    id: 'estavel_data_novidade_pt',
    titulo: '🟢 Estável - Gancho 1: Data/Novidade (PT)',
    tipo: 'email',
    categoria: 'estavel',
    assunto: '[Gancho personalizado] — [nome do cliente]',
    conteudo: `Oi [nome do contato],

Tudo bem? Aqui é [nome do CS] da Trakto.

[Conteúdo do gancho escolhido — 2 a 3 linhas máximo.

Exemplos:
- "Vi que a temporada de matrículas está chegando — vocês já começaram a preparar as campanhas na Trakto?"
- "Lançamos uma atualização no módulo de Analytics que vai facilitar muito o acompanhamento das campanhas de vocês."
- "Saiu uma novidade de IA essa semana que tem tudo a ver com o que vocês fazem na Trakto — achei que poderia te interessar."]

Se fizer sentido, fico à disposição para trocar uma ideia sobre como aproveitar isso na Trakto!

Abraço,
[nome do CS]`,
    tags: ['data do mercado', 'novidade', 'mensal', 'português']
  },
  {
    id: 'estavel_data_novidade_es',
    titulo: '🟢 Estável - Gancho 1: Data/Novidade (ES)',
    tipo: 'email',
    categoria: 'estavel',
    assunto: '[Gancho personalizado] — [nombre del cliente]',
    conteudo: `Hola [nombre del contacto],

¿Cómo estás? Soy [nombre del CS] de Trakto.

[Contenido del gancho elegido — 2 a 3 líneas máximo.]

Si tiene sentido, quedo a disposición para conversar sobre cómo aprovechar esto en Trakto.

Saludos,
[nombre del CS]`,
    tags: ['data do mercado', 'novidade', 'mensal', 'español']
  },
  {
    id: 'estavel_data_novidade_en',
    titulo: '🟢 Estável - Gancho 1: Data/Novidade (EN)',
    tipo: 'email',
    categoria: 'estavel',
    assunto: '[Personalized hook] — [client name]',
    conteudo: `Hi [contact name],

Hope you're doing well! I'm [CS name] from Trakto.

[Hook content — 2 to 3 lines max.]

If it makes sense, I'm happy to chat about how to make the most of this in Trakto!

Best,
[CS name]`,
    tags: ['data do mercado', 'novidade', 'mensal', 'english']
  },

  // ==================== ESTÁVEL - Gancho 2: Sazonalidade ====================
  {
    id: 'estavel_sazonalidade_pt',
    titulo: '🟢 Estável - Gancho 2: Sazonalidade (PT)',
    tipo: 'email',
    categoria: 'estavel',
    assunto: 'Planejamento de campanhas — [nome do cliente]',
    conteudo: `Oi [nome do contato],

Tudo bem? Aqui é [nome do CS] da Trakto.

Queria entender um pouco melhor o calendário de campanhas de vocês para os próximos meses. Assim consigo me antecipar e garantir que vocês tenham todo o suporte necessário nos momentos mais importantes.

Vocês já têm as datas principais mapeadas? Se fizer sentido, fico à disposição para conversar e mandar algumas sugestões de como a Trakto pode ajudar em cada uma.

Abraço,
[nome do CS]`,
    tags: ['sazonalidade', 'calendário', 'mensal', 'português']
  },
  {
    id: 'estavel_sazonalidade_es',
    titulo: '🟢 Estável - Gancho 2: Sazonalidade (ES)',
    tipo: 'email',
    categoria: 'estavel',
    assunto: 'Planificación de campañas — [nombre del cliente]',
    conteudo: `Hola [nombre del contacto],

¿Cómo estás? Soy [nombre del CS] de Trakto.

Me gustaría entender un poco mejor su calendario de campañas para los próximos meses. Así puedo anticiparme y asegurar que tengan todo el soporte necesario en los momentos más importantes.

¿Ya tienen las fechas principales definidas? Si quieren, puedo enviarles algunas sugerencias de cómo Trakto puede ayudar en cada una.

Saludos,
[nombre del CS]`,
    tags: ['sazonalidade', 'calendário', 'mensal', 'español']
  },
  {
    id: 'estavel_sazonalidade_en',
    titulo: '🟢 Estável - Gancho 2: Sazonalidade (EN)',
    tipo: 'email',
    categoria: 'estavel',
    assunto: 'Campaign planning — [client name]',
    conteudo: `Hi [contact name],

Hope you're doing well! I'm [CS name] from Trakto.

I'd love to better understand your campaign calendar for the upcoming months. That way I can anticipate your needs and make sure you have the right support at the most important moments.

Do you already have your key dates mapped out? If it makes sense, I'm happy to chat and share some suggestions on how Trakto can help with each one.

Best,
[CS name]`,
    tags: ['sazonalidade', 'calendário', 'mensal', 'english']
  },

  // ==================== CRESCIMENTO - Gancho 1: Reconhecimento + Case ====================
  {
    id: 'crescimento_reconhecimento_case_pt',
    titulo: '🚀 Crescimento - Gancho 1: Reconhecimento + Case (PT)',
    tipo: 'email',
    categoria: 'crescimento',
    assunto: 'Vocês estão arrasando na Trakto, [nome do contato]!',
    conteudo: `Oi [nome do contato],

Queria te dar um retorno que nem sempre a gente para pra dar: vocês estão usando a Trakto de uma forma muito bacana. [Dado específico — ex: "Só esse mês foram mais de 500 assets criados" / "O uso de créditos de IA aumentou 40%" / "Vocês estão entre os clientes mais ativos da plataforma"].

A gente adoraria contar a história de vocês como um case de sucesso. Seria algo simples — uma conversa rápida sobre como a Trakto tem ajudado no dia a dia da equipe. Topa?

Abraço,
[nome do CS]`,
    tags: ['reconhecimento', 'case', 'mensal', 'português']
  },
  {
    id: 'crescimento_reconhecimento_case_es',
    titulo: '🚀 Crescimento - Gancho 1: Reconhecimento + Case (ES)',
    tipo: 'email',
    categoria: 'crescimento',
    assunto: '¡En Trakto estamos felices de crecer con ustedes, [nombre del contacto]!',
    conteudo: `Hola [nombre del contacto],

Quería darles un feedback que no siempre nos detenemos a dar: están usando Trakto de una forma increíble. Noté que, [Dato específico — ej: "Solo este mes crearon más de 500 assets" / "El uso de créditos de IA aumentó un 40%"].

Nos encantaría contar su historia como un caso de éxito. Sería algo sencillo — ¿Podríamos tener una conversación rápida sobre cómo Trakto ha ayudado en el día a día del equipo?

Saludos,
[nombre del CS]`,
    tags: ['reconhecimento', 'case', 'mensal', 'español']
  },
  {
    id: 'crescimento_reconhecimento_case_en',
    titulo: '🚀 Crescimento - Gancho 1: Reconhecimento + Case (EN)',
    tipo: 'email',
    categoria: 'crescimento',
    assunto: "You're crushing it on Trakto, [contact name]!",
    conteudo: `Hi [contact name],

I wanted to share some feedback we don't always stop to give: you're using Trakto in a really impressive way. [Specific data — e.g., "This month alone you created over 500 assets" / "Your AI credit usage grew by 40%"].

We'd love to feature your story as a success case. It would be simple — a quick chat about how Trakto has been helping your team's day-to-day. Interested?

Best,
[CS name]`,
    tags: ['reconhecimento', 'case', 'mensal', 'english']
  },

  // ==================== CRESCIMENTO - Gancho 2: Case do Segmento ====================
  {
    id: 'crescimento_case_segmento_pt',
    titulo: '🚀 Crescimento - Gancho 2: Case do Segmento (PT)',
    tipo: 'email',
    categoria: 'crescimento',
    assunto: 'Como [empresa do mesmo segmento] está usando a Trakto',
    conteudo: `Oi [nome do contato],

Queria compartilhar algo que achei que poderia te interessar: [empresa ou descrição anônima — ex: "uma empresa do setor de educação"] está usando a Trakto para [descrição breve do que fizeram — ex: "escalar campanhas de matrícula com IA, reduzindo o tempo de produção pela metade"].

Achei que podia gerar umas ideias para vocês também. Vale a gente olhar isso juntos? Posso te mostrar como adaptar algo parecido para o contexto de vocês.

Abraço,
[nome do CS]`,
    tags: ['case', 'segmento', 'mensal', 'português']
  },
  {
    id: 'crescimento_case_segmento_es',
    titulo: '🚀 Crescimento - Gancho 2: Case do Segmento (ES)',
    tipo: 'email',
    categoria: 'crescimento',
    assunto: 'Cómo [empresa del mismo segmento] está usando Trakto',
    conteudo: `Hola [nombre del contacto],

Quería compartir algo que creo que puede interesarte: [empresa o descripción anónima] está usando Trakto para [descripción breve].

Pensé que podría generar algunas ideas para ustedes también. ¿Vale la pena mirarlo juntos? Puedo mostrarles cómo adaptar algo similar a su contexto.

Saludos,
[nombre del CS]`,
    tags: ['case', 'segmento', 'mensal', 'español']
  },
  {
    id: 'crescimento_case_segmento_en',
    titulo: '🚀 Crescimento - Gancho 2: Case do Segmento (EN)',
    tipo: 'email',
    categoria: 'crescimento',
    assunto: 'How [company in same segment] is using Trakto',
    conteudo: `Hi [contact name],

I wanted to share something I thought might interest you: [company or anonymous description] is using Trakto to [brief description].

I thought it could spark some ideas for your team as well. Worth looking at this together? I can show you how to adapt something similar for your context.

Best,
[CS name]`,
    tags: ['case', 'segmento', 'mensal', 'english']
  },

  // ==================== CRESCIMENTO - Gancho 3: Expansão Estratégica ====================
  {
    id: 'crescimento_expansao_pt',
    titulo: '🚀 Crescimento - Gancho 3: Expansão Estratégica (PT)',
    tipo: 'email',
    categoria: 'crescimento',
    assunto: 'Uma ideia para as próximas campanhas — [nome do cliente]',
    conteudo: `Oi [nome do contato],

Analisando o uso de vocês, percebi que [observação específica — ex: "vocês criam muito material estático, mas ainda não exploraram o módulo de motion" / "o consumo de créditos tá alto, o que é ótimo, mas vale a gente olhar juntos se o pacote atual ainda atende"].

[Conexão com o calendário do cliente — ex: "Com a Black Friday chegando, motion pode ser um diferencial grande para as campanhas de vocês." / "Vi que março é o pico de matrículas de vocês — vale a gente garantir que os créditos estejam dimensionados."]

Vale a gente olhar isso juntos? Posso te mostrar na prática como funcionaria.

Abraço,
[nome do CS]`,
    tags: ['expansão', 'upsell', 'mensal', 'português']
  },
  {
    id: 'crescimento_expansao_es',
    titulo: '🚀 Crescimento - Gancho 3: Expansão Estratégica (ES)',
    tipo: 'email',
    categoria: 'crescimento',
    assunto: 'Una idea para las próximas campañas — [nombre del cliente]',
    conteudo: `Hola [nombre del contacto],

Analizando el uso de ustedes, noté que [observación específica — ej: "crean mucho material estático pero aún no exploraron el módulo de motion" / "el consumo de créditos está alto, lo cual es genial, pero vale la pena revisar juntos si el paquete actual sigue siendo suficiente"].

[Conexión con el calendario del cliente — ej: "Con el Black Friday acercándose, motion puede ser un gran diferencial para sus campañas."]

¿Vale la pena mirarlo juntos? Puedo mostrarles en la práctica cómo funcionaría.

Saludos,
[nombre del CS]`,
    tags: ['expansão', 'upsell', 'mensal', 'español']
  },
  {
    id: 'crescimento_expansao_en',
    titulo: '🚀 Crescimento - Gancho 3: Expansão Estratégica (EN)',
    tipo: 'email',
    categoria: 'crescimento',
    assunto: 'An idea for your upcoming campaigns — [client name]',
    conteudo: `Hi [contact name],

Looking at your usage, I noticed that [specific observation — e.g., "you create a lot of static content but haven't explored the motion module yet" / "your credit consumption is high, which is great, but it's worth reviewing together if your current package still fits"].

[Connection to client's campaign calendar — e.g., "With Black Friday approaching, motion could be a major differentiator for your campaigns."]

Worth looking at this together? I can show you how it would work in practice.

Best,
[CS name]`,
    tags: ['expansão', 'upsell', 'mensal', 'english']
  }
];

// Função para popular os templates no Firestore
export async function seedTemplates() {
  const now = new Date();
  let count = 0;

  for (const template of TEMPLATES_ONGOING) {
    try {
      await setDoc(doc(db, 'templates_comunicacao', template.id), {
        titulo: template.titulo,
        tipo: template.tipo,
        categoria: template.categoria,
        assunto: template.assunto,
        conteudo: template.conteudo,
        tags: template.tags,
        created_at: now,
        created_by: 'sistema',
        updated_at: now,
        updated_by: 'sistema'
      });
      count++;
      console.log(`✅ Template criado: ${template.titulo}`);
    } catch (err) {
      console.error(`❌ Erro ao criar template ${template.id}:`, err);
    }
  }

  console.log(`\n🎉 ${count} templates criados com sucesso!`);
  return count;
}

export default seedTemplates;

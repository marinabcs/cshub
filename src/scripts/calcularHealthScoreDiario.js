#!/usr/bin/env node

/**
 * Script de Cálculo Diário do Health Score
 *
 * Executa o cálculo do Health Score para todos os clientes ativos.
 * Pode ser chamado manualmente ou agendado via n8n/cron (diário às 07:00).
 *
 * Uso:
 *   node calcularHealthScoreDiario.js                # Execução normal
 *   node calcularHealthScoreDiario.js --dry-run      # Simula sem salvar
 *   node calcularHealthScoreDiario.js --cliente=ID   # Apenas um cliente
 *   node calcularHealthScoreDiario.js --verbose      # Modo detalhado
 *
 * Variáveis de ambiente:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

import {
  calcularHealthScoreCompleto,
  salvarHealthScore,
  detectarMudancaStatus,
  PESOS,
  STATUS_THRESHOLDS,
} from '../services/healthScoreService.js';

import { registrarAcao, ACOES, ENTIDADES } from '../services/auditService.js';

// Cores para terminal
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Parseia argumentos da linha de comando
 */
function parseArgs(args) {
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h'),
    clienteId: null,
  };

  // Buscar --cliente=ID
  const clienteArg = args.find((a) => a.startsWith('--cliente='));
  if (clienteArg) {
    options.clienteId = clienteArg.split('=')[1];
  }

  return options;
}

/**
 * Exibe ajuda
 */
function mostrarAjuda() {
  console.log(`
${COLORS.bright}Health Score Diário - CS Hub${COLORS.reset}

${COLORS.cyan}Uso:${COLORS.reset}
  node calcularHealthScoreDiario.js [opções]

${COLORS.cyan}Opções:${COLORS.reset}
  -d, --dry-run       Simula execução sem salvar alterações
  -v, --verbose       Modo verboso com detalhes de cada cliente
  --cliente=ID        Processa apenas um cliente específico
  -h, --help          Mostra esta ajuda

${COLORS.cyan}Componentes do Health Score:${COLORS.reset}
  Engajamento:        ${PESOS.ENGAJAMENTO}% - Threads nos últimos 30 dias
  Sentimento:         ${PESOS.SENTIMENTO}% - Classificação das threads
  Tickets Abertos:    ${PESOS.TICKETS_ABERTOS}% - Threads não resolvidas
  Tempo sem Contato:  ${PESOS.TEMPO_SEM_CONTATO}% - Dias desde última interação
  Uso Plataforma:     ${PESOS.USO_PLATAFORMA}% - Métricas de uso (se disponível)

${COLORS.cyan}Status:${COLORS.reset}
  ${COLORS.green}Saudável${COLORS.reset}:  80-100 pontos
  ${COLORS.yellow}Atenção${COLORS.reset}:   60-79 pontos
  ${COLORS.magenta}Risco${COLORS.reset}:     40-59 pontos
  ${COLORS.red}Crítico${COLORS.reset}:   0-39 pontos

${COLORS.cyan}Agendamento recomendado:${COLORS.reset}
  Executar diariamente às 07:00
  Exemplo cron: 0 7 * * * (todo dia às 7h)
`);
}

/**
 * Logger com timestamp
 */
function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const logger = {
  info: (msg) => console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.blue}INFO${COLORS.reset}  ${msg}`),
  success: (msg) => console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.green}OK${COLORS.reset}    ${msg}`),
  warn: (msg) => console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}WARN${COLORS.reset}  ${msg}`),
  error: (msg) => console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.red}ERROR${COLORS.reset} ${msg}`),
  title: (msg) => console.log(`\n${COLORS.bright}${COLORS.cyan}=== ${msg} ===${COLORS.reset}\n`),
  detail: (msg) => console.log(`${COLORS.dim}         ${msg}${COLORS.reset}`),
};

/**
 * Formata status com cor
 */
function formatStatus(status) {
  const colors = {
    saudavel: COLORS.green,
    atencao: COLORS.yellow,
    risco: COLORS.magenta,
    critico: COLORS.red,
    erro: COLORS.red,
  };
  return `${colors[status] || COLORS.reset}${status}${COLORS.reset}`;
}

/**
 * Inicializa Firebase
 */
async function initFirebase() {
  try {
    const admin = await import('firebase-admin');

    if (admin.apps?.length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
      } else {
        admin.initializeApp();
      }
    }

    return {
      firestore: admin.firestore(),
      auth: admin.auth(),
    };
  } catch {
    return null;
  }
}

/**
 * Busca todos os clientes ativos
 */
async function buscarClientesAtivos(firestore, clienteEspecifico = null) {
  if (clienteEspecifico) {
    const clienteRef = doc(firestore, 'clientes', clienteEspecifico);
    const clienteSnap = await getDoc(clienteRef);

    if (!clienteSnap.exists()) {
      throw new Error(`Cliente não encontrado: ${clienteEspecifico}`);
    }

    return [{ id: clienteSnap.id, ...clienteSnap.data() }];
  }

  // Buscar todos os clientes ativos (não arquivados)
  const clientesQuery = query(
    collection(firestore, 'clientes'),
    where('archived', '!=', true)
  );

  try {
    const snapshot = await getDocs(clientesQuery);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    // Se a query falhar (campo archived não existe), buscar todos
    const allSnapshot = await getDocs(collection(firestore, 'clientes'));
    return allSnapshot.docs
      .filter((d) => !d.data().archived)
      .map((d) => ({ id: d.id, ...d.data() }));
  }
}

/**
 * Cria alerta para mudança de status
 */
async function criarAlertaStatusMudou(firestore, auth, cliente, statusAnterior, statusAtual, score) {
  const alertaConfig = detectarMudancaStatus(statusAnterior, statusAtual);

  if (!alertaConfig) return null;

  try {
    const alerta = {
      tipo: alertaConfig.tipo,
      severidade: alertaConfig.severidade,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome || cliente.name || cliente.email,
      titulo: `Health Score em ${statusAtual}`,
      descricao: alertaConfig.mensagem,
      score: score,
      status_anterior: statusAnterior,
      status_atual: statusAtual,
      resolvido: false,
      created_at: Timestamp.now(),
    };

    const docRef = await addDoc(collection(firestore, 'alertas'), alerta);

    // Registrar no audit log
    await registrarAcao(firestore, auth, {
      acao: ACOES.CRIACAO_ALERTA,
      entidadeTipo: ENTIDADES.ALERTA,
      entidadeId: docRef.id,
      dadosAnteriores: null,
      dadosNovos: alerta,
      metadata: { origem: 'health_score_diario', cliente_id: cliente.id },
    });

    return { id: docRef.id, ...alerta };
  } catch (error) {
    console.error('[HealthScore] Erro ao criar alerta:', error);
    return null;
  }
}

/**
 * Processa um único cliente
 */
async function processarCliente(firestore, auth, cliente, options) {
  const { dryRun, verbose } = options;
  const resultado = {
    clienteId: cliente.id,
    nome: cliente.nome || cliente.name || cliente.email || cliente.id,
    success: false,
    score: null,
    status: null,
    statusAnterior: null,
    alertaCriado: null,
    erro: null,
  };

  try {
    // Guardar status anterior
    resultado.statusAnterior = cliente.health_status || 'desconhecido';

    // Calcular novo score
    const healthScore = await calcularHealthScoreCompleto(firestore, cliente.id);

    if (healthScore.score === null) {
      resultado.erro = healthScore.erro || 'Erro no cálculo';
      return resultado;
    }

    resultado.score = healthScore.score;
    resultado.status = healthScore.status;
    resultado.componentes = healthScore.componentes;

    if (verbose) {
      logger.detail(`  Engajamento: ${healthScore.componentes.engajamento}`);
      logger.detail(`  Sentimento: ${healthScore.componentes.sentimento}`);
      logger.detail(`  Tickets Abertos: ${healthScore.componentes.tickets_abertos}`);
      logger.detail(`  Tempo sem Contato: ${healthScore.componentes.tempo_sem_contato}`);
      logger.detail(`  Uso Plataforma: ${healthScore.componentes.uso_plataforma ?? 'N/A'}`);
    }

    if (!dryRun) {
      // Salvar score
      await salvarHealthScore(firestore, cliente.id, healthScore);

      // Criar alerta se necessário
      if (resultado.statusAnterior !== 'desconhecido' && resultado.statusAnterior !== resultado.status) {
        const alerta = await criarAlertaStatusMudou(
          firestore,
          auth,
          cliente,
          resultado.statusAnterior,
          resultado.status,
          resultado.score
        );

        if (alerta) {
          resultado.alertaCriado = alerta;
        }
      }
    }

    resultado.success = true;
  } catch (error) {
    resultado.erro = error.message;
  }

  return resultado;
}

/**
 * Executa o job de cálculo diário
 */
export async function executarCalculoDiario(firestore, auth, options = {}) {
  const { dryRun = false, verbose = false, clienteId = null } = options;

  const relatorio = {
    iniciadoEm: new Date().toISOString(),
    dryRun,
    clientes: {
      total: 0,
      processados: 0,
      erros: 0,
    },
    alertas: {
      criados: 0,
      lista: [],
    },
    distribuicaoStatus: {
      saudavel: 0,
      atencao: 0,
      risco: 0,
      critico: 0,
      erro: 0,
    },
    resultados: [],
    finalizadoEm: null,
  };

  logger.title('CÁLCULO DIÁRIO DE HEALTH SCORE');

  if (dryRun) {
    logger.warn('Modo DRY RUN ativado - nenhuma alteração será salva');
  }

  try {
    // Buscar clientes
    logger.info('Buscando clientes ativos...');
    const clientes = await buscarClientesAtivos(firestore, clienteId);
    relatorio.clientes.total = clientes.length;

    logger.info(`Encontrados ${clientes.length} clientes para processar`);

    // Processar cada cliente
    for (let i = 0; i < clientes.length; i++) {
      const cliente = clientes[i];
      const nomeCliente = cliente.nome || cliente.name || cliente.email || cliente.id;

      if (verbose) {
        logger.info(`[${i + 1}/${clientes.length}] Processando: ${nomeCliente}`);
      }

      const resultado = await processarCliente(firestore, auth, cliente, options);
      relatorio.resultados.push(resultado);

      if (resultado.success) {
        relatorio.clientes.processados++;
        relatorio.distribuicaoStatus[resultado.status]++;

        if (resultado.alertaCriado) {
          relatorio.alertas.criados++;
          relatorio.alertas.lista.push({
            clienteId: cliente.id,
            nome: nomeCliente,
            tipo: resultado.alertaCriado.tipo,
            statusAnterior: resultado.statusAnterior,
            statusAtual: resultado.status,
          });
        }

        if (verbose || resultado.alertaCriado) {
          const msg = `  Score: ${resultado.score} | Status: ${formatStatus(resultado.status)}`;
          if (resultado.alertaCriado) {
            logger.warn(`${msg} | ALERTA: ${resultado.alertaCriado.tipo}`);
          } else if (verbose) {
            logger.success(msg);
          }
        }
      } else {
        relatorio.clientes.erros++;
        relatorio.distribuicaoStatus.erro++;
        logger.error(`  Erro: ${resultado.erro}`);
      }

      // Progress indicator a cada 10 clientes
      if (!verbose && (i + 1) % 10 === 0) {
        logger.info(`Progresso: ${i + 1}/${clientes.length} clientes processados`);
      }
    }

    relatorio.finalizadoEm = new Date().toISOString();

    // Exibir resumo
    logger.title('RESUMO');

    console.log(`${COLORS.cyan}Clientes:${COLORS.reset}`);
    console.log(`  Total: ${relatorio.clientes.total}`);
    console.log(`  Processados: ${COLORS.green}${relatorio.clientes.processados}${COLORS.reset}`);
    console.log(`  Erros: ${relatorio.clientes.erros > 0 ? COLORS.red : ''}${relatorio.clientes.erros}${COLORS.reset}`);

    console.log(`\n${COLORS.cyan}Distribuição de Status:${COLORS.reset}`);
    console.log(`  ${COLORS.green}Saudável${COLORS.reset}: ${relatorio.distribuicaoStatus.saudavel}`);
    console.log(`  ${COLORS.yellow}Atenção${COLORS.reset}:  ${relatorio.distribuicaoStatus.atencao}`);
    console.log(`  ${COLORS.magenta}Risco${COLORS.reset}:    ${relatorio.distribuicaoStatus.risco}`);
    console.log(`  ${COLORS.red}Crítico${COLORS.reset}:  ${relatorio.distribuicaoStatus.critico}`);

    console.log(`\n${COLORS.cyan}Alertas:${COLORS.reset}`);
    console.log(`  Criados: ${relatorio.alertas.criados > 0 ? COLORS.yellow : ''}${relatorio.alertas.criados}${COLORS.reset}`);

    if (relatorio.alertas.lista.length > 0) {
      console.log(`\n${COLORS.yellow}Detalhes dos alertas:${COLORS.reset}`);
      relatorio.alertas.lista.forEach((a) => {
        console.log(`  - ${a.nome}: ${a.statusAnterior} → ${a.statusAtual}`);
      });
    }

    console.log('');

    return relatorio;
  } catch (error) {
    logger.error(`Erro fatal: ${error.message}`);
    relatorio.erro = error.message;
    relatorio.finalizadoEm = new Date().toISOString();
    return relatorio;
  }
}

/**
 * Entry point CLI
 */
async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    mostrarAjuda();
    process.exit(0);
  }

  try {
    const firebase = await initFirebase();

    if (!firebase) {
      logger.error('Não foi possível inicializar o Firebase.');
      logger.info('Configure as variáveis de ambiente:');
      logger.info('  FIREBASE_PROJECT_ID');
      logger.info('  FIREBASE_CLIENT_EMAIL');
      logger.info('  FIREBASE_PRIVATE_KEY');
      process.exit(1);
    }

    const { firestore, auth } = firebase;

    const relatorio = await executarCalculoDiario(firestore, auth, options);

    const temErros = relatorio.clientes.erros > 0 || relatorio.erro;
    process.exit(temErros ? 1 : 0);
  } catch (error) {
    logger.error(`Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// Executar se chamado diretamente
const isMainModule = process.argv[1]?.includes('calcularHealthScoreDiario');
if (isMainModule) {
  main();
}

export default executarCalculoDiario;

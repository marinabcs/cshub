#!/usr/bin/env node

/**
 * Retention Job Script
 *
 * Script para executar política de retenção de dados do CS Hub.
 * Pode ser chamado manualmente ou agendado via n8n/cron (1x por semana recomendado).
 *
 * Uso:
 *   node retentionJob.js                    # Execução normal
 *   node retentionJob.js --dry-run          # Simulação (não executa)
 *   node retentionJob.js --report-only      # Apenas gera relatório
 *   node retentionJob.js --verbose          # Modo verboso
 *
 * Variáveis de ambiente necessárias:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *
 * Ou usar com Firebase Admin SDK já inicializado.
 */

import {
  executarRetencaoCompleta,
  gerarRelatorioRetencao,
  RETENTION_CONFIG,
} from '../services/retentionService.js';

// Configuração de cores para output no terminal
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Parseia argumentos da linha de comando
 * @param {string[]} args - process.argv
 * @returns {Object} - Opções parseadas
 */
function parseArgs(args) {
  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    reportOnly: args.includes('--report-only') || args.includes('-r'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

/**
 * Exibe ajuda do comando
 */
function mostrarAjuda() {
  console.log(`
${COLORS.bright}Retention Job - CS Hub${COLORS.reset}

${COLORS.cyan}Uso:${COLORS.reset}
  node retentionJob.js [opções]

${COLORS.cyan}Opções:${COLORS.reset}
  -d, --dry-run       Simula execução sem fazer alterações
  -r, --report-only   Apenas gera relatório de itens pendentes
  -v, --verbose       Modo verboso com mais detalhes
  -h, --help          Mostra esta ajuda

${COLORS.cyan}Configuração de Retenção:${COLORS.reset}
  Threads resolvidas:    ${RETENTION_CONFIG.THREADS_RESOLVIDAS_MESES} meses
  Threads inativas:      ${RETENTION_CONFIG.THREADS_INATIVAS_MESES} meses
  Alertas resolvidos:    ${RETENTION_CONFIG.ALERTAS_RESOLVIDOS_MESES} meses
  Health History:        ${RETENTION_CONFIG.HEALTH_HISTORY_MESES} meses
  Audit Logs:            Permanente (nunca deletar)

${COLORS.cyan}Exemplos:${COLORS.reset}
  node retentionJob.js --dry-run    # Ver o que seria processado
  node retentionJob.js              # Executar retenção

${COLORS.cyan}Agendamento recomendado:${COLORS.reset}
  Executar 1x por semana, preferencialmente em horário de baixo uso.
  Exemplo cron: 0 3 * * 0 (todo domingo às 3h)
`);
}

/**
 * Formata timestamp para log
 * @returns {string}
 */
function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Logger com timestamp e cores
 */
const logger = {
  info: (msg) => console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.blue}INFO${COLORS.reset}  ${msg}`),
  success: (msg) => console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.green}OK${COLORS.reset}    ${msg}`),
  warn: (msg) => console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}WARN${COLORS.reset}  ${msg}`),
  error: (msg) => console.log(`${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.red}ERROR${COLORS.reset} ${msg}`),
  title: (msg) => console.log(`\n${COLORS.bright}${COLORS.cyan}=== ${msg} ===${COLORS.reset}\n`),
};

/**
 * Inicializa Firebase (para uso standalone)
 * @returns {Promise<Object>} - { firestore, auth }
 */
async function initFirebase() {
  // Tentar importar firebase-admin para uso em ambiente de servidor
  try {
    const admin = await import('firebase-admin');

    // Verificar se já está inicializado
    if (admin.apps?.length === 0) {
      // Inicializar com credenciais de ambiente ou service account
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        // Tentar inicialização padrão (para ambientes Google Cloud)
        admin.initializeApp();
      }
    }

    return {
      firestore: admin.firestore(),
      auth: admin.auth(),
    };
  } catch {
    // Se não conseguir usar firebase-admin, retornar null
    // O script pode receber instâncias externamente
    return null;
  }
}

/**
 * Formata o relatório para exibição
 * @param {Object} relatorio - Relatório de retenção
 * @param {boolean} verbose - Se deve mostrar detalhes
 */
function formatarRelatorio(relatorio, verbose = false) {
  logger.title('RELATÓRIO DE RETENÇÃO');

  console.log(`${COLORS.cyan}Período:${COLORS.reset} ${relatorio.iniciadoEm || relatorio.geradoEm}`);
  if (relatorio.finalizadoEm) {
    console.log(`${COLORS.cyan}Finalizado:${COLORS.reset} ${relatorio.finalizadoEm}`);
  }
  if (relatorio.dryRun) {
    console.log(`${COLORS.yellow}MODO: DRY RUN (simulação)${COLORS.reset}`);
  }

  console.log('\n--- THREADS ---');

  if (relatorio.threads) {
    const { resolvidas, inativas } = relatorio.threads;

    console.log(`Resolvidas (>${RETENTION_CONFIG.THREADS_RESOLVIDAS_MESES} meses):`);
    console.log(`  Encontradas: ${resolvidas.encontradas ?? resolvidas.total ?? 0}`);
    if (resolvidas.arquivadas !== undefined) {
      console.log(`  Arquivadas: ${COLORS.green}${resolvidas.arquivadas}${COLORS.reset}`);
      if (resolvidas.erros > 0) {
        console.log(`  Erros: ${COLORS.red}${resolvidas.erros}${COLORS.reset}`);
      }
    }

    console.log(`\nInativas (>${RETENTION_CONFIG.THREADS_INATIVAS_MESES} meses sem atividade):`);
    console.log(`  Encontradas: ${inativas.encontradas ?? inativas.total ?? 0}`);
    if (inativas.arquivadas !== undefined) {
      console.log(`  Arquivadas: ${COLORS.green}${inativas.arquivadas}${COLORS.reset}`);
      if (inativas.erros > 0) {
        console.log(`  Erros: ${COLORS.red}${inativas.erros}${COLORS.reset}`);
      }
    }

    // Preview de itens em modo verbose ou report-only
    if (verbose && resolvidas.itens?.length > 0) {
      console.log('\n  Preview (primeiras 10):');
      resolvidas.itens.forEach((t) => {
        console.log(`    - ${t.id}: ${t.subject || t.assunto || 'Sem assunto'}`);
      });
    }
  }

  console.log('\n--- ALERTAS ---');

  if (relatorio.alertas) {
    const { alertas } = relatorio;
    console.log(`Resolvidos (>${RETENTION_CONFIG.ALERTAS_RESOLVIDOS_MESES} meses):`);
    console.log(`  Encontrados: ${alertas.encontrados ?? alertas.total ?? 0}`);
    if (alertas.deletados !== undefined) {
      console.log(`  Soft deleted: ${COLORS.green}${alertas.deletados}${COLORS.reset}`);
      if (alertas.erros > 0) {
        console.log(`  Erros: ${COLORS.red}${alertas.erros}${COLORS.reset}`);
      }
    }
  }

  // Erros detalhados
  if (relatorio.erros?.length > 0) {
    console.log(`\n${COLORS.red}--- ERROS (${relatorio.erros.length}) ---${COLORS.reset}`);
    relatorio.erros.forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.tipo}] ${e.id || 'N/A'}: ${e.erro}`);
    });
  }

  console.log('\n');
}

/**
 * Função principal de execução
 * @param {Object} firestore - Instância do Firestore
 * @param {Object} auth - Instância do Firebase Auth
 * @param {Object} options - Opções de execução
 */
export async function executarJob(firestore, auth, options = {}) {
  const { dryRun = false, reportOnly = false, verbose = false } = options;

  logger.title('RETENTION JOB - CS HUB');
  logger.info(`Iniciando job de retenção...`);

  if (dryRun) {
    logger.warn('Modo DRY RUN ativado - nenhuma alteração será feita');
  }

  if (reportOnly) {
    logger.info('Modo REPORT ONLY - apenas gerando relatório');
    const relatorio = await gerarRelatorioRetencao(firestore);
    formatarRelatorio(relatorio, verbose);
    return relatorio;
  }

  // Executar retenção completa
  const relatorio = await executarRetencaoCompleta(firestore, auth, {
    dryRun,
    onProgress: verbose ? (msg) => logger.info(msg) : null,
  });

  formatarRelatorio(relatorio, verbose);

  // Resumo final
  const totalProcessado =
    (relatorio.threads?.resolvidas?.arquivadas || 0) +
    (relatorio.threads?.inativas?.arquivadas || 0) +
    (relatorio.alertas?.deletados || 0);

  const totalErros =
    (relatorio.threads?.resolvidas?.erros || 0) +
    (relatorio.threads?.inativas?.erros || 0) +
    (relatorio.alertas?.erros || 0);

  if (totalErros > 0) {
    logger.warn(`Job finalizado com ${totalErros} erros. ${totalProcessado} itens processados.`);
  } else {
    logger.success(`Job finalizado com sucesso! ${totalProcessado} itens processados.`);
  }

  return relatorio;
}

/**
 * Entry point para execução via CLI
 */
async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    mostrarAjuda();
    process.exit(0);
  }

  try {
    // Inicializar Firebase
    const firebase = await initFirebase();

    if (!firebase) {
      logger.error('Não foi possível inicializar o Firebase.');
      logger.info('Certifique-se de que as variáveis de ambiente estão configuradas:');
      logger.info('  FIREBASE_PROJECT_ID');
      logger.info('  FIREBASE_CLIENT_EMAIL');
      logger.info('  FIREBASE_PRIVATE_KEY');
      process.exit(1);
    }

    const { firestore, auth } = firebase;

    // Executar job
    const relatorio = await executarJob(firestore, auth, options);

    // Exit code baseado em erros
    const temErros = relatorio.erros?.length > 0;
    process.exit(temErros ? 1 : 0);
  } catch (error) {
    logger.error(`Erro fatal: ${error.message}`);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Executar se chamado diretamente
const isMainModule = process.argv[1]?.includes('retentionJob');
if (isMainModule) {
  main();
}

export default executarJob;

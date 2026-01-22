/**
 * Script para popular playbooks iniciais no Firebase
 *
 * Execute com: node scripts/populate-playbooks.js
 *
 * Requer: FIREBASE_SERVICE_ACCOUNT_KEY ou execute no browser com console
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

// Configuração do Firebase (mesma do projeto)
const firebaseConfig = {
  apiKey: "AIzaSyAj_5TqOMRSNVm4G0wmE3HgrHEIS7LkkE8",
  authDomain: "cs-hub-8c032.firebaseapp.com",
  projectId: "cs-hub-8c032",
  storageBucket: "cs-hub-8c032.firebasestorage.app",
  messagingSenderId: "534500351748",
  appId: "1:534500351748:web:c0b7305aed3c538ece3a51"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Playbook de Onboarding
const playbookOnboarding = {
  nome: "Onboarding",
  descricao: "Processo de implantação de cliente novo",
  duracao_estimada_dias: 30,
  ativo: true,
  etapas: [
    {
      ordem: 1,
      nome: "Kick-off",
      descricao: "Reunião inicial de alinhamento com o cliente",
      prazo_dias: 1,
      obrigatoria: true
    },
    {
      ordem: 2,
      nome: "Configuração inicial",
      descricao: "Setup da conta, upload de logo, configuração de marca",
      prazo_dias: 3,
      obrigatoria: true
    },
    {
      ordem: 3,
      nome: "Treinamento 1",
      descricao: "Treinamento básico da plataforma",
      prazo_dias: 7,
      obrigatoria: true
    },
    {
      ordem: 4,
      nome: "Treinamento 2",
      descricao: "Treinamento avançado e casos de uso específicos",
      prazo_dias: 14,
      obrigatoria: true
    },
    {
      ordem: 5,
      nome: "Go-live",
      descricao: "Cliente começa a usar em produção",
      prazo_dias: 21,
      obrigatoria: true
    },
    {
      ordem: 6,
      nome: "Check-in pós go-live",
      descricao: "Reunião de acompanhamento 1 semana após go-live",
      prazo_dias: 30,
      obrigatoria: false
    }
  ],
  created_at: Timestamp.now(),
  updated_at: Timestamp.now()
};

// Playbook de Reativação (exemplo adicional)
const playbookReativacao = {
  nome: "Reativação de Cliente",
  descricao: "Processo para reativar clientes inativos",
  duracao_estimada_dias: 14,
  ativo: true,
  etapas: [
    {
      ordem: 1,
      nome: "Análise de histórico",
      descricao: "Revisar histórico de uso e motivos da inatividade",
      prazo_dias: 1,
      obrigatoria: true
    },
    {
      ordem: 2,
      nome: "Contato inicial",
      descricao: "Ligar ou enviar email para entender a situação",
      prazo_dias: 2,
      obrigatoria: true
    },
    {
      ordem: 3,
      nome: "Reunião de alinhamento",
      descricao: "Reunião para entender necessidades e apresentar novidades",
      prazo_dias: 7,
      obrigatoria: true
    },
    {
      ordem: 4,
      nome: "Plano de ação",
      descricao: "Definir próximos passos e metas",
      prazo_dias: 10,
      obrigatoria: true
    },
    {
      ordem: 5,
      nome: "Acompanhamento",
      descricao: "Verificar se o cliente voltou a usar a plataforma",
      prazo_dias: 14,
      obrigatoria: false
    }
  ],
  created_at: Timestamp.now(),
  updated_at: Timestamp.now()
};

// Playbook de QBR (Quarterly Business Review)
const playbookQBR = {
  nome: "QBR (Quarterly Business Review)",
  descricao: "Revisão trimestral de resultados com o cliente",
  duracao_estimada_dias: 7,
  ativo: true,
  etapas: [
    {
      ordem: 1,
      nome: "Coleta de dados",
      descricao: "Reunir métricas de uso, NPS e resultados do período",
      prazo_dias: 2,
      obrigatoria: true
    },
    {
      ordem: 2,
      nome: "Preparar apresentação",
      descricao: "Criar apresentação com análise de resultados e recomendações",
      prazo_dias: 4,
      obrigatoria: true
    },
    {
      ordem: 3,
      nome: "Reunião de QBR",
      descricao: "Apresentar resultados e alinhar próximos passos",
      prazo_dias: 6,
      obrigatoria: true
    },
    {
      ordem: 4,
      nome: "Documentar ação",
      descricao: "Registrar decisões e criar tarefas de follow-up",
      prazo_dias: 7,
      obrigatoria: false
    }
  ],
  created_at: Timestamp.now(),
  updated_at: Timestamp.now()
};

async function populatePlaybooks() {
  console.log('Iniciando população de playbooks...\n');

  try {
    // Playbook de Onboarding
    console.log('Criando playbook de Onboarding...');
    await setDoc(doc(db, 'playbooks', 'onboarding'), playbookOnboarding);
    console.log('✅ Playbook de Onboarding criado com sucesso!\n');

    // Playbook de Reativação
    console.log('Criando playbook de Reativação...');
    await setDoc(doc(db, 'playbooks', 'reativacao'), playbookReativacao);
    console.log('✅ Playbook de Reativação criado com sucesso!\n');

    // Playbook de QBR
    console.log('Criando playbook de QBR...');
    await setDoc(doc(db, 'playbooks', 'qbr'), playbookQBR);
    console.log('✅ Playbook de QBR criado com sucesso!\n');

    console.log('='.repeat(50));
    console.log('Todos os playbooks foram criados com sucesso!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Erro ao popular playbooks:', error);
    process.exit(1);
  }
}

populatePlaybooks();

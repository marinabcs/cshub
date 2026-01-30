import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { isOpenAIConfigured } from '../services/openai';
import { getHealthColor, getHealthLabel } from '../utils/healthScore';
import {
  FileText, Calendar, Check, ChevronDown, X, Sparkles, Download,
  RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Activity, Users, Zap, Image, Search
} from 'lucide-react';

// Seções disponíveis para o resumo
const SECOES_DISPONIVEIS = [
  { id: 'health', label: 'Health Score e Tendência', icon: Activity },
  { id: 'metricas', label: 'Métricas de Uso', icon: Zap },
  { id: 'conversas', label: 'Resumo das Conversas (IA)', icon: FileText },
  { id: 'atencao', label: 'Pontos de Atenção', icon: AlertTriangle },
  { id: 'recomendacoes', label: 'Recomendações (IA)', icon: Sparkles },
];

export default function ResumoExecutivo() {
  // Estados de filtros
  const [clientes, setClientes] = useState([]);
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [searchCliente, setSearchCliente] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);
  const [secoesAtivas, setSecoesAtivas] = useState(['health', 'metricas', 'conversas', 'atencao', 'recomendacoes']);

  // Estados de geração
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [progressoGeracao, setProgressoGeracao] = useState({ atual: 0, total: 0, cliente: '' });
  const [resumosGerados, setResumosGerados] = useState([]);
  const [erro, setErro] = useState(null);

  // Ref para exportação PDF
  const resumoRef = useRef(null);

  // Carregar clientes
  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'clientes'));
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(c => c.status !== 'inativo' && c.status !== 'cancelado')
          .sort((a, b) => (a.team_name || '').localeCompare(b.team_name || ''));
        setClientes(data);
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, []);

  // Filtrar clientes para dropdown
  const clientesFiltrados = clientes.filter(c =>
    !searchCliente || (c.team_name || '').toLowerCase().includes(searchCliente.toLowerCase())
  );

  // Toggle seleção de cliente
  const toggleCliente = (clienteId) => {
    setSelectedClientes(prev =>
      prev.includes(clienteId)
        ? prev.filter(id => id !== clienteId)
        : [...prev, clienteId]
    );
  };

  // Toggle seção
  const toggleSecao = (secaoId) => {
    setSecoesAtivas(prev =>
      prev.includes(secaoId)
        ? prev.filter(id => id !== secaoId)
        : [...prev, secaoId]
    );
  };

  // Buscar dados de um cliente
  const buscarDadosCliente = async (cliente) => {
    const teamIds = cliente.times || [cliente.team_id || cliente.id];
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59, 999);

    // Buscar threads do período
    const threadsRef = collection(db, 'threads');
    let allThreads = [];
    const chunkSize = 10;

    for (let i = 0; i < teamIds.length; i += chunkSize) {
      const chunk = teamIds.slice(i, i + chunkSize);
      const q = query(threadsRef, where('team_id', 'in', chunk));
      const snap = await getDocs(q);
      allThreads.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }

    // Filtrar por período
    const threadsPeriodo = allThreads.filter(t => {
      const createdAt = t.created_at?.toDate?.() || new Date(t.created_at || 0);
      return createdAt >= inicio && createdAt <= fim;
    });

    // Buscar métricas do período
    const metricasRef = collection(db, 'metricas_diarias');
    let allMetricas = [];

    for (let i = 0; i < teamIds.length; i += chunkSize) {
      const chunk = teamIds.slice(i, i + chunkSize);
      const q = query(
        metricasRef,
        where('team_id', 'in', chunk),
        where('data', '>=', inicio),
        where('data', '<=', fim)
      );
      const snap = await getDocs(q);
      allMetricas.push(...snap.docs.map(d => d.data()));
    }

    // Agregar métricas
    const metricas = allMetricas.reduce((acc, m) => ({
      logins: acc.logins + (m.logins || 0),
      pecas_criadas: acc.pecas_criadas + (m.pecas_criadas || 0),
      downloads: acc.downloads + (m.downloads || 0),
      uso_ai_total: acc.uso_ai_total + (m.uso_ai_total || 0),
    }), { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 });

    // Buscar health history
    const historyRef = collection(db, 'clientes', cliente.id, 'health_history');
    const historySnap = await getDocs(query(historyRef, orderBy('hist_date', 'desc'), limit(30)));
    const healthHistory = historySnap.docs.map(d => d.data());

    // Calcular tendência
    let tendencia = 0;
    if (healthHistory.length >= 2) {
      const recente = healthHistory[0]?.hist_score || cliente.health_score || 0;
      const antigo = healthHistory[healthHistory.length - 1]?.hist_score || recente;
      tendencia = recente - antigo;
    }

    // Buscar alertas pendentes
    const alertasRef = collection(db, 'alertas');
    let alertasPendentes = [];
    try {
      const alertasQ = query(
        alertasRef,
        where('cliente_id', '==', cliente.id),
        where('status', '==', 'pendente')
      );
      const alertasSnap = await getDocs(alertasQ);
      alertasPendentes = alertasSnap.docs.map(d => d.data());
    } catch (e) {
      // Índice pode não existir
    }

    return {
      cliente,
      threads: threadsPeriodo,
      metricas,
      healthHistory,
      tendencia,
      alertasPendentes,
      ticketsAbertos: threadsPeriodo.filter(t =>
        t.status === 'aguardando_equipe' || t.status === 'ativo'
      ).length,
    };
  };

  // Gerar resumo com IA
  const gerarResumoIA = async (dados) => {
    const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return { resumo: '', atencao: [], recomendacoes: [] };

    const { cliente, threads, metricas, tendencia, ticketsAbertos } = dados;

    // Preparar lista de conversas
    const conversasTexto = threads.slice(0, 20).map(t =>
      `- ${t.assunto || t.subject || 'Sem assunto'} (${t.categoria || 'sem categoria'}, ${t.sentimento || 'neutro'})`
    ).join('\n');

    const prompt = `Você é um analista de Customer Success da Trakto. Gere um resumo executivo profissional.

CLIENTE: ${cliente.team_name}
PERÍODO: ${dataInicio} a ${dataFim}
HEALTH SCORE: ${cliente.health_score || 0} (${getHealthLabel(cliente.health_status)})
TENDÊNCIA: ${tendencia > 0 ? '+' : ''}${tendencia} pontos

MÉTRICAS DO PERÍODO:
- Logins: ${metricas.logins}
- Peças criadas: ${metricas.pecas_criadas}
- Downloads: ${metricas.downloads}
- Uso de IA: ${metricas.uso_ai_total}

TICKETS ABERTOS: ${ticketsAbertos}
CONVERSAS NO PERÍODO (${threads.length} total):
${conversasTexto || 'Nenhuma conversa no período'}

Gere um JSON com:
{
  "resumo": "2-3 parágrafos analisando o período, destacando pontos positivos e áreas de melhoria",
  "atencao": ["lista de 2-4 pontos que precisam de atenção imediata"],
  "recomendacoes": ["lista de 3-5 recomendações práticas para melhorar o relacionamento"]
}

Seja específico e acionável nas recomendações. Use português brasileiro profissional.`;

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
            { role: 'system', content: 'Você é um analista de Customer Success. Responda APENAS com JSON válido.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5
        })
      });

      if (!response.ok) throw new Error('Erro na API');

      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Erro ao gerar resumo IA:', error);
      return {
        resumo: 'Não foi possível gerar o resumo automaticamente.',
        atencao: ticketsAbertos > 0 ? [`${ticketsAbertos} ticket(s) aguardando resposta`] : [],
        recomendacoes: ['Agendar reunião de acompanhamento com o cliente']
      };
    }
  };

  // Gerar resumos
  const handleGerar = async () => {
    if (selectedClientes.length === 0) {
      setErro('Selecione pelo menos um cliente');
      return;
    }

    setGerando(true);
    setErro(null);
    setResumosGerados([]);
    setProgressoGeracao({ atual: 0, total: selectedClientes.length, cliente: '' });

    const resumos = [];

    for (let i = 0; i < selectedClientes.length; i++) {
      const clienteId = selectedClientes[i];
      const cliente = clientes.find(c => c.id === clienteId);

      setProgressoGeracao({ atual: i + 1, total: selectedClientes.length, cliente: cliente?.team_name || '' });

      try {
        const dados = await buscarDadosCliente(cliente);

        let resumoIA = { resumo: '', atencao: [], recomendacoes: [] };
        if (secoesAtivas.includes('conversas') || secoesAtivas.includes('recomendacoes')) {
          resumoIA = await gerarResumoIA(dados);
        }

        resumos.push({
          ...dados,
          resumoIA,
          secoesAtivas: [...secoesAtivas],
          periodo: { inicio: dataInicio, fim: dataFim }
        });
      } catch (error) {
        console.error(`Erro ao gerar resumo para ${cliente?.team_name}:`, error);
      }
    }

    setResumosGerados(resumos);
    setGerando(false);
  };

  // Exportar PDF
  const exportarPDF = async () => {
    if (!resumoRef.current) return;

    try {
      const html2pdf = (await import('html2pdf.js')).default;

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `resumo-executivo-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(resumoRef.current).save();
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      setErro('Erro ao exportar PDF');
    }
  };

  // Formatar data para exibição
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)'
          }}>
            <FileText style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>
              Resumo Executivo
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>
              Gere resumos personalizados para enviar aos clientes
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px' }}>
        {/* Painel de Filtros */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px',
          height: 'fit-content',
          position: 'sticky',
          top: '32px'
        }}>
          <h2 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 20px 0' }}>
            Configurar Resumo
          </h2>

          {/* Seleção de Clientes */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
              Clientes ({selectedClientes.length} selecionados)
            </label>
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                style={{
                  padding: '12px 16px',
                  background: '#0f0a1f',
                  border: '1px solid #3730a3',
                  borderRadius: '12px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ color: selectedClientes.length > 0 ? 'white' : '#64748b' }}>
                  {selectedClientes.length > 0
                    ? `${selectedClientes.length} cliente${selectedClientes.length > 1 ? 's' : ''} selecionado${selectedClientes.length > 1 ? 's' : ''}`
                    : 'Selecionar clientes...'}
                </span>
                <ChevronDown style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
              </div>

              {showClienteDropdown && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                    onClick={() => setShowClienteDropdown(false)}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: '#1a1033',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    maxHeight: '300px',
                    overflow: 'hidden',
                    zIndex: 50,
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                  }}>
                  <div style={{ padding: '12px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                    <div style={{ position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                      <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={searchCliente}
                        onChange={(e) => setSearchCliente(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px 10px 36px',
                          background: '#0f0a1f',
                          border: '1px solid #3730a3',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {clientesFiltrados.map(cliente => {
                      const isSelected = selectedClientes.includes(cliente.id);
                      return (
                        <div
                          key={cliente.id}
                          onClick={() => toggleCliente(cliente.id)}
                          style={{
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                            borderBottom: '1px solid rgba(139, 92, 246, 0.05)'
                          }}
                        >
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            border: `2px solid ${isSelected ? '#8b5cf6' : '#3730a3'}`,
                            background: isSelected ? '#8b5cf6' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSelected && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
                          </div>
                          <span style={{ color: 'white', fontSize: '13px', flex: 1 }}>{cliente.team_name}</span>
                          <span style={{
                            padding: '2px 8px',
                            background: `${getHealthColor(cliente.health_status)}20`,
                            color: getHealthColor(cliente.health_status),
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            {cliente.health_score || 0}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </>
              )}
            </div>

            {/* Tags dos selecionados */}
            {selectedClientes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {selectedClientes.map(id => {
                  const cliente = clientes.find(c => c.id === id);
                  return (
                    <span
                      key={id}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(139, 92, 246, 0.2)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '6px',
                        color: '#a78bfa',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {cliente?.team_name}
                      <X
                        style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                        onClick={() => toggleCliente(id)}
                      />
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Período */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
              Período
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#0f0a1f',
                    border: '1px solid #3730a3',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    colorScheme: 'dark',
                    WebkitAppearance: 'none'
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#0f0a1f',
                    border: '1px solid #3730a3',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    colorScheme: 'dark',
                    WebkitAppearance: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Seções */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }}>
              Seções a incluir
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SECOES_DISPONIVEIS.map(secao => {
                const isActive = secoesAtivas.includes(secao.id);
                const Icon = secao.icon;
                return (
                  <div
                    key={secao.id}
                    onClick={() => toggleSecao(secao.id)}
                    style={{
                      padding: '12px 14px',
                      background: isActive ? 'rgba(139, 92, 246, 0.1)' : 'rgba(15, 10, 31, 0.6)',
                      border: `1px solid ${isActive ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.1)'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: `2px solid ${isActive ? '#8b5cf6' : '#3730a3'}`,
                      background: isActive ? '#8b5cf6' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {isActive && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
                    </div>
                    <Icon style={{ width: '16px', height: '16px', color: isActive ? '#8b5cf6' : '#64748b' }} />
                    <span style={{ color: isActive ? 'white' : '#94a3b8', fontSize: '13px' }}>{secao.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aviso OpenAI */}
          {!isOpenAIConfigured() && (secoesAtivas.includes('conversas') || secoesAtivas.includes('recomendacoes')) && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '10px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle style={{ width: '18px', height: '18px', color: '#f59e0b' }} />
              <span style={{ color: '#f59e0b', fontSize: '12px' }}>
                OpenAI não configurada. Seções com IA terão conteúdo limitado.
              </span>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '10px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle style={{ width: '18px', height: '18px', color: '#ef4444' }} />
              <span style={{ color: '#ef4444', fontSize: '12px' }}>{erro}</span>
            </div>
          )}

          {/* Botão Gerar */}
          <button
            onClick={handleGerar}
            disabled={gerando || selectedClientes.length === 0}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: gerando || selectedClientes.length === 0
                ? 'rgba(139, 92, 246, 0.3)'
                : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              fontSize: '14px',
              cursor: gerando || selectedClientes.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {gerando ? (
              <>
                <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                Gerando... ({progressoGeracao.atual}/{progressoGeracao.total})
              </>
            ) : (
              <>
                <Sparkles style={{ width: '18px', height: '18px' }} />
                Gerar Resumo
              </>
            )}
          </button>

          {gerando && progressoGeracao.cliente && (
            <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>
              Processando: {progressoGeracao.cliente}
            </p>
          )}
        </div>

        {/* Área de Preview */}
        <div>
          {resumosGerados.length === 0 ? (
            <div style={{
              background: 'rgba(30, 27, 75, 0.4)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: '20px',
              padding: '80px 40px',
              textAlign: 'center'
            }}>
              <FileText style={{ width: '64px', height: '64px', color: '#3730a3', margin: '0 auto 20px' }} />
              <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 8px 0' }}>
                Nenhum resumo gerado
              </h3>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                Selecione os clientes e clique em "Gerar Resumo" para começar
              </p>
            </div>
          ) : (
            <>
              {/* Botões de ação */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px' }}>
                <button
                  onClick={handleGerar}
                  style={{
                    padding: '10px 16px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '10px',
                    color: '#a78bfa',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <RefreshCw style={{ width: '16px', height: '16px' }} />
                  Regenerar
                </button>
                <button
                  onClick={exportarPDF}
                  style={{
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Download style={{ width: '16px', height: '16px' }} />
                  Exportar PDF
                </button>
              </div>

              {/* Resumos */}
              <div ref={resumoRef} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {resumosGerados.map((resumo, index) => (
                  <div
                    key={resumo.cliente.id}
                    style={{
                      background: 'white',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {/* Header do PDF */}
                    <div style={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                      padding: '24px 32px',
                      color: 'white'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700' }}>
                            Resumo Executivo
                          </h2>
                          <p style={{ margin: 0, fontSize: '18px', opacity: 0.9 }}>
                            {resumo.cliente.team_name}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.8 }}>Período</p>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                            {formatDate(resumo.periodo.inicio)} - {formatDate(resumo.periodo.fim)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo */}
                    <div style={{ padding: '32px' }}>
                      {/* Health Score */}
                      {resumo.secoesAtivas.includes('health') && (
                        <div style={{ marginBottom: '32px' }}>
                          <h3 style={{ color: '#1e1b4b', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
                            Health Score
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '50%',
                              background: `${getHealthColor(resumo.cliente.health_status)}15`,
                              border: `3px solid ${getHealthColor(resumo.cliente.health_status)}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <span style={{ fontSize: '28px', fontWeight: '700', color: getHealthColor(resumo.cliente.health_status) }}>
                                {resumo.cliente.health_score || 0}
                              </span>
                            </div>
                            <div>
                              <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '14px' }}>
                                Status: <span style={{ color: getHealthColor(resumo.cliente.health_status), fontWeight: '600' }}>
                                  {getHealthLabel(resumo.cliente.health_status)}
                                </span>
                              </p>
                              <p style={{ margin: 0, color: '#64748b', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Tendência:
                                {resumo.tendencia > 0 ? (
                                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <TrendingUp style={{ width: '16px', height: '16px' }} />
                                    +{resumo.tendencia} pts
                                  </span>
                                ) : resumo.tendencia < 0 ? (
                                  <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <TrendingDown style={{ width: '16px', height: '16px' }} />
                                    {resumo.tendencia} pts
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <Minus style={{ width: '16px', height: '16px' }} />
                                    Estável
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Métricas */}
                      {resumo.secoesAtivas.includes('metricas') && (
                        <div style={{ marginBottom: '32px' }}>
                          <h3 style={{ color: '#1e1b4b', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
                            Métricas de Uso
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center' }}>
                              <Users style={{ width: '24px', height: '24px', color: '#8b5cf6', margin: '0 auto 8px' }} />
                              <p style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700', color: '#1e1b4b' }}>
                                {resumo.metricas.logins}
                              </p>
                              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Logins</p>
                            </div>
                            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center' }}>
                              <Image style={{ width: '24px', height: '24px', color: '#06b6d4', margin: '0 auto 8px' }} />
                              <p style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700', color: '#1e1b4b' }}>
                                {resumo.metricas.pecas_criadas}
                              </p>
                              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Peças Criadas</p>
                            </div>
                            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center' }}>
                              <Download style={{ width: '24px', height: '24px', color: '#10b981', margin: '0 auto 8px' }} />
                              <p style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700', color: '#1e1b4b' }}>
                                {resumo.metricas.downloads}
                              </p>
                              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Downloads</p>
                            </div>
                            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center' }}>
                              <Sparkles style={{ width: '24px', height: '24px', color: '#f59e0b', margin: '0 auto 8px' }} />
                              <p style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700', color: '#1e1b4b' }}>
                                {resumo.metricas.uso_ai_total}
                              </p>
                              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Uso de IA</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Resumo das Conversas */}
                      {resumo.secoesAtivas.includes('conversas') && resumo.resumoIA.resumo && (
                        <div style={{ marginBottom: '32px' }}>
                          <h3 style={{ color: '#1e1b4b', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
                            Resumo das Conversas
                          </h3>
                          <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid #8b5cf6' }}>
                            <p style={{ margin: 0, color: '#334155', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                              {resumo.resumoIA.resumo}
                            </p>
                          </div>
                          <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '12px' }}>
                            {resumo.threads.length} conversa(s) analisada(s) no período
                          </p>
                        </div>
                      )}

                      {/* Pontos de Atenção */}
                      {resumo.secoesAtivas.includes('atencao') && resumo.resumoIA.atencao?.length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                          <h3 style={{ color: '#1e1b4b', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
                            Pontos de Atenção
                          </h3>
                          <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#334155', fontSize: '14px', lineHeight: '1.8' }}>
                            {resumo.resumoIA.atencao.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recomendações */}
                      {resumo.secoesAtivas.includes('recomendacoes') && resumo.resumoIA.recomendacoes?.length > 0 && (
                        <div>
                          <h3 style={{ color: '#1e1b4b', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
                            Recomendações
                          </h3>
                          <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#334155', fontSize: '14px', lineHeight: '1.8' }}>
                            {resumo.resumoIA.recomendacoes.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Footer do PDF */}
                    <div style={{
                      padding: '16px 32px',
                      background: '#f8fafc',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                        Gerado pelo CS Hub em {new Date().toLocaleDateString('pt-BR')}
                      </p>
                      <p style={{ margin: 0, color: '#8b5cf6', fontSize: '12px', fontWeight: '600' }}>
                        Trakto
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}

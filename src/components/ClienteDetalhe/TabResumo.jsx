import { useState } from 'react';
import { AlertTriangle, Activity, Sparkles, Key, Eye, EyeOff, RotateCcw, Plus, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getClienteSegmento } from '../../utils/segmentoCS';
import { SegmentoBadge } from '../UI/SegmentoBadge';
import HeavyUsersCard from '../Cliente/HeavyUsersCard';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { TAGS_PREDEFINIDAS } from './constants';

/**
 * Tab Resumo - Renders the summary tab of ClienteDetalhe.
 * Shows: saude CS card, metric cards, 60-day charts, tags de problema, heavy users, senha padrao.
 */
export default function TabResumo({
  cliente,
  setCliente,
  clienteId,
  usageData,
  chartData,
  segmentoCalculado,
  onRecalcularSegmento
}) {
  const [showSenhaPadrao, setShowSenhaPadrao] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [customTag, setCustomTag] = useState('');

  const handleAddTag = async (tagName, origem = 'cs', threadId = '') => {
    const tagsAtuais = cliente.tags_problema || [];
    if (tagsAtuais.some(t => t.tag === tagName)) return;
    const novaTag = { tag: tagName, origem, data: Timestamp.now(), thread_id: threadId };
    const novoArray = [...tagsAtuais, novaTag];
    try {
      await updateDoc(doc(db, 'clientes', clienteId), { tags_problema: novoArray });
      setCliente(prev => ({ ...prev, tags_problema: novoArray }));
      setShowTagDropdown(false);
      setCustomTag('');
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
    }
  };

  const handleRemoveTag = async (tagName) => {
    const novoArray = (cliente.tags_problema || []).filter(t => t.tag !== tagName);
    try {
      await updateDoc(doc(db, 'clientes', clienteId), { tags_problema: novoArray });
      setCliente(prev => ({ ...prev, tags_problema: novoArray }));
    } catch (error) {
      console.error('Erro ao remover tag:', error);
    }
  };

  return (
    <>
      {/* Aviso de Cliente Inativo */}
      {cliente.status === 'inativo' && (
        <div style={{ background: 'rgba(107, 114, 128, 0.15)', border: '1px solid rgba(107, 114, 128, 0.3)', borderRadius: '16px', padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle style={{ width: '20px', height: '20px', color: '#9ca3af', flexShrink: 0 }} />
          <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
            <strong>Cliente Inativo</strong> — métricas pausadas, dados históricos preservados.
          </p>
        </div>
      )}

      {/* Saude CS - Compacto */}
      {cliente.status !== 'inativo' && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: segmentoCalculado?.motivo || segmentoCalculado?.fatores ? '14px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SegmentoBadge segmento={getClienteSegmento(cliente)} size="lg" />
            {segmentoCalculado?.changed && cliente.segmento_anterior && (
              <span style={{ color: '#f59e0b', fontSize: '12px' }}>
                (era {cliente.segmento_anterior})
              </span>
            )}
          </div>
          <button
            onClick={onRecalcularSegmento}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', color: '#a78bfa', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
          >
            <RotateCcw style={{ width: '14px', height: '14px' }} />
            Recalcular
          </button>
        </div>
        {segmentoCalculado?.motivo && (
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 10px 0' }}>{segmentoCalculado.motivo}</p>
        )}
        {segmentoCalculado?.fatores && (
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ color: '#64748b', fontSize: '12px' }}>{usageData.dias_ativos} <span title="Dias com pelo menos 1 atividade nos últimos 30 dias (não precisam ser consecutivos)">dias ativos</span> no mês | Score engajamento: <strong style={{ color: 'white' }}>{segmentoCalculado.fatores.engajamento}</strong></span>
          </div>
        )}
      </div>
      )}

      {/* Metricas de Uso - Escala (3) + IA (2) */}
      {cliente.status !== 'inativo' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Logins (30d)</p>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>{usageData.logins.toLocaleString('pt-BR')}</p>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Projetos (30d)</p>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>{usageData.projetos_criados.toLocaleString('pt-BR')}</p>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Assets (30d)</p>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>{usageData.pecas_criadas.toLocaleString('pt-BR')}</p>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Créditos IA (30d)</p>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>{usageData.creditos_consumidos.toLocaleString('pt-BR')}</p>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Features IA (30d)</p>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>{usageData.features_usadas.toLocaleString('pt-BR')}</p>
        </div>
      </div>
      )}

      {/* Graficos de Metricas (60 dias) */}
      {cliente.status !== 'inativo' && chartData.length > 0 && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Grafico Escala: Logins + Projetos + Assets */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Activity style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
            <h3 style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0 }}>Escala (60 dias)</h3>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8b5cf6' }} />
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Logins</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#06b6d4' }} />
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Projetos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Assets</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => {
                  const d = new Date(value);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value, name) => [value, name === 'logins' ? 'Logins' : name === 'projetos' ? 'Projetos' : 'Assets']}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return d.toLocaleDateString('pt-BR');
                }}
              />
              <Line type="monotone" dataKey="logins" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="projetos" stroke="#06b6d4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="assets" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Grafico IA: Creditos + Features */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(249, 115, 22, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Sparkles style={{ width: '16px', height: '16px', color: '#f97316' }} />
            <h3 style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0 }}>IA (60 dias)</h3>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f97316' }} />
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Créditos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#a855f7' }} />
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Features usadas</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(249, 115, 22, 0.1)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickFormatter={(value) => {
                  const d = new Date(value);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value, name) => [value, name === 'creditos_ia' ? 'Créditos' : 'Features']}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return d.toLocaleDateString('pt-BR');
                }}
              />
              <Line type="monotone" dataKey="creditos_ia" stroke="#f97316" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="features_ia" stroke="#a855f7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {/* Tags de Problema */}
      {cliente.status !== 'inativo' && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '14px', height: '14px', color: '#ef4444' }} />
            <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: 0 }}>Tags de Problema</p>
            {(cliente.tags_problema || []).length > 0 && (
              <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '10px', fontSize: '11px', fontWeight: '500' }}>
                {(cliente.tags_problema || []).length}
              </span>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              style={{ width: '28px', height: '28px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
            </button>
            {showTagDropdown && (
              <div style={{ position: 'absolute', top: '36px', right: 0, background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '8px', zIndex: 50, minWidth: '220px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                {TAGS_PREDEFINIDAS.filter(t => !(cliente.tags_problema || []).some(tp => tp.tag === t)).map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleAddTag(tag)}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderRadius: '8px' }}
                    onMouseEnter={e => { e.target.style.background = 'rgba(139, 92, 246, 0.15)'; e.target.style.color = 'white'; }}
                    onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#94a3b8'; }}
                  >
                    {tag}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid rgba(139, 92, 246, 0.15)', marginTop: '4px', paddingTop: '8px', display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={customTag}
                    onChange={e => setCustomTag(e.target.value)}
                    placeholder="Tag customizada..."
                    style={{ flex: 1, padding: '6px 10px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '8px', color: 'white', fontSize: '12px', outline: 'none' }}
                    onKeyDown={e => { if (e.key === 'Enter' && customTag.trim()) handleAddTag(customTag.trim()); }}
                  />
                  <button
                    onClick={() => { if (customTag.trim()) handleAddTag(customTag.trim()); }}
                    style={{ padding: '6px 10px', background: 'rgba(139, 92, 246, 0.3)', border: 'none', borderRadius: '8px', color: '#a78bfa', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {(cliente.tags_problema || []).length === 0 ? (
          <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>Nenhuma tag de problema</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(cliente.tags_problema || []).map((t, idx) => {
              const isIA = t.origem === 'ia';
              const cor = isIA ? '#06b6d4' : '#8b5cf6';
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: isIA ? 'rgba(6, 182, 212, 0.15)' : 'rgba(139, 92, 246, 0.15)', border: `1px solid ${isIA ? 'rgba(6, 182, 212, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`, borderRadius: '8px' }}>
                  <span style={{ color: cor, fontSize: '12px', fontWeight: '500' }}>{t.tag}</span>
                  <span style={{ color: '#475569', fontSize: '10px' }}>{isIA ? 'IA' : 'CS'}</span>
                  <button
                    onClick={() => handleRemoveTag(t.tag)}
                    style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => { e.target.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.target.style.color = '#475569'; }}
                  >
                    <X style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Heavy Users */}
      {cliente.status !== 'inativo' && (
      <div style={{ marginBottom: '16px' }}>
        <HeavyUsersCard
          teamIds={cliente.times || (cliente.team_id ? [cliente.team_id] : [cliente.id])}
          days={30}
          topN={5}
        />
      </div>
      )}

      {/* Senha Padrao @trakto */}
      {cliente.senha_padrao && (
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Key style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Senha Padrão:</span>
              <span style={{ color: 'white', fontSize: '14px', fontWeight: '600', fontFamily: 'monospace' }}>
                {showSenhaPadrao ? cliente.senha_padrao : '••••••••'}
              </span>
            </div>
            <button
              onClick={() => setShowSenhaPadrao(!showSenhaPadrao)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              {showSenhaPadrao
                ? <EyeOff style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                : <Eye style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              }
            </button>
          </div>
        </div>
      )}
    </>
  );
}

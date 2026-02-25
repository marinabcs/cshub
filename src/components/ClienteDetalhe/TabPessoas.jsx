import { useState, useEffect } from 'react';
import { User, Star, Plus, Trash2, Mail, Phone, Linkedin, ExternalLink, ChevronDown, Copy, Sparkles, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserActivityDot } from '../UserActivityBadge';
import { TIPOS_CONTATO, getInitials, formatSimpleDate, getUserStatusColor, getUserStatusLabel } from './constants';

/**
 * Tab Pessoas - Users table, stakeholders section, and suggested contacts.
 */
export default function TabPessoas({
  clienteId,
  cliente,
  setCliente,
  usuarios,
  threads,
  getUserActivityStatus,
  suggestedContacts,
  setSuggestedContacts
}) {
  const [showAllUsuarios, setShowAllUsuarios] = useState(false);
  const [showStakeholderForm, setShowStakeholderForm] = useState(false);
  const [stakeholderForm, setStakeholderForm] = useState({ nome: '', email: '', cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro' });
  const [savingStakeholder, setSavingStakeholder] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState([]);

  const displayedUsuarios = showAllUsuarios ? usuarios : usuarios.slice(0, 20);

  const getTeamNameById = (teamId) => {
    const timesInfo = cliente?.times_info || {};
    return timesInfo[teamId] || teamId;
  };

  // Extract contacts from threads for suggestions
  const extractContactsFromThreads = () => {
    if (!threads || threads.length === 0 || !cliente) return;

    const existingEmails = new Set(
      (cliente.stakeholders || []).map(s => s.email.toLowerCase())
    );

    const senderMap = new Map();
    for (const thread of threads) {
      const email = thread.remetente_email || thread.sender_email || thread.from || '';
      const nome = thread.remetente_nome || thread.sender_name || '';
      if (!email || existingEmails.has(email.toLowerCase())) continue;
      if (email.toLowerCase().includes('@trakto.io')) continue;
      if (/noreply|no-reply|no_reply|mailer|bounce/i.test(email)) continue;

      if (!senderMap.has(email.toLowerCase())) {
        senderMap.set(email.toLowerCase(), { email, nome, threadCount: 1 });
      } else {
        const existing = senderMap.get(email.toLowerCase());
        existing.threadCount++;
        if (!existing.nome && nome) existing.nome = nome;
      }
    }

    const suggestions = Array.from(senderMap.values())
      .filter(s => !dismissedSuggestions.includes(s.email.toLowerCase()))
      .sort((a, b) => b.threadCount - a.threadCount);
    setSuggestedContacts(suggestions);
  };

  useEffect(() => {
    if (threads.length > 0 && cliente) {
      extractContactsFromThreads();
    }
  }, [threads, cliente?.stakeholders]);

  const handleSaveStakeholder = async () => {
    if (!stakeholderForm.nome.trim() || !stakeholderForm.email.trim()) {
      alert('Nome e email são obrigatórios');
      return;
    }
    setSavingStakeholder(true);
    try {
      const newStakeholder = {
        id: Date.now().toString(),
        nome: stakeholderForm.nome.trim(),
        email: stakeholderForm.email.trim().toLowerCase(),
        cargo: stakeholderForm.cargo.trim(),
        telefone: stakeholderForm.telefone.trim(),
        linkedin_url: stakeholderForm.linkedin_url.trim(),
        tipo_contato: stakeholderForm.tipo_contato
      };
      const updatedStakeholders = [...(cliente.stakeholders || []), newStakeholder];
      await updateDoc(doc(db, 'clientes', clienteId), { stakeholders: updatedStakeholders });
      setCliente(prev => ({ ...prev, stakeholders: updatedStakeholders }));
      setStakeholderForm({ nome: '', email: '', cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro' });
      setShowStakeholderForm(false);
    } catch {
      alert('Erro ao salvar stakeholder');
    } finally {
      setSavingStakeholder(false);
    }
  };

  const handleDeleteStakeholder = async (stakeholderId, index) => {
    if (!confirm('Remover este stakeholder?')) return;
    try {
      const current = cliente.stakeholders || [];
      const updatedStakeholders = current.filter((s, i) => s.id ? s.id !== stakeholderId : i !== index);
      await updateDoc(doc(db, 'clientes', clienteId), { stakeholders: updatedStakeholders });
      setCliente(prev => ({ ...prev, stakeholders: updatedStakeholders }));
    } catch {
      alert('Erro ao remover stakeholder');
    }
  };

  const handleAddSuggestedContact = async (contact) => {
    const newStakeholder = {
      id: Date.now(),
      nome: contact.nome || contact.email.split('@')[0],
      email: contact.email,
      cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro'
    };
    const updatedStakeholders = [...(cliente.stakeholders || []), newStakeholder];
    try {
      await updateDoc(doc(db, 'clientes', clienteId), { stakeholders: updatedStakeholders });
      setCliente(prev => ({ ...prev, stakeholders: updatedStakeholders }));
      setSuggestedContacts(prev => prev.filter(c => c.email.toLowerCase() !== contact.email.toLowerCase()));
    } catch (error) {
      console.error('Erro ao adicionar contato:', error);
    }
  };

  const handleDismissSuggestion = (email) => {
    setDismissedSuggestions(prev => [...prev, email.toLowerCase()]);
    setSuggestedContacts(prev => prev.filter(c => c.email.toLowerCase() !== email.toLowerCase()));
  };

  return (
    <>
      {/* Usuarios */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <User style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Usuários</h2>
            <span style={{ padding: '4px 12px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
              {usuarios.length} {usuarios.length === 1 ? 'usuário' : 'usuários'}
            </span>
          </div>
        </div>

        {usuarios.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Nome</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Time</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Status</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Criado em</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Excluído em</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUsuarios.map((user, index) => (
                    <tr key={user.id || index} style={{ borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            background: user.deleted_at ? 'rgba(100, 116, 139, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {getInitials(user.nome || user.name)}
                          </div>
                          <span style={{ display: 'flex', alignItems: 'center', color: user.deleted_at ? '#64748b' : 'white', fontSize: '14px', fontWeight: '500' }}>
                            {user.nome || user.name || '-'}
                            {!user.deleted_at && <UserActivityDot status={getUserActivityStatus(user.email)} />}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: user.deleted_at ? '#64748b' : '#94a3b8', fontSize: '13px' }}>
                        {user.email || '-'}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '13px' }}>
                        {user.team_name || getTeamNameById(user.team_id)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          background: `${getUserStatusColor(user)}20`,
                          color: getUserStatusColor(user),
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {getUserStatusLabel(user)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                        {formatSimpleDate(user.created_at)}
                      </td>
                      <td style={{ padding: '14px 16px', color: user.deleted_at ? '#ef4444' : '#64748b', fontSize: '13px', textAlign: 'center' }}>
                        {user.deleted_at ? formatSimpleDate(user.deleted_at) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {usuarios.length > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <button
                  onClick={() => setShowAllUsuarios(!showAllUsuarios)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: '#a78bfa',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {showAllUsuarios ? 'Mostrar menos' : `Ver todos (${usuarios.length})`}
                  <ChevronDown style={{
                    width: '16px',
                    height: '16px',
                    transform: showAllUsuarios ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <User style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum usuário encontrado</p>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Os usuários dos times vinculados aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* Stakeholders Section */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Star style={{ width: '20px', height: '20px', color: '#f97316' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Stakeholders</h2>
            <span style={{ padding: '4px 12px', background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
              {(cliente?.stakeholders || []).length} {(cliente?.stakeholders || []).length === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ padding: '4px 10px', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', borderRadius: '8px', fontSize: '11px' }}>
              Contatos de vendas/contratos
            </span>
            {cliente?.stakeholders?.length > 0 && (
              <button
                onClick={() => {
                  const emails = cliente.stakeholders.map(s => s.email).filter(Boolean).join(', ');
                  navigator.clipboard.writeText(emails);
                  alert(`${cliente.stakeholders.filter(s => s.email).length} e-mail(s) copiado(s)!`);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px',
                  color: '#a78bfa', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
                }}
              >
                <Copy style={{ width: '14px', height: '14px' }} />
                Copiar e-mails
              </button>
            )}
            <button
              onClick={() => setShowStakeholderForm(!showStakeholderForm)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', background: 'rgba(249, 115, 22, 0.15)',
                border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '10px',
                color: '#fb923c', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
              }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              Adicionar
            </button>
          </div>
        </div>

        {/* Formulario inline para novo stakeholder */}
        {showStakeholderForm && (
          <div style={{ background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <input
                placeholder="Nome *"
                value={stakeholderForm.nome}
                onChange={e => setStakeholderForm(f => ({ ...f, nome: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <input
                placeholder="Email *"
                value={stakeholderForm.email}
                onChange={e => setStakeholderForm(f => ({ ...f, email: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <input
                placeholder="Cargo"
                value={stakeholderForm.cargo}
                onChange={e => setStakeholderForm(f => ({ ...f, cargo: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <input
                placeholder="Telefone"
                value={stakeholderForm.telefone}
                onChange={e => setStakeholderForm(f => ({ ...f, telefone: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <input
                placeholder="LinkedIn URL"
                value={stakeholderForm.linkedin_url}
                onChange={e => setStakeholderForm(f => ({ ...f, linkedin_url: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <select
                value={stakeholderForm.tipo_contato}
                onChange={e => setStakeholderForm(f => ({ ...f, tipo_contato: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              >
                {TIPOS_CONTATO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowStakeholderForm(false); setStakeholderForm({ nome: '', email: '', cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro' }); }}
                style={{ padding: '8px 16px', background: 'none', border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '10px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStakeholder}
                disabled={savingStakeholder}
                style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: savingStakeholder ? 0.6 : 1 }}
              >
                {savingStakeholder ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {cliente?.stakeholders && cliente.stakeholders.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {cliente.stakeholders.map((stakeholder, index) => {
            const tipoInfo = TIPOS_CONTATO.find(t => t.value === stakeholder.tipo_contato) || TIPOS_CONTATO[TIPOS_CONTATO.length - 1];
            return (
            <div
              key={stakeholder.id || index}
              style={{
                padding: '16px',
                background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(249, 115, 22, 0.15)',
                borderRadius: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px',
                  background: `linear-gradient(135deg, ${tipoInfo.color} 0%, ${tipoInfo.color}99 100%)`,
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '15px', fontWeight: '600', flexShrink: 0
                }}>
                  {getInitials(stakeholder.nome)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {stakeholder.nome}
                    </p>
                    {stakeholder.tipo_contato && stakeholder.tipo_contato !== 'outro' && (
                      <span style={{
                        padding: '2px 8px',
                        background: `${tipoInfo.color}20`,
                        color: tipoInfo.color,
                        borderRadius: '8px', fontSize: '10px', fontWeight: '600', flexShrink: 0
                      }}>
                        {tipoInfo.label}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteStakeholder(stakeholder.id, index)}
                      title="Remover stakeholder"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                        color: '#64748b', flexShrink: 0, display: 'flex', alignItems: 'center'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                  {stakeholder.cargo && (
                    <p style={{ color: '#f97316', fontSize: '12px', margin: '0 0 6px 0' }}>{stakeholder.cargo}</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <a href={`mailto:${stakeholder.email}`} style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Mail style={{ width: '12px', height: '12px' }} />{stakeholder.email}
                      </a>
                      <button
                        onClick={() => { navigator.clipboard.writeText(stakeholder.email); }}
                        title="Copiar e-mail"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748b', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#8b5cf6'}
                        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                      >
                        <Copy style={{ width: '12px', height: '12px' }} />
                      </button>
                    </div>
                    {stakeholder.telefone && (
                      <a href={`tel:${stakeholder.telefone}`} style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone style={{ width: '12px', height: '12px' }} />{stakeholder.telefone}
                      </a>
                    )}
                    {stakeholder.linkedin_url && (
                      <a href={stakeholder.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Linkedin style={{ width: '12px', height: '12px' }} />LinkedIn
                        <ExternalLink style={{ width: '10px', height: '10px' }} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <Star style={{ width: '32px', height: '32px', color: '#64748b', margin: '0 auto 8px' }} />
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Nenhum stakeholder cadastrado.</p>
            <button
              onClick={() => setShowStakeholderForm(true)}
              style={{
                marginTop: '12px', padding: '8px 16px',
                background: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.3)',
                borderRadius: '10px', color: '#fb923c', fontSize: '13px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />Adicionar primeiro stakeholder
            </button>
          </div>
        )}
      </div>

      {/* Contatos Sugeridos (extraidos das threads) */}
      {suggestedContacts.length > 0 && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sparkles style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Contatos Sugeridos</h2>
            <span style={{ padding: '4px 12px', background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
              {suggestedContacts.length}
            </span>
          </div>
          <span style={{ padding: '4px 10px', background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', borderRadius: '8px', fontSize: '11px' }}>
            Extraído das conversas
          </span>
        </div>
        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '12px', marginTop: 0 }}>
          Estas pessoas apareceram nas conversas deste cliente. Deseja adicioná-las como stakeholders?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {suggestedContacts.slice(0, 10).map((contact) => (
            <div key={contact.email} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)',
              border: '1px solid rgba(6, 182, 212, 0.1)', borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', background: 'rgba(6, 182, 212, 0.2)',
                  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#06b6d4', fontSize: '13px', fontWeight: '600'
                }}>
                  {getInitials(contact.nome || contact.email.split('@')[0])}
                </div>
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>
                    {contact.nome || contact.email.split('@')[0]}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>{contact.email}</span>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>
                      {contact.threadCount} {contact.threadCount === 1 ? 'conversa' : 'conversas'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleAddSuggestedContact(contact)}
                  style={{
                    padding: '6px 12px', background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px',
                    color: '#10b981', fontSize: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} />Adicionar
                </button>
                <button
                  onClick={() => handleDismissSuggestion(contact.email)}
                  style={{
                    padding: '6px 8px', background: 'none',
                    border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '8px',
                    color: '#64748b', fontSize: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center'
                  }}
                >
                  <X style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getUsuariosCountByTeam } from '../services/api';
import { ArrowLeft, Save, X, Search, Users, Building2, Check, AlertCircle, Plus, Trash2, UserCircle, Eye, EyeOff, Key, Pencil } from 'lucide-react';
import { STATUS_OPTIONS, DEFAULT_STATUS, getStatusColor, getStatusLabel } from '../utils/clienteStatus';
import { logAction } from '../utils/audit';
import { useAuth } from '../contexts/AuthContext';
import { AREAS_ATUACAO } from '../utils/areasAtuacao';
import { validateForm } from '../validation';
import { clienteSchema, stakeholderSchema } from '../validation/cliente';
import { ErrorMessage } from '../components/UI/ErrorMessage';

const TIPOS_CONTATO = [
  { value: 'decisor', label: 'Decisor', color: '#8b5cf6' },
  { value: 'operacional', label: 'Operacional', color: '#06b6d4' },
  { value: 'financeiro', label: 'Financeiro', color: '#10b981' },
  { value: 'tecnico', label: 'Técnico', color: '#f59e0b' },
  { value: 'time_google', label: 'Time Google', color: '#3b82f6' },
  { value: 'outro', label: 'Outro', color: '#64748b' }
];

const CATEGORIAS_PRODUTO = [
  { value: 'studio', label: 'Studio', usaPlatforma: true },
  { value: 'whitelabel', label: 'Whitelabel', usaPlatforma: false },
  { value: 'b2c', label: 'B2C', usaPlatforma: false },
  { value: 'bot', label: 'Bot', usaPlatforma: false },
  { value: 'servico_criativo', label: 'Serviço Criativo', usaPlatforma: false },
  { value: 'integracao', label: 'Integração', usaPlatforma: false }
];


export default function ClienteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [times, setTimes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [usuariosSistema, setUsuariosSistema] = useState([]);
  const [usuariosCount, setUsuariosCount] = useState({});

  // Form state
  const [nome, setNome] = useState('');
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [categoriasProduto, setCategoriasProduto] = useState(['studio']);
  const [responsaveis, setResponsaveis] = useState([]);
  const [timesSelecionados, setTimesSelecionados] = useState([]);
  const [timesOriginais, setTimesOriginais] = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [senhaPadrao, setSenhaPadrao] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [areaAtuacao, setAreaAtuacao] = useState('');
  const [tipoConta, setTipoConta] = useState('pagante');
  const [errors, setErrors] = useState({});

  // Filter state for teams
  const [searchTime, setSearchTime] = useState('');
  const [filterTeamType, setFilterTeamType] = useState('todos');

  // Modal states
  const [showStakeholderModal, setShowStakeholderModal] = useState(false);

  // New stakeholder form
  const [novoStakeholder, setNovoStakeholder] = useState({ nome: '', email: '', cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro' });
  const [editingStakeholderIndex, setEditingStakeholderIndex] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetches = [
          getDocs(collection(db, 'times')),
          getDocs(collection(db, 'clientes')),
          getDocs(collection(db, 'usuarios_sistema'))
        ];
        if (isEditing) fetches.push(getDoc(doc(db, 'clientes', id)));

        const results = await Promise.all(fetches);

        const timesData = results[0].docs.map(d => ({ id: d.id, ...d.data() }));
        setTimes(timesData);

        const teamIds = timesData.map(t => t.id);
        const counts = await getUsuariosCountByTeam(teamIds);
        setUsuariosCount(counts);

        const clientesData = results[1].docs.map(d => ({ id: d.id, ...d.data() }));
        setClientes(clientesData);

        const usuariosData = results[2].docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.ativo !== false)
          .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setUsuariosSistema(usuariosData);

        if (isEditing && results[3]?.exists()) {
          const data = results[3].data();
          setNome(data.nome || data.team_name || '');
          setStatus(data.status === 'onboarding' ? 'ativo' : (data.status || DEFAULT_STATUS));
          const produtosData = data.categorias_produto || (data.categoria_produto ? [data.categoria_produto] : ['studio']);
          setCategoriasProduto(Array.isArray(produtosData) ? produtosData : [produtosData]);
          setResponsaveis(data.responsaveis || (data.responsavel_email ? [{ email: data.responsavel_email, nome: data.responsavel_nome }] : []));
          setTimesSelecionados(data.times || []);
          setTimesOriginais(data.times || []);
          setStakeholders(data.stakeholders || []);
          setSenhaPadrao(data.senha_padrao || '');
          setAreaAtuacao(data.area_atuacao || '');
          setTipoConta(data.tipo_conta || 'pagante');
        }
      } catch (error) {
        // erro silenciado em produção
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEditing]);

  // Remove accents for search
  const removeAccents = (str) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  // Get client that owns a team
  const getClienteDoTime = (teamId) => {
    if (isEditing && timesOriginais.includes(teamId)) return null;
    const cliente = clientes.find(c => c.times?.includes(teamId) && c.id !== id);
    return cliente;
  };

  // Check if time is orphan (not linked to any client)
  const isOrphanTime = (teamId) => {
    // If editing and time belongs to current client, not orphan
    if (isEditing && timesOriginais.includes(teamId)) return false;
    // Check if any client has this team
    return !clientes.some(c => c.times?.includes(teamId));
  };

  // Get team types from selected teams
  const getTeamTypes = () => {
    const selectedTeams = times.filter(t => timesSelecionados.includes(t.id));
    const types = [...new Set(selectedTeams.map(t => t.team_type).filter(Boolean))];
    return types;
  };

  // Filter teams
  const teamTypes = [...new Set(times.map(t => t.team_type).filter(Boolean))];

  // Filter and sort teams: orphans first, then others, both alphabetically
  const filteredTimes = times
    .filter(time => {
      const searchNormalized = removeAccents(searchTime);
      const nameNormalized = removeAccents(time.team_name || '');
      const matchesSearch = nameNormalized.includes(searchNormalized);
      const matchesType = filterTeamType === 'todos' || time.team_type === filterTeamType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const aIsSelected = timesSelecionados.includes(a.id);
      const bIsSelected = timesSelecionados.includes(b.id);
      const aIsOrphan = isOrphanTime(a.id);
      const bIsOrphan = isOrphanTime(b.id);

      // Selected times first
      if (aIsSelected && !bIsSelected) return -1;
      if (!aIsSelected && bIsSelected) return 1;

      // Then orphan times
      if (aIsOrphan && !bIsOrphan) return -1;
      if (!aIsOrphan && bIsOrphan) return 1;

      // Then alphabetically
      return (a.team_name || '').localeCompare(b.team_name || '');
    });

  const toggleCategoriaProduto = (categoria) => {
    setCategoriasProduto(prev => {
      if (prev.includes(categoria)) {
        // Don't allow removing last category
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== categoria);
      }
      return [...prev, categoria];
    });
  };

  const toggleResponsavel = (resp) => {
    setResponsaveis(prev => {
      const exists = prev.find(r => r.email === resp.email);
      if (exists) {
        return prev.filter(r => r.email !== resp.email);
      }
      return [...prev, resp];
    });
  };

  const toggleTime = (teamId) => {
    const clienteDoTime = getClienteDoTime(teamId);
    if (clienteDoTime) return;

    setTimesSelecionados(prev =>
      prev.includes(teamId) ? prev.filter(t => t !== teamId) : [...prev, teamId]
    );
  };

  const saveStakeholder = () => {
    const validationErrors = validateForm(stakeholderSchema, novoStakeholder);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    if (editingStakeholderIndex !== null) {
      setStakeholders(prev => prev.map((st, idx) =>
        idx === editingStakeholderIndex ? { ...st, ...novoStakeholder } : st
      ));
      setEditingStakeholderIndex(null);
    } else {
      setStakeholders(prev => [...prev, { ...novoStakeholder, id: Date.now() }]);
    }
    setNovoStakeholder({ nome: '', email: '', cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro' });
    setShowStakeholderModal(false);
  };

  const editStakeholder = (index) => {
    const st = stakeholders[index];
    setNovoStakeholder({
      nome: st.nome || '',
      email: st.email || '',
      cargo: st.cargo || '',
      telefone: st.telefone || '',
      linkedin_url: st.linkedin_url || '',
      tipo_contato: st.tipo_contato || 'outro'
    });
    setEditingStakeholderIndex(index);
    setShowStakeholderModal(true);
  };

  const removeStakeholder = (index) => {
    setStakeholders(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Montar dados para validação
    const formData = {
      nome: nome.trim(),
      status,
      categorias_produto: categoriasProduto,
      responsaveis,
      times: timesSelecionados,
      team_type: getTeamTypes().join(', '),
      stakeholders,
      senha_padrao: senhaPadrao,
      area_atuacao: areaAtuacao || null,
      tipo_conta: tipoConta
    };

    const validationErrors = validateForm(clienteSchema, formData);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    // Verificar se já existe cliente com mesmo nome
    const nomeNormalizado = nome.trim().toLowerCase();
    const clienteDuplicado = clientes.find(c => {
      const nomeCliente = (c.nome || c.team_name || '').toLowerCase();
      if (isEditing && c.id === id) return false;
      return nomeCliente === nomeNormalizado;
    });

    if (clienteDuplicado) {
      setErrors({ nome: `Já existe um cliente com o nome "${clienteDuplicado.nome || clienteDuplicado.team_name}"` });
      return;
    }

    setSaving(true);
    try {
      const teamTypesArray = getTeamTypes();
      // Check if any selected product uses platform metrics
      const usaPlataforma = categoriasProduto.some(cat => {
        const catInfo = CATEGORIAS_PRODUTO.find(c => c.value === cat);
        return catInfo?.usaPlatforma || false;
      });
      const clienteData = {
        nome: nome.trim(),
        team_name: nome.trim(),
        status,
        categorias_produto: categoriasProduto,
        categoria_produto: categoriasProduto[0],
        usa_metricas_plataforma: usaPlataforma,
        responsaveis,
        responsavel_email: responsaveis[0]?.email || '',
        responsavel_nome: responsaveis[0]?.nome || '',
        times: timesSelecionados,
        team_types: teamTypesArray,
        team_type: teamTypesArray.length === 1 ? teamTypesArray[0] : teamTypesArray.join(', '),
        stakeholders,
        senha_padrao: senhaPadrao,
        area_atuacao: areaAtuacao || null,
        tipo_conta: tipoConta,
        updated_at: serverTimestamp()
      };

      if (isEditing) {
        await updateDoc(doc(db, 'clientes', id), clienteData);

        // Update times em paralelo
        const timesRemovidos = timesOriginais.filter(t => !timesSelecionados.includes(t));
        const timesAdicionados = timesSelecionados.filter(t => !timesOriginais.includes(t));
        const timesUpdates = [
          ...timesRemovidos.map(teamId =>
            updateDoc(doc(db, 'times', teamId), { cliente_id: null }).catch(() => {})
          ),
          ...timesAdicionados.map(teamId =>
            updateDoc(doc(db, 'times', teamId), { cliente_id: id }).catch(() => {})
          )
        ];
        await Promise.all(timesUpdates);

        await logAction('update', 'cliente', id, nome, {
          status: { old: null, new: status },
          responsaveis: { old: null, new: responsaveis.map(r => r.nome).join(', ') }
        }, { email: user?.email, name: user?.email?.split('@')[0] });
      } else {
        const newClientRef = doc(collection(db, 'clientes'));
        clienteData.created_at = serverTimestamp();
        clienteData.segmento_cs = 'ESTAVEL';
        await setDoc(newClientRef, clienteData);

        // Update times em paralelo
        await Promise.all(
          timesSelecionados.map(teamId =>
            updateDoc(doc(db, 'times', teamId), { cliente_id: newClientRef.id }).catch(() => {})
          )
        );

        await logAction('create', 'cliente', newClientRef.id, nome, {}, { email: user?.email, name: user?.email?.split('@')[0] });
      }

      navigate('/clientes');
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      alert('Erro ao salvar cliente. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  const currentTeamTypes = getTeamTypes();

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button
          onClick={() => navigate('/clientes')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
          Voltar para Clientes
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>
          {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
        </h1>
        <p style={{ color: '#94a3b8', margin: 0 }}>
          {isEditing ? 'Atualize as informações do cliente' : 'Preencha as informações para cadastrar um novo cliente'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Nome e Team Type */}
            <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '24px' }}>
              <h2 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Informações Básicas</h2>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Digite o nome do cliente"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: errors.nome ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <ErrorMessage error={errors.nome} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Status do Cliente
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      style={{
                        padding: '8px 16px',
                        background: status === opt.value ? `${opt.color}30` : 'rgba(15, 10, 31, 0.6)',
                        border: status === opt.value ? `2px solid ${opt.color}` : '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '20px',
                        color: status === opt.value ? opt.color : '#94a3b8',
                        fontSize: '13px',
                        fontWeight: status === opt.value ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: opt.color
                      }}></span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categorias de Produto (múltipla seleção) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Categorias de Produto
                  {categoriasProduto.length > 0 && (
                    <span style={{ marginLeft: '8px', padding: '2px 8px', background: 'rgba(124, 58, 237, 0.3)', borderRadius: '10px', fontSize: '11px', color: '#a78bfa' }}>
                      {categoriasProduto.length}
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {CATEGORIAS_PRODUTO.map(cat => {
                    const isSelected = categoriasProduto.includes(cat.value);
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => toggleCategoriaProduto(cat.value)}
                        style={{
                          padding: '8px 16px',
                          background: isSelected ? 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)' : 'rgba(15, 10, 31, 0.6)',
                          border: isSelected ? 'none' : '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '20px',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: isSelected ? '600' : '400',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isSelected && <Check style={{ width: '14px', height: '14px', marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />}
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                <ErrorMessage error={errors.categorias_produto} />
                {categoriasProduto.length > 0 && (
                  <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>
                    {categoriasProduto.some(cat => CATEGORIAS_PRODUTO.find(c => c.value === cat)?.usaPlatforma)
                      ? '✓ Usa métricas da plataforma na Saúde CS'
                      : '○ Não usa métricas da plataforma na Saúde CS'}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Área de Atuação
                </label>
                <select
                  value={areaAtuacao}
                  onChange={(e) => setAreaAtuacao(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: areaAtuacao ? 'white' : '#64748b',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="" style={{ background: '#1e1b4b', color: '#64748b' }}>Selecione a área...</option>
                  {AREAS_ATUACAO.map(area => (
                    <option key={area.value} value={area.value} style={{ background: '#1e1b4b', color: 'white' }}>
                      {area.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Conta */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Tipo de Conta
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[{ value: 'pagante', label: 'Pagante' }, { value: 'google_gratuito', label: 'Google Gratuito' }].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTipoConta(opt.value)}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        background: tipoConta === opt.value ? 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)' : 'rgba(15, 10, 31, 0.6)',
                        border: tipoConta === opt.value ? 'none' : '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: tipoConta === opt.value ? '600' : '400',
                        cursor: 'pointer'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Team Type (automático)
                </label>
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: '12px',
                  color: currentTeamTypes.length > 0 ? 'white' : '#64748b',
                  fontSize: '14px'
                }}>
                  {currentTeamTypes.length > 0 ? currentTeamTypes.join(', ') : 'Selecione times para definir o tipo'}
                </div>
              </div>
            </div>

            {/* Responsáveis */}
            <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '24px' }}>
              <h2 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>
                Responsáveis
                {responsaveis.length > 0 && (
                  <span style={{ marginLeft: '8px', padding: '2px 8px', background: 'rgba(124, 58, 237, 0.3)', borderRadius: '10px', fontSize: '12px', color: '#a78bfa' }}>
                    {responsaveis.length}
                  </span>
                )}
              </h2>
              {usuariosSistema.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {usuariosSistema.map(usuario => {
                    const isSelected = responsaveis.some(r => r.email === usuario.email);
                    return (
                      <button
                        key={usuario.email}
                        type="button"
                        onClick={() => toggleResponsavel({ email: usuario.email, nome: usuario.nome })}
                        style={{
                          padding: '8px 16px',
                          background: isSelected ? 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)' : 'rgba(15, 10, 31, 0.6)',
                          border: isSelected ? 'none' : '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: '20px',
                          color: 'white',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isSelected && <Check style={{ width: '14px', height: '14px', marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />}
                        {usuario.nome}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                  Nenhum usuário cadastrado no sistema. Cadastre usuários em Configurações → Usuários.
                </p>
              )}
            </div>

            {/* Stakeholders */}
            <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                  Stakeholders (Pessoas Chave)
                  {stakeholders.length > 0 && (
                    <span style={{ marginLeft: '8px', padding: '2px 8px', background: 'rgba(124, 58, 237, 0.3)', borderRadius: '10px', fontSize: '12px', color: '#a78bfa' }}>
                      {stakeholders.length}
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowStakeholderModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    color: '#a78bfa',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} />
                  Adicionar
                </button>
              </div>

              {stakeholders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stakeholders.map((st, idx) => (
                    <div key={st.id || idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'rgba(15, 10, 31, 0.6)',
                      border: '1px solid rgba(139, 92, 246, 0.1)',
                      borderRadius: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          background: 'rgba(139, 92, 246, 0.2)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <UserCircle style={{ width: '20px', height: '20px', color: '#a78bfa' }} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>{st.nome}</p>
                            {st.tipo_contato && st.tipo_contato !== 'outro' && (
                              <span style={{
                                padding: '2px 8px',
                                background: `${(TIPOS_CONTATO.find(t => t.value === st.tipo_contato)?.color || '#64748b')}20`,
                                color: TIPOS_CONTATO.find(t => t.value === st.tipo_contato)?.color || '#64748b',
                                borderRadius: '8px', fontSize: '10px', fontWeight: '500'
                              }}>
                                {TIPOS_CONTATO.find(t => t.value === st.tipo_contato)?.label || st.tipo_contato}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>{st.cargo || 'Sem cargo'}</span>
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>{st.email}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => editStakeholder(idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        >
                          <Pencil style={{ width: '16px', height: '16px', color: '#94a3b8' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStakeholder(idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                  Nenhum stakeholder cadastrado
                </p>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Times */}
            <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                    Times Vinculados
                    {timesSelecionados.length > 0 && (
                      <span style={{ marginLeft: '8px', padding: '2px 8px', background: 'rgba(124, 58, 237, 0.3)', borderRadius: '10px', fontSize: '12px', color: '#a78bfa' }}>
                        {timesSelecionados.length}
                      </span>
                    )}
                  </h2>
                  {times.filter(t => isOrphanTime(t.id)).length > 0 && (
                    <span style={{ padding: '4px 10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#10b981', fontSize: '11px', fontWeight: '500' }}>
                      {times.filter(t => isOrphanTime(t.id)).length} disponíveis
                    </span>
                  )}
                </div>
              </div>

              {/* Search and Filter */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                  <input
                    type="text"
                    value={searchTime}
                    onChange={(e) => setSearchTime(e.target.value)}
                    placeholder="Buscar time..."
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      background: '#0f0a1f',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <select
                  value={filterTeamType}
                  onChange={(e) => setFilterTeamType(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer',
                    minWidth: '140px'
                  }}
                >
                  <option value="todos" style={{ background: '#1e1b4b' }}>Todos os tipos</option>
                  {teamTypes.map(type => (
                    <option key={type} value={type} style={{ background: '#1e1b4b' }}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Teams List */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredTimes.length > 0 ? filteredTimes.map(time => {
                  const clienteDoTime = getClienteDoTime(time.id);
                  const isSelected = timesSelecionados.includes(time.id);
                  const isDisabled = Boolean(clienteDoTime);
                  const isOrphan = isOrphanTime(time.id);

                  return (
                    <div
                      key={time.id}
                      onClick={() => !isDisabled && toggleTime(time.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: isSelected
                          ? 'rgba(124, 58, 237, 0.2)'
                          : isOrphan
                            ? 'rgba(16, 185, 129, 0.08)'
                            : 'rgba(15, 10, 31, 0.6)',
                        border: isSelected
                          ? '1px solid rgba(124, 58, 237, 0.5)'
                          : isOrphan
                            ? '1px solid rgba(16, 185, 129, 0.25)'
                            : '1px solid rgba(139, 92, 246, 0.1)',
                        borderRadius: '12px',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: isSelected
                            ? 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)'
                            : isOrphan
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(139, 92, 246, 0.2)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected ? (
                            <Check style={{ width: '16px', height: '16px', color: 'white' }} />
                          ) : (
                            <Building2 style={{ width: '16px', height: '16px', color: isOrphan ? '#10b981' : '#a78bfa' }} />
                          )}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0 }}>
                              {time.team_name}
                            </p>
                            {isOrphan && !isSelected && (
                              <span style={{
                                padding: '2px 6px',
                                background: 'rgba(16, 185, 129, 0.2)',
                                color: '#10b981',
                                fontSize: '9px',
                                fontWeight: '600',
                                borderRadius: '4px',
                                textTransform: 'uppercase'
                              }}>
                                Disponível
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>{time.team_type || 'Sem tipo'}</span>
                            {isDisabled && (
                              <span style={{ color: '#ef4444', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertCircle style={{ width: '10px', height: '10px' }} />
                                Vinculado a {clienteDoTime.nome || clienteDoTime.team_name} — desvincule primeiro
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '11px' }}>
                        <Users style={{ width: '12px', height: '12px' }} />
                        {usuariosCount[time.id] || 0}
                      </div>
                    </div>
                  );
                }) : (
                  <div style={{ padding: '24px', textAlign: 'center' }}>
                    <Building2 style={{ width: '32px', height: '32px', color: '#64748b', margin: '0 auto 8px' }} />
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Nenhum time encontrado</p>
                  </div>
                )}
              </div>
            </div>

            {/* Senha Padrão @trakto */}
            <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Key style={{ width: '18px', height: '18px', color: '#f59e0b' }} />
                <h2 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                  Senha Padrão (@trakto)
                </h2>
              </div>
              <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '12px' }}>
                Senha de acesso do usuário @trakto na plataforma do cliente
              </p>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senhaPadrao}
                  onChange={(e) => setSenhaPadrao(e.target.value)}
                  placeholder="Digite a senha padrão"
                  style={{
                    width: '100%',
                    padding: '12px 48px 12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showSenha ? (
                    <EyeOff style={{ width: '18px', height: '18px', color: '#64748b' }} />
                  ) : (
                    <Eye style={{ width: '18px', height: '18px', color: '#64748b' }} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button
            type="button"
            onClick={() => navigate('/clientes')}
            style={{
              padding: '12px 24px',
              background: 'rgba(15, 10, 31, 0.6)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              color: '#94a3b8',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <X style={{ width: '18px', height: '18px' }} />
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: saving ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: saving ? 0.7 : 1
            }}
          >
            <Save style={{ width: '18px', height: '18px' }} />
            {saving ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Criar Cliente')}
          </button>
        </div>
      </form>

      {/* Modal Stakeholder */}
      {showStakeholderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', width: '100%', maxWidth: '450px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>{editingStakeholderIndex !== null ? 'Editar Stakeholder' : 'Adicionar Stakeholder'}</h3>
              <button onClick={() => { setShowStakeholderModal(false); setEditingStakeholderIndex(null); setErrors({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X style={{ width: '20px', height: '20px', color: '#64748b' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Nome *</label>
                <input
                  type="text"
                  value={novoStakeholder.nome}
                  onChange={(e) => setNovoStakeholder(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome completo"
                  style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: errors.nome ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                <ErrorMessage error={errors.nome} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Email *</label>
                <input
                  type="email"
                  value={novoStakeholder.email}
                  onChange={(e) => setNovoStakeholder(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@empresa.com"
                  style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: errors.email ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                <ErrorMessage error={errors.email} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Cargo</label>
                <input
                  type="text"
                  value={novoStakeholder.cargo}
                  onChange={(e) => setNovoStakeholder(prev => ({ ...prev, cargo: e.target.value }))}
                  placeholder="Ex: Gerente de Marketing"
                  style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Telefone</label>
                <input
                  type="text"
                  value={novoStakeholder.telefone}
                  onChange={(e) => setNovoStakeholder(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>LinkedIn</label>
                <input
                  type="url"
                  value={novoStakeholder.linkedin_url}
                  onChange={(e) => setNovoStakeholder(prev => ({ ...prev, linkedin_url: e.target.value }))}
                  placeholder="https://linkedin.com/in/nome"
                  style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: errors.linkedin_url ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                <ErrorMessage error={errors.linkedin_url} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '6px' }}>Tipo de Contato</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {TIPOS_CONTATO.map(tipo => (
                    <button
                      key={tipo.value}
                      type="button"
                      onClick={() => setNovoStakeholder(prev => ({ ...prev, tipo_contato: tipo.value }))}
                      style={{
                        padding: '6px 12px',
                        background: novoStakeholder.tipo_contato === tipo.value ? `${tipo.color}30` : 'rgba(15, 10, 31, 0.6)',
                        border: novoStakeholder.tipo_contato === tipo.value ? `2px solid ${tipo.color}` : '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '16px',
                        color: novoStakeholder.tipo_contato === tipo.value ? tipo.color : '#94a3b8',
                        fontSize: '12px',
                        fontWeight: novoStakeholder.tipo_contato === tipo.value ? '600' : '400',
                        cursor: 'pointer'
                      }}
                    >
                      {tipo.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => { setShowStakeholderModal(false); setEditingStakeholderIndex(null); setErrors({}); }}
                style={{ padding: '10px 20px', background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveStakeholder}
                style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                {editingStakeholderIndex !== null ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

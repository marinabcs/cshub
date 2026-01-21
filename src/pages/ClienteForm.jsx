import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Save, X, Search, Users, Building2, Check, AlertCircle } from 'lucide-react';

const TAGS_DISPONIVEIS = [
  'Enterprise',
  'Educação',
  'Varejo',
  'Fintech',
  'Saúde',
  'Tecnologia',
  'Agência',
  'E-commerce',
  'Startup',
  'Governo'
];

const RESPONSAVEIS = [
  { email: 'marina@trakto.io', nome: 'Marina' },
  { email: 'joao@trakto.io', nome: 'João' },
  { email: 'ana@trakto.io', nome: 'Ana' },
  { email: 'pedro@trakto.io', nome: 'Pedro' },
  { email: 'carla@trakto.io', nome: 'Carla' },
  { email: 'lucas@trakto.io', nome: 'Lucas' }
];

export default function ClienteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [times, setTimes] = useState([]);
  const [clientes, setClientes] = useState([]);

  // Form state
  const [nome, setNome] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [tags, setTags] = useState([]);
  const [timesSelecionados, setTimesSelecionados] = useState([]);
  const [timesOriginais, setTimesOriginais] = useState([]);

  // Filter state for teams
  const [searchTime, setSearchTime] = useState('');
  const [filterTeamType, setFilterTeamType] = useState('todos');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all teams
        const timesSnap = await getDocs(collection(db, 'times'));
        const timesData = timesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTimes(timesData);

        // Fetch all clients to check team assignments
        const clientesSnap = await getDocs(collection(db, 'clientes'));
        const clientesData = clientesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setClientes(clientesData);

        // If editing, fetch client data
        if (isEditing) {
          const clienteDoc = await getDoc(doc(db, 'clientes', id));
          if (clienteDoc.exists()) {
            const data = clienteDoc.data();
            setNome(data.nome || data.team_name || '');
            setResponsavel(data.responsavel_email || '');
            setTags(data.tags || []);
            setTimesSelecionados(data.times || []);
            setTimesOriginais(data.times || []);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
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

  // Filter teams
  const teamTypes = [...new Set(times.map(t => t.team_type).filter(Boolean))];

  const filteredTimes = times.filter(time => {
    const searchNormalized = removeAccents(searchTime);
    const nameNormalized = removeAccents(time.team_name || '');
    const matchesSearch = nameNormalized.includes(searchNormalized);
    const matchesType = filterTeamType === 'todos' || time.team_type === filterTeamType;
    return matchesSearch && matchesType;
  });

  const toggleTag = (tag) => {
    setTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleTime = (teamId) => {
    const clienteDoTime = getClienteDoTime(teamId);
    if (clienteDoTime) return; // Team already assigned to another client

    setTimesSelecionados(prev =>
      prev.includes(teamId) ? prev.filter(t => t !== teamId) : [...prev, teamId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Por favor, informe o nome do cliente');
      return;
    }

    setSaving(true);
    try {
      const responsavelData = RESPONSAVEIS.find(r => r.email === responsavel);
      const clienteData = {
        nome: nome.trim(),
        team_name: nome.trim(),
        responsavel_email: responsavel,
        responsavel_nome: responsavelData?.nome || '',
        tags,
        times: timesSelecionados,
        updated_at: new Date()
      };

      if (isEditing) {
        await updateDoc(doc(db, 'clientes', id), clienteData);

        // Update times that were removed
        const timesRemovidos = timesOriginais.filter(t => !timesSelecionados.includes(t));
        for (const teamId of timesRemovidos) {
          await updateDoc(doc(db, 'times', teamId), { cliente_id: null });
        }

        // Update times that were added
        const timesAdicionados = timesSelecionados.filter(t => !timesOriginais.includes(t));
        for (const teamId of timesAdicionados) {
          await updateDoc(doc(db, 'times', teamId), { cliente_id: id });
        }
      } else {
        // Create new client
        const newClientRef = doc(collection(db, 'clientes'));
        clienteData.created_at = new Date();
        clienteData.health_score = 100;
        clienteData.health_status = 'saudavel';
        await setDoc(newClientRef, clienteData);

        // Update times with new client ID
        for (const teamId of timesSelecionados) {
          await updateDoc(doc(db, 'times', teamId), { cliente_id: newClientRef.id });
        }
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
          {/* Left Column - Basic Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Nome */}
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
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Responsável
                </label>
                <select
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="" style={{ background: '#1e1b4b' }}>Selecione um responsável</option>
                  {RESPONSAVEIS.map(r => (
                    <option key={r.email} value={r.email} style={{ background: '#1e1b4b' }}>
                      {r.nome} ({r.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '24px' }}>
              <h2 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Tags</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {TAGS_DISPONIVEIS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '8px 16px',
                      background: tags.includes(tag) ? 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)' : 'rgba(15, 10, 31, 0.6)',
                      border: tags.includes(tag) ? 'none' : '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '20px',
                      color: 'white',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tags.includes(tag) && <Check style={{ width: '14px', height: '14px', marginRight: '6px', display: 'inline', verticalAlign: 'middle' }} />}
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Times */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                Times Vinculados
                {timesSelecionados.length > 0 && (
                  <span style={{ marginLeft: '8px', padding: '2px 8px', background: 'rgba(124, 58, 237, 0.3)', borderRadius: '10px', fontSize: '12px', color: '#a78bfa' }}>
                    {timesSelecionados.length} selecionado{timesSelecionados.length > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
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
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTimes.length > 0 ? filteredTimes.map(time => {
                const clienteDoTime = getClienteDoTime(time.id);
                const isSelected = timesSelecionados.includes(time.id);
                const isDisabled = Boolean(clienteDoTime);

                return (
                  <div
                    key={time.id}
                    onClick={() => !isDisabled && toggleTime(time.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: isSelected ? 'rgba(124, 58, 237, 0.2)' : 'rgba(15, 10, 31, 0.6)',
                      border: isSelected ? '1px solid rgba(124, 58, 237, 0.5)' : '1px solid rgba(139, 92, 246, 0.1)',
                      borderRadius: '12px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        background: isSelected ? 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)' : 'rgba(139, 92, 246, 0.2)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isSelected ? (
                          <Check style={{ width: '18px', height: '18px', color: 'white' }} />
                        ) : (
                          <Building2 style={{ width: '18px', height: '18px', color: '#a78bfa' }} />
                        )}
                      </div>
                      <div>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>
                          {time.team_name}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontSize: '12px' }}>{time.team_type || 'Sem tipo'}</span>
                          {isDisabled && (
                            <span style={{ color: '#f59e0b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle style={{ width: '12px', height: '12px' }} />
                              Vinculado a: {clienteDoTime.nome || clienteDoTime.team_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
                        <Users style={{ width: '14px', height: '14px' }} />
                        {time.total_usuarios || 0}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <Building2 style={{ width: '40px', height: '40px', color: '#64748b', margin: '0 auto 12px' }} />
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Nenhum time encontrado</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
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
    </div>
  );
}

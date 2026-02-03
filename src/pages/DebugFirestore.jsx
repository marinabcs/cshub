import { useState } from 'react';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, RefreshCw, Search, Wrench } from 'lucide-react';
import { migrarClientes } from '../utils/seedData';

export default function DebugFirestore() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  // Metrics debug state
  const [metricsDebugClienteId, setMetricsDebugClienteId] = useState('');
  const [metricsDebugLoading, setMetricsDebugLoading] = useState(false);
  const [metricsDebugResults, setMetricsDebugResults] = useState(null);

  // Migration state
  const [migrating, setMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState(null);

  const runCheck = async () => {
    setLoading(true);
    const output = {
      timestamp: new Date().toISOString(),
      user: user?.email,
      collections: {}
    };

    const collectionsToCheck = ['clientes', 'times', 'usuarios_lookup', 'metricas_diarias', 'config'];

    for (const collName of collectionsToCheck) {
      try {
        const collSnap = await getDocs(collection(db, collName));
        output.collections[collName] = {
          total: collSnap.size,
          sample: collSnap.docs.slice(0, 2).map(d => ({
            id: d.id,
            campos: Object.keys(d.data())
          }))
        };
      } catch (e) {
        output.collections[collName] = { error: e.message };
      }
    }

    setResults(output);
    setLoading(false);
  };

  // Run migration
  const runMigration = async () => {
    setMigrating(true);
    setMigrationResults(null);
    try {
      const results = await migrarClientes();
      setMigrationResults(results);
    } catch (err) {
      setMigrationResults({ errors: [err.message] });
    }
    setMigrating(false);
  };

  // Debug metrics for a specific client
  const debugClienteMetrics = async () => {
    if (!metricsDebugClienteId.trim()) {
      alert('Digite o ID do cliente');
      return;
    }

    setMetricsDebugLoading(true);
    setMetricsDebugResults(null);

    const results = {
      clienteId: metricsDebugClienteId.trim(),
      cliente: null,
      metricas: [],
      aggregated: { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 },
      errors: []
    };

    try {
      // 1. Get cliente data
      const clienteRef = doc(db, 'clientes', metricsDebugClienteId.trim());
      const clienteSnap = await getDoc(clienteRef);

      if (!clienteSnap.exists()) {
        results.errors.push('Cliente não encontrado');
        setMetricsDebugResults(results);
        setMetricsDebugLoading(false);
        return;
      }

      const clienteData = clienteSnap.data();
      results.cliente = {
        id: clienteSnap.id,
        team_name: clienteData.team_name,
        times: clienteData.times || [],
        status: clienteData.status
      };

      const teamIds = clienteData.times || [];
      console.log('[debugClienteMetrics] Cliente:', results.cliente);
      console.log('[debugClienteMetrics] Team IDs:', teamIds);

      if (teamIds.length === 0) {
        results.errors.push('Cliente não tem times vinculados');
        setMetricsDebugResults(results);
        setMetricsDebugLoading(false);
        return;
      }

      // 2. Buscar métricas de metricas_diarias
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      console.log('[debugClienteMetrics] Buscando metricas_diarias...');
      console.log('[debugClienteMetrics] Data mínima:', thirtyDaysAgo);

      const metricasRef = collection(db, 'metricas_diarias');
      let allMetricas = [];

      const chunkSize = 10;
      for (let i = 0; i < teamIds.length; i += chunkSize) {
        const chunk = teamIds.slice(i, i + chunkSize);
        const q = query(
          metricasRef,
          where('team_id', 'in', chunk),
          where('data', '>=', thirtyDaysAgo)
        );
        const snapshot = await getDocs(q);
        console.log(`[debugClienteMetrics] Chunk ${i}: ${snapshot.docs.length} docs`);
        allMetricas.push(...snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }

      console.log(`[debugClienteMetrics] Total: ${allMetricas.length} documentos`);

      // Agregar
      allMetricas.forEach(d => {
        results.aggregated.logins += (d.logins || 0);
        results.aggregated.pecas_criadas += (d.pecas_criadas || 0);
        results.aggregated.downloads += (d.downloads || 0);
        results.aggregated.uso_ai_total += (d.uso_ai_total || 0);

        results.metricas.push({
          id: d.id,
          team_id: d.team_id,
          data: d.data,
          logins: d.logins || 0,
          pecas_criadas: d.pecas_criadas || 0,
          downloads: d.downloads || 0,
          uso_ai_total: d.uso_ai_total || 0
        });
      });

      console.log('[debugClienteMetrics] Agregado:', results.aggregated);
      setMetricsDebugResults(results);
    } catch (err) {
      console.error('[debugClienteMetrics] Erro:', err);
      results.errors.push(`Erro: ${err.message}`);
      setMetricsDebugResults(results);
    }

    setMetricsDebugLoading(false);
  };

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>Debug Firestore</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>Verificação de collections e métricas</p>
          </div>
        </div>

        <button
          onClick={runCheck}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: loading ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          <RefreshCw style={{ width: '18px', height: '18px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Verificando...' : 'Verificar Collections'}
        </button>
      </div>

      {/* Verification Results */}
      {results && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h2 style={{ color: 'white', fontSize: '18px', margin: '0 0 16px 0' }}>Contagem de Documentos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {Object.entries(results.collections).map(([name, data]) => (
              <div
                key={name}
                style={{
                  padding: '16px',
                  background: data.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${data.error ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                  borderRadius: '12px'
                }}
              >
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>{name}</p>
                <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                  {data.error ? 'Erro' : data.total}
                </p>
                {data.error && (
                  <span style={{ color: '#ef4444', fontSize: '10px' }}>{data.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Migration Section */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(249, 115, 22, 0.3)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Wrench style={{ width: '20px', height: '20px', color: '#f97316' }} />
            <div>
              <h2 style={{ color: 'white', fontSize: '18px', margin: 0 }}>Migração de Dados</h2>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>
                Adiciona campo 'times' nos clientes que não têm (baseado no team_id)
              </p>
            </div>
          </div>
          <button
            onClick={runMigration}
            disabled={migrating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: migrating ? 'rgba(249, 115, 22, 0.5)' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: migrating ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            <Wrench style={{ width: '18px', height: '18px', animation: migrating ? 'spin 1s linear infinite' : 'none' }} />
            {migrating ? 'Migrando...' : 'Executar Migração'}
          </button>
        </div>

        {migrationResults && (
          <div style={{ padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px' }}>
            {migrationResults.errors && migrationResults.errors.length > 0 ? (
              <div style={{ color: '#ef4444', marginBottom: '12px' }}>
                {migrationResults.errors.map((err, i) => (
                  <p key={i} style={{ margin: '4px 0' }}>{err}</p>
                ))}
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px' }}>
                <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Clientes Atualizados</p>
                <p style={{ color: '#10b981', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                  {migrationResults.clientes_atualizados || 0}
                </p>
              </div>
              <div style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '8px' }}>
                <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Clientes Já OK</p>
                <p style={{ color: '#06b6d4', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                  {migrationResults.clientes_ja_ok || 0}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Debug Metrics Section */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Search style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', margin: 0 }}>Debug Métricas de Cliente</h2>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <input
            type="text"
            value={metricsDebugClienteId}
            onChange={(e) => setMetricsDebugClienteId(e.target.value)}
            placeholder="ID do cliente (ex: abc123...)"
            style={{
              flex: 1,
              padding: '12px 16px',
              background: '#0f0a1f',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button
            onClick={debugClienteMetrics}
            disabled={metricsDebugLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: metricsDebugLoading ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: metricsDebugLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            <Search style={{ width: '16px', height: '16px', animation: metricsDebugLoading ? 'spin 1s linear infinite' : 'none' }} />
            {metricsDebugLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {metricsDebugResults && (
          <div style={{ padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px' }}>
            {metricsDebugResults.errors.length > 0 ? (
              <div style={{ color: '#ef4444', marginBottom: '12px' }}>
                {metricsDebugResults.errors.map((err, i) => (
                  <p key={i} style={{ margin: '4px 0' }}>{err}</p>
                ))}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>Cliente</p>
                  <p style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                    {metricsDebugResults.cliente?.team_name}
                  </p>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>
                    Times: {metricsDebugResults.cliente?.times?.join(', ') || 'Nenhum'}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px 0' }}>
                    Documentos encontrados em metricas_diarias: <strong style={{ color: 'white' }}>{metricsDebugResults.metricas.length}</strong>
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Logins</p>
                    <p style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                      {metricsDebugResults.aggregated.logins}
                    </p>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '8px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Peças</p>
                    <p style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                      {metricsDebugResults.aggregated.pecas_criadas}
                    </p>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Downloads</p>
                    <p style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                      {metricsDebugResults.aggregated.downloads}
                    </p>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '8px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Uso AI</p>
                    <p style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
                      {metricsDebugResults.aggregated.uso_ai_total}
                    </p>
                  </div>
                </div>

                {metricsDebugResults.metricas.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px 0' }}>Primeiros 5 documentos:</p>
                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', maxHeight: '150px', overflow: 'auto' }}>
                      {metricsDebugResults.metricas.slice(0, 5).map((m, i) => (
                        <div key={i} style={{ marginBottom: '4px' }}>
                          {m.id} | team: {m.team_id} | logins: {m.logins} | pecas: {m.pecas_criadas}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

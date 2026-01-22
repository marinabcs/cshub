import { useState, useEffect } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, RefreshCw, Copy, Check } from 'lucide-react';

export default function DebugFirestore() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    const output = {
      timestamp: new Date().toISOString(),
      user: user?.email,
      collections: {}
    };

    // 1. Check clientes
    try {
      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const clientes = clientesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      output.collections.clientes = {
        total: clientes.length,
        sample: clientes.slice(0, 3).map(c => ({
          id: c.id,
          campos: Object.keys(c),
          team_name: c.team_name,
          times: c.times,
          team_type: c.team_type,
          health_score: c.health_score,
          responsavel_nome: c.responsavel_nome
        })),
        allNames: clientes.map(c => ({ id: c.id, name: c.team_name }))
      };
    } catch (e) {
      output.collections.clientes = { error: e.message };
    }

    // 2. Check usuarios_lookup
    try {
      const usersSnap = await getDocs(collection(db, 'usuarios_lookup'));
      const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Count domains
      const domains = {};
      users.forEach(u => {
        const domain = (u.email || '').split('@')[1] || 'unknown';
        domains[domain] = (domains[domain] || 0) + 1;
      });

      // Check specific domains
      const targetDomains = ['stone.com.br', 'omc.com', 'inter.co', 'obramax.com.br', 'unisa.br', 'trakto.io'];
      const targetDomainsCount = {};
      targetDomains.forEach(d => {
        targetDomainsCount[d] = domains[d] || 0;
      });

      output.collections.usuarios_lookup = {
        total: users.length,
        targetDomains: targetDomainsCount,
        topDomains: Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 20),
        sample: users.slice(0, 3).map(u => ({
          id: u.id,
          campos: Object.keys(u),
          email: u.email,
          nome: u.nome || u.name,
          team_id: u.team_id,
          team_name: u.team_name,
          status: u.status,
          created_at: u.created_at,
          deleted_at: u.deleted_at
        }))
      };
    } catch (e) {
      output.collections.usuarios_lookup = { error: e.message };
    }

    // 3. Check times
    try {
      const timesSnap = await getDocs(collection(db, 'times'));
      const times = timesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      output.collections.times = {
        total: times.length,
        sample: times.slice(0, 5).map(t => ({
          id: t.id,
          campos: Object.keys(t),
          name: t.name || t.team_name,
          team_type: t.team_type
        })),
        allTimes: times.map(t => ({ id: t.id, name: t.name || t.team_name, type: t.team_type }))
      };
    } catch (e) {
      output.collections.times = { error: e.message };
    }

    // 4. Check for subcollection usuarios in first cliente
    try {
      const clientesSnap = await getDocs(query(collection(db, 'clientes'), limit(3)));
      const subcollectionCheck = [];

      for (const clienteDoc of clientesSnap.docs) {
        try {
          const subUsersSnap = await getDocs(collection(db, 'clientes', clienteDoc.id, 'usuarios'));
          subcollectionCheck.push({
            clienteId: clienteDoc.id,
            clienteName: clienteDoc.data().team_name,
            usuariosCount: subUsersSnap.size,
            sample: subUsersSnap.docs.slice(0, 2).map(d => ({ id: d.id, campos: Object.keys(d.data()) }))
          });
        } catch (e) {
          subcollectionCheck.push({
            clienteId: clienteDoc.id,
            error: e.message
          });
        }
      }

      output.collections.subcollection_usuarios = subcollectionCheck;
    } catch (e) {
      output.collections.subcollection_usuarios = { error: e.message };
    }

    // 5. Search for specific clients
    try {
      const searchTerms = ['stone', 'omnicom', 'omc', 'inter', 'obramax', 'unisa'];
      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const searchResults = {};

      searchTerms.forEach(term => {
        const found = [];
        clientesSnap.forEach(doc => {
          const data = doc.data();
          const name = (data.team_name || doc.id || '').toLowerCase();
          if (name.includes(term)) {
            found.push({ id: doc.id, name: data.team_name, times: data.times });
          }
        });
        searchResults[term] = found.length > 0 ? found : 'Não encontrado';
      });

      output.searchResults = searchResults;
    } catch (e) {
      output.searchResults = { error: e.message };
    }

    setResults(output);
    setLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
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
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>Verificar estrutura das collections</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
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
            {loading ? 'Verificando...' : 'Executar Verificação'}
          </button>

          {results && (
            <button
              onClick={copyToClipboard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                borderRadius: '12px',
                color: copied ? '#10b981' : '#a78bfa',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {copied ? <Check style={{ width: '18px', height: '18px' }} /> : <Copy style={{ width: '18px', height: '18px' }} />}
              {copied ? 'Copiado!' : 'Copiar JSON'}
            </button>
          )}
        </div>
      </div>

      {results && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px',
          overflow: 'auto'
        }}>
          <pre style={{
            color: '#e2e8f0',
            fontSize: '13px',
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
          }}>
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

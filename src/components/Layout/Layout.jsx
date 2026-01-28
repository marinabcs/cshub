import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#0f0a1f'
    }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: '260px',
        minHeight: '100vh',
        background: '#0f0a1f'
      }}>
        <Outlet />
      </main>
    </div>
  );
}

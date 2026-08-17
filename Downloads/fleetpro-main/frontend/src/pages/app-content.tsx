import { useAuth } from '../hooks/use-auth';
import LoginPage from './login';
import AdvancedAdmin from './advanced-admin';
import { Toaster } from '@/components/ui/toaster';

export default function AppContent() {
  const { user, loading } = useAuth();


  if (loading) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div style={{ textAlign: 'center', fontSize: '18px', fontFamily: 'Arial' }}>
            <p>Loading...</p>
          </div>
        </div>
        <Toaster />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage />
        <Toaster />
      </>
    );
  }


  if (user.role === 'admin') {
    return (
      <>
        <AdvancedAdmin />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', fontSize: '18px', fontFamily: 'Arial' }}>
          <p>Access Denied</p>
        </div>
      </div>
      <Toaster />
    </>
  );
}

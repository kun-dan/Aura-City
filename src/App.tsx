import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { MapHome } from './pages/MapHome';
import { Report } from './pages/Report';
import { IssueDetail } from './pages/IssueDetail';
import { Leaderboard } from './pages/Leaderboard';
import { Transparency } from './pages/Transparency';
import { ResolverJobs } from './pages/ResolverJobs';
import { AdminDashboard } from './pages/AdminDashboard';

function Routed() {
  const { profile, loading } = useAuth();
  if (loading) return <div className="splash"><img src="/favicon.svg" alt="" /></div>;
  if (!profile) return <Login />;

  const home = profile.role === 'admin' ? <AdminDashboard /> : profile.role === 'resolver' ? <ResolverJobs /> : <MapHome />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={home} />
        <Route path="map" element={<MapHome />} />
        <Route path="issue/:id" element={<IssueDetail />} />
        <Route path="transparency" element={<Transparency />} />
        {profile.role === 'citizen' && <Route path="report" element={<Report />} />}
        {profile.role === 'citizen' && <Route path="leaderboard" element={<Leaderboard />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routed />
      </BrowserRouter>
    </AuthProvider>
  );
}

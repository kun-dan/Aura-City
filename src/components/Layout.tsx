import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Briefcase, Camera, LayoutDashboard, LogOut, Map, Receipt, Trophy, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { inr } from '../lib/rules';
import { useMe } from '../state/AuthContext';
import { AuraBot } from './AuraBot';
import type { ReactNode } from 'react';

const NAV: Record<string, { to: string; label: string; icon: ReactNode }[]> = {
  citizen: [
    { to: '/', label: 'Map', icon: <Map size={18} /> },
    { to: '/report', label: 'Report', icon: <Camera size={18} /> },
    { to: '/leaderboard', label: 'Leaders', icon: <Trophy size={18} /> },
    { to: '/transparency', label: 'Spending', icon: <Receipt size={18} /> },
  ],
  resolver: [
    { to: '/', label: 'My Jobs', icon: <Briefcase size={18} /> },
    { to: '/map', label: 'Map', icon: <Map size={18} /> },
    { to: '/transparency', label: 'Ledger', icon: <Receipt size={18} /> },
  ],
  admin: [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/map', label: 'Map', icon: <Map size={18} /> },
    { to: '/transparency', label: 'Ledger', icon: <Receipt size={18} /> },
  ],
};

export function Layout() {
  const me = useMe();
  const nav = useNavigate();
  return (
    <div className="shell">
      <header className="topbar glass">
        <div className="brand" onClick={() => nav('/')}>
          <img src="/favicon.svg" alt="" /> Auracity
          {api.mode === 'demo' && <span className="demo-tag">DEMO</span>}
        </div>
        <nav className="nav-desktop">
          {NAV[me.role].map((n) => (
            <NavLink key={n.to} to={n.to} end>{n.icon}{n.label}</NavLink>
          ))}
        </nav>
        <div className="me">
          {me.role === 'citizen' && <span className="pill"><Trophy size={14} /> {me.points} pts</span>}
          {me.role === 'resolver' && <span className="pill"><Wallet size={14} /> {inr(me.wallet_balance)}</span>}
          <span className="me-name">{me.full_name}<small>{me.role}</small></span>
          <button className="icon-btn" title="Sign out" onClick={() => void api.signOut()}><LogOut size={18} /></button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="nav-mobile glass">
        {NAV[me.role].map((n) => (
          <NavLink key={n.to} to={n.to} end>{n.icon}<span>{n.label}</span></NavLink>
        ))}
      </nav>
      <AuraBot />
    </div>
  );
}

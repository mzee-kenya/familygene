import {
  Activity,
  BarChart3,
  ClipboardList,
  GitBranch,
  LayoutDashboard,
  Settings,
  UsersRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navigation = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Patients', to: '/patients', icon: UsersRound },
  { label: 'Family history', to: '/family-history', icon: ClipboardList },
  { label: 'Pedigree builder', to: '/pedigree', icon: GitBranch },
  { label: 'Clinical reviews', to: '/reviews', icon: Activity, count: '4' },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export function Sidebar({ isOpen, onNavigate }: { isOpen: boolean; onNavigate: () => void }) {
  return (
    <aside className={`app-sidebar${isOpen ? ' app-sidebar--open' : ''}`}>
      <NavLink
        aria-label="FamilyGene dashboard"
        className="brand-lockup"
        to="/"
        onClick={onNavigate}
      >
        <span className="brand-symbol" aria-hidden="true">
          <GitBranch size={21} />
        </span>
        <span className="brand-wordmark">
          <strong>FamilyGene</strong>
          <small>CLINICAL WORKSPACE</small>
        </span>
      </NavLink>

      <div className="sidebar-environment">
        <span className="sidebar-environment__dot" />
        Demo environment
      </div>

      <nav aria-label="Main navigation" className="sidebar-nav">
        <span className="sidebar-nav__label">WORKSPACE</span>
        {navigation.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
              end={item.end}
              key={item.to}
              onClick={onNavigate}
              to={item.to}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.count && <span className="sidebar-link__count">{item.count}</span>}
            </NavLink>
          );
        })}
        <span className="sidebar-nav__label sidebar-nav__label--secondary">PREFERENCES</span>
        {navigation.slice(5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
              key={item.to}
              onClick={onNavigate}
              to={item.to}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer__icon">
          <Activity size={17} />
        </span>
        <div>
          <strong>Clinical support only</strong>
          <span>Not a diagnostic system</span>
        </div>
      </div>
    </aside>
  );
}

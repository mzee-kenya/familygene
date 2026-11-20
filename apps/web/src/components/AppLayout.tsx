import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/patients': 'Patients',
  '/patients/new': 'Register patient',
  '/family-history': 'Family history',
  '/pedigree': 'Pedigree builder',
  '/reviews': 'Clinical reviews',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string) {
  if (pathname.startsWith('/patients/')) {
    return pathname === '/patients/new' ? pageTitles[pathname] : 'Patient overview';
  }

  return pageTitles[pathname] ?? 'FamilyGene';
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar
          pageTitle={getPageTitle(location.pathname)}
          onMenuClick={() => setSidebarOpen((open) => !open)}
        />
        <main className="page-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

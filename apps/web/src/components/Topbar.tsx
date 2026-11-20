import { Bell, ChevronDown, Menu, Search, Settings, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export function Topbar({ pageTitle, onMenuClick }: { pageTitle: string; onMenuClick: () => void }) {
  const [search, setSearch] = useState('');
  const [activeMenu, setActiveMenu] = useState<'notifications' | 'profile' | null>(null);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const navigate = useNavigate();

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(search.trim() ? `/patients?q=${encodeURIComponent(search.trim())}` : '/patients');
    setActiveMenu(null);
  }

  return (
    <header className="topbar">
      <div className="topbar__leading">
        <button
          aria-label="Open navigation menu"
          className="topbar__menu-button"
          onClick={onMenuClick}
          type="button"
        >
          <Menu size={21} />
        </button>
        <div className="breadcrumbs">
          <span>FamilyGene</span>
          <span aria-hidden="true">/</span>
          <h1>{pageTitle}</h1>
        </div>
      </div>

      <form className="topbar-search" onSubmit={submitSearch} role="search">
        <Search aria-hidden="true" size={17} />
        <input
          aria-label="Search all patients"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search patients"
          value={search}
        />
      </form>

      <div className="topbar__actions">
        <div className="menu-anchor">
          <button
            aria-expanded={activeMenu === 'notifications'}
            aria-label={
              notificationsRead ? 'Notifications, all caught up' : 'Notifications, 2 updates'
            }
            className="topbar-icon-button notification-trigger"
            onClick={() =>
              setActiveMenu((menu) => (menu === 'notifications' ? null : 'notifications'))
            }
            type="button"
          >
            <Bell size={19} />
            {!notificationsRead && <span className="notification-dot" />}
          </button>
          {activeMenu === 'notifications' && (
            <div className="popover-menu notification-menu">
              <div className="popover-menu__heading">
                <strong>Notifications</strong>
                <span>{notificationsRead ? 'All caught up' : '2 updates'}</span>
              </div>
              <Link to="/reviews" onClick={() => setActiveMenu(null)}>
                <span className="popover-menu__marker" />
                <span>
                  <strong>Review queue updated</strong>
                  <small>2 cases awaiting clinician review</small>
                </span>
              </Link>
              <Link to="/patients/DEMO-1042" onClick={() => setActiveMenu(null)}>
                <span className="popover-menu__marker popover-menu__marker--muted" />
                <span>
                  <strong>Family history needs follow-up</strong>
                  <small>DEMO-1042 · Demo record</small>
                </span>
              </Link>
              <button
                className="popover-menu__footer"
                onClick={() => {
                  setNotificationsRead(true);
                  setActiveMenu(null);
                }}
                type="button"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>

        <span className="topbar__divider" />

        <div className="menu-anchor">
          <button
            aria-expanded={activeMenu === 'profile'}
            aria-label="Open account menu"
            className="profile-button"
            onClick={() => setActiveMenu((menu) => (menu === 'profile' ? null : 'profile'))}
            type="button"
          >
            <span className="profile-avatar">AM</span>
            <span className="profile-copy">
              <strong>Alex Morgan</strong>
              <small>Clinician</small>
            </span>
            <ChevronDown size={15} />
          </button>
          {activeMenu === 'profile' && (
            <div className="popover-menu profile-menu">
              <div className="profile-menu__identity">
                <UserRound size={17} />
                <span>
                  <strong>Alex Morgan</strong>
                  <small>Demo clinician account</small>
                </span>
              </div>
              <Link to="/settings" onClick={() => setActiveMenu(null)}>
                <Settings size={16} /> Account settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

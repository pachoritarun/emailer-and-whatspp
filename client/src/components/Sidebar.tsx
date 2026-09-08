import {
  LayoutDashboard,
  Send,
  History,
  Users,
  GraduationCap,
  Mail,
  CheckCircle2,
  Terminal
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSendModal: () => void;
  userRole?: 'DEVELOPER' | 'SENDER';
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onOpenSendModal, userRole }) => {
  const whatsappNav = [
    { id: 'dashboard', label: 'WhatsApp Dashboard', icon: LayoutDashboard },
    { id: 'history', label: 'Notice History & Receipts', icon: History },
  ];

  const emailNav = [
    { id: 'emailer', label: 'Bulk Email Dispatcher', icon: Mail },
  ];

  const directoryNav = [
    { id: 'contacts', label: 'Recipient Directory', icon: Users },
  ];

  const renderNavButton = (item: { id: string; label: string; icon: any }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '9px 24px',
          backgroundColor: 'var(--uni-white)',
          border: 'none',
          borderLeft: isActive ? '3px solid var(--uni-red)' : '3px solid transparent',
          cursor: 'pointer',
          textAlign: 'left',
          color: isActive ? 'var(--uni-black)' : '#4A4A4A',
          fontWeight: isActive ? 600 : 500,
          fontSize: '0.84rem',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--uni-light-gray)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--uni-white)';
        }}
      >
        <Icon size={17} color={isActive ? '#B00020' : '#6B6B6B'} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      backgroundColor: 'var(--uni-white)',
      borderRight: '1px solid var(--uni-border-gray)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      justifyContent: 'space-between'
    }}>
      <div>
        {/* Institutional University Header */}
        <div style={{
          padding: '22px 24px',
          borderBottom: '1px solid var(--uni-border-gray)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            backgroundColor: 'var(--uni-black)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--uni-white)'
          }}>
            <GraduationCap size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', letterSpacing: '-0.01em', color: 'var(--uni-black)', textTransform: 'uppercase' }}>
              UNIVERSITY
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--uni-muted)', fontWeight: '500' }}>
              Communication Portal
            </div>
          </div>
        </div>

        {/* Primary Action Button in Sidebar */}
        <div style={{ padding: '16px 20px 8px' }}>
          <button
            onClick={onOpenSendModal}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 16px', fontSize: '0.84rem' }}
          >
            <Send size={15} />
            <span>+ Send WhatsApp Notice</span>
          </button>
        </div>

        {/* Clean, Non-Cluttered Grouped Navigation */}
        <nav style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* WhatsApp Channel */}
          <div>
            <div style={{
              padding: '4px 24px',
              fontSize: '0.67rem',
              fontWeight: '700',
              letterSpacing: '0.08em',
              color: 'var(--uni-muted)'
            }}>
              WHATSAPP NOTICES
            </div>
            {whatsappNav.map(renderNavButton)}
          </div>

          {/* Email Channel */}
          <div>
            <div style={{
              padding: '4px 24px',
              fontSize: '0.67rem',
              fontWeight: '700',
              letterSpacing: '0.08em',
              color: 'var(--uni-muted)'
            }}>
              EMAIL BROADCASTS
            </div>
            {emailNav.map(renderNavButton)}
          </div>

          {/* Directory */}
          <div>
            <div style={{
              padding: '4px 24px',
              fontSize: '0.67rem',
              fontWeight: '700',
              letterSpacing: '0.08em',
              color: 'var(--uni-muted)'
            }}>
              DIRECTORY & DATA
            </div>
            {directoryNav.map(renderNavButton)}
          </div>

          {/* Developer Forensics - Exclusively Visible to DEVELOPER Role */}
          {userRole === 'DEVELOPER' && (
            <div>
              <div style={{
                padding: '4px 24px',
                fontSize: '0.67rem',
                fontWeight: '700',
                letterSpacing: '0.08em',
                color: '#DC2626'
              }}>
                DEVELOPER FORENSICS
              </div>
              {renderNavButton({
                id: 'developer',
                label: 'Forensics & Sender Logs',
                icon: Terminal
              })}
            </div>
          )}
        </nav>
      </div>

      {/* Clean University Channel Footer */}
      <div style={{ borderTop: '1px solid var(--uni-border-gray)', padding: '14px 20px', backgroundColor: '#FAFAFA' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#15803D' }}></span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--uni-black)' }}>
            WhatsApp & SMTP Online
          </span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--uni-muted)' }}>
          JECRC Dual-Channel Enterprise Gateway
        </div>
      </div>
    </aside>
  );
};

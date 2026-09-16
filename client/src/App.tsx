import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { DashboardView } from './views/DashboardView.js';
import { NoticeHistoryView } from './views/NoticeHistoryView.js';
import { ContactsView } from './views/ContactsView.js';
import { DeveloperConsoleView } from './views/DeveloperConsoleView.js';
import { EmailerView } from './views/EmailerView.js';
import { TemplatesView } from './views/TemplatesView.js';
import { SendNoticeModal } from './components/SendNoticeModal.js';
import { LoginView } from './views/LoginView.js';
import { FirstTimeSetupModal } from './components/FirstTimeSetupModal.js';
import './styles/design-system.css';

interface CurrentUser {
  id: string;
  username: string;
  role: 'DEVELOPER' | 'SENDER';
  fullName: string;
  mustChangeCredentials: boolean;
}

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const stored = localStorage.getItem('jecrc_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSendModalOpen, setIsSendModalOpen] = useState<boolean>(false);
  const [isCredsModalOpen, setIsCredsModalOpen] = useState<boolean>(false);

  // If role is SENDER, prevent navigating to developer console
  useEffect(() => {
    if (currentUser?.role === 'SENDER' && activeTab === 'developer') {
      setActiveTab('dashboard');
    }
  }, [currentUser, activeTab]);

  const handleLoginSuccess = (user: CurrentUser, token: string) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleSignOut = () => {
    localStorage.removeItem('jecrc_auth_token');
    localStorage.removeItem('jecrc_user');
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // If not authenticated, render Login Screen
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Official Communication Dashboard';
      case 'templates': return 'WhatsApp Creative Template Studio';
      case 'history': return 'Notice History & Delivery Receipts';
      case 'emailer': return 'Official Bulk Email Broadcast Dispatcher';
      case 'contacts': return 'University Recipient Directory';
      case 'developer': return 'Developer & System Forensics Console';
      default: return 'University Communication Portal';
    }
  };

  return (
    <div className="app-layout">
      {/* Branded Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSendModal={() => setIsSendModalOpen(true)}
        userRole={currentUser.role}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <TopBar
          pageTitle={getPageTitle()}
          activeTab={activeTab}
          currentUser={currentUser}
          onOpenSendModal={() => setIsSendModalOpen(true)}
          onBackToDashboard={() => setActiveTab('dashboard')}
          onSelectTab={(tab) => setActiveTab(tab)}
          onOpenChangeCredentials={() => setIsCredsModalOpen(true)}
          onSignOut={handleSignOut}
        />

        <main className="content-area">
          {activeTab === 'dashboard' && (
            <DashboardView
              onOpenSendNotice={() => setIsSendModalOpen(true)}
              onNavigateToHistory={() => setActiveTab('history')}
              onNavigateToDevConsole={() => {
                if (currentUser.role === 'DEVELOPER') {
                  setActiveTab('developer');
                }
              }}
            />
          )}

          {activeTab === 'templates' && (
            <TemplatesView />
          )}

          {activeTab === 'history' && (
            <NoticeHistoryView
              onOpenSendModal={() => setIsSendModalOpen(true)}
              onNavigateToDevConsole={() => {
                if (currentUser.role === 'DEVELOPER') {
                  setActiveTab('developer');
                }
              }}
            />
          )}

          {activeTab === 'emailer' && (
            <EmailerView />
          )}

          {activeTab === 'contacts' && (
            <ContactsView />
          )}

          {activeTab === 'developer' && currentUser.role === 'DEVELOPER' && (
            <DeveloperConsoleView
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}
        </main>
      </div>

      {/* Clean Send Notice Modal */}
      <SendNoticeModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        onNoticeSent={() => {
          setActiveTab('history');
        }}
      />

      {/* Mandatory First-Time Setup Security Gate OR Optional Profile Change */}
      {(currentUser.mustChangeCredentials || isCredsModalOpen) && (
        <FirstTimeSetupModal
          isOpen={true}
          isMandatory={Boolean(currentUser.mustChangeCredentials)}
          currentUser={currentUser}
          onComplete={(updated) => {
            setCurrentUser(updated);
            setIsCredsModalOpen(false);
          }}
          onClose={() => setIsCredsModalOpen(false)}
        />
      )}
    </div>
  );
};


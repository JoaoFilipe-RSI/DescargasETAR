import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

export default function NotificationBell({ notifications, onMarkAsRead, onMarkAllAsRead }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.lida).length;

  // Fechar o dropdown ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="notifications-menu" ref={dropdownRef}>
      <button className="btn-bell" onClick={() => setIsOpen(!isOpen)} title="Notificações">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="bell-badge">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-dropdown animate-fade-in">
          <div className="notifications-dropdown-header">
            <span>Notificações</span>
            {unreadCount > 0 && (
              <button className="btn-clear-notifications" onClick={onMarkAllAsRead}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Sem notificações novas.
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`notification-item ${n.lida ? '' : 'unread'}`}
                  onClick={() => {
                    if (!n.lida) onMarkAsRead(n.id);
                  }}
                >
                  <div className="notification-item-text">{n.mensagem}</div>
                  <div className="notification-item-meta">
                    <span>
                      {new Date(n.data).toLocaleDateString()} {new Date(n.data).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!n.lida && <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 600 }}>Nova</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

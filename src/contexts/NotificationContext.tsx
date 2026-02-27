// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { type NotificationItem, type NotificationType } from '@/components/notifications/NotificationToast';

interface NotificationContextType {
  showNotification: (title: string, message?: string, type?: NotificationType, duration?: number) => void;
  notifications: NotificationItem[];
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const showNotification = useCallback((
    title: string,
    message?: string,
    type: NotificationType = 'info',
    duration: number = 5000
  ) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const notification: NotificationItem = {
      id,
      title,
      message,
      type,
      duration,
    };

    setNotifications((prev) => [...prev, notification]);
    console.log(`[NotificationContext] Added notification: ${title}`, notification);

    // Show browser notification if permission is granted
    if ('Notification' in window && window.Notification.permission === 'granted') {
      try {
        const browserNotification = new window.Notification(title, {
          body: message,
          icon: '/favicon.ico',
          tag: id, // Prevent duplicate notifications
          requireInteraction: false,
        });

        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();
        };

        // Auto-close browser notification after duration
        if (duration > 0) {
          setTimeout(() => {
            browserNotification.close();
          }, duration);
        }
      } catch (err) {
        console.warn('Failed to show browser notification:', err);
      }
    } else if ('Notification' in window && window.Notification.permission === 'default') {
      // Request permission asynchronously (don't wait for it)
      window.Notification.requestPermission().catch(err => {
        console.warn('Failed to request notification permission:', err);
      });
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, notifications, dismissNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}



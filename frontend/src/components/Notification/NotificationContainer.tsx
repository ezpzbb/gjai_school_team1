import React from 'react';
import NotificationToast from './NotificationToast';
import { NotificationState } from '../../types/notification';

interface NotificationContainerProps {
  notifications: NotificationState[];
  onClose: (id: string) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onClose,
}) => {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none"
      style={{ maxHeight: 'calc(100vh - 2rem)' }}
    >
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationToast
            id={notification.id}
            location={notification.location}
            level={notification.level}
            timestamp={notification.timestamp}
            onClose={onClose}
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;


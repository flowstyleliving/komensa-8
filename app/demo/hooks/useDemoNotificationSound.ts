import { useEffect, useRef } from 'react';

export function useDemoNotificationSound() {
  const recvAudioRef = useRef<HTMLAudioElement | null>(null);
  const sendAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio elements
    recvAudioRef.current = new Audio('/notif_recv.mp3');
    sendAudioRef.current = new Audio('/notif_send.mp3');
    
    // Preload and set volume
    recvAudioRef.current.preload = 'auto';
    sendAudioRef.current.preload = 'auto';
    recvAudioRef.current.volume = 0.5;
    sendAudioRef.current.volume = 0.5;

    return () => {
      if (recvAudioRef.current) {
        recvAudioRef.current.pause();
        recvAudioRef.current = null;
      }
      if (sendAudioRef.current) {
        sendAudioRef.current.pause();
        sendAudioRef.current = null;
      }
    };
  }, []);

  const playReceiveNotification = () => {
    if (recvAudioRef.current) {
      recvAudioRef.current.currentTime = 0;
      recvAudioRef.current.play().catch(error => {
        console.log('Could not play receive notification sound:', error);
      });
    }
  };

  const playSendNotification = () => {
    if (sendAudioRef.current) {
      sendAudioRef.current.currentTime = 0;
      sendAudioRef.current.play().catch(error => {
        console.log('Could not play send notification sound:', error);
      });
    }
  };

  return { playReceiveNotification, playSendNotification };
} 
import React, { useEffect, useRef, useState } from 'react';

interface AzureAvatarPlayerProps {
  isSessionActive: boolean;
  isSpeaking: boolean;
  onSessionStart?: () => void;
  onSessionStop?: () => void;
  onSpeakingStart?: () => void;
  onSpeakingStop?: () => void;
  onConnectionStateChange?: (state: string) => void;
  onLastEventChange?: (event: string) => void;
}

export const AzureAvatarPlayer: React.FC<AzureAvatarPlayerProps> = ({
  isSessionActive,
  isSpeaking,
  onSessionStart,
  onSessionStop,
  onSpeakingStart,
  onSpeakingStop,
  onConnectionStateChange,
  onLastEventChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connectionState, setConnectionState] = useState<string>('disconnected');

  useEffect(() => {
    const handleAvatarEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        eventType: string;
        data: any;
        timestamp: Date;
      }>;
      
      const { eventType, data } = customEvent.detail;
      
      switch (eventType) {
        case 'sessionStarted':
          onSessionStart?.();
          break;
        case 'sessionStopped':
          onSessionStop?.();
          break;
        case 'speakingStarted':
          onSpeakingStart?.();
          break;
        case 'speakingCompleted':
        case 'speakingStopped':
          onSpeakingStop?.();
          break;
        case 'connectionStateChanged':
          const newState = data.state;
          setConnectionState(newState);
          onConnectionStateChange?.(newState);
          break;
        case 'avatarEvent':
          onLastEventChange?.(data.description || 'Unknown event');
          break;
      }
    };

    window.addEventListener('azureAvatarEvent', handleAvatarEvent);
    return () => {
      window.removeEventListener('azureAvatarEvent', handleAvatarEvent);
    };
  }, [onSessionStart, onSessionStop, onSpeakingStart, onSpeakingStop, onConnectionStateChange, onLastEventChange]);

  return (
    <div className="avatar-video-container">
      <video
        ref={videoRef}
        id="avatarVideo"
        className="avatar-video"
        autoPlay
        playsInline
        muted={false}
        onLoadedMetadata={() => {
          console.log('📺 Video metadata loaded');
        }}
        onCanPlay={() => {
          console.log('✅ Video can play');
        }}
        onPlaying={() => {
          console.log('▶️ Video playing');
        }}
        onError={(e) => {
          console.error('❌ Video error:', e);
        }}
        onClick={() => {
          // Enable audio on user interaction
          if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.volume = 1.0;
            videoRef.current.play().catch(console.error);
          }
        }}
      />
      
      {!isSessionActive && (
        <div className="avatar-placeholder">
          <div>🎭</div>
          <p>Avatar Initializing...</p>
        </div>
      )}
      
      {isSessionActive && connectionState !== 'connected' && (
        <div className="avatar-placeholder">
          <div className="spinner"></div>
          <p>Connecting...</p>
        </div>
      )}
    </div>
  );
};

export default AzureAvatarPlayer;

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
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);

  const enableVideoPlayback = async () => {
    if (videoRef.current) {
      try {
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        await videoRef.current.play();
        setNeedsUserInteraction(false);
      } catch (error) {
        // Autoplay blocked, needs user interaction
        setNeedsUserInteraction(true);
      }
    }
  };

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
          
          // Auto-enable video when connected
          if (newState === 'connected') {
            setTimeout(() => enableVideoPlayback(), 100);
          }
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
        className={`avatar-video ${(!isSessionActive || connectionState !== 'connected') ? 'hidden' : ''}`}
        autoPlay
        playsInline
        muted={false}
        onLoadedMetadata={() => {
          // Attempt to start playback when metadata loads
          enableVideoPlayback();
        }}
        onCanPlay={() => {
          // Attempt to start playback when ready
          enableVideoPlayback();
        }}
        onClick={() => {
          // Enable audio and playback on user interaction
          enableVideoPlayback();
        }}
      />
      
      {(!isSessionActive || connectionState !== 'connected') && (
        <div className="avatar-placeholder">
          <div className="avatar-loading">
            <div className="loading-spinner"></div>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div className="avatar-emoji">
            {!isSessionActive ? '🎭' : '🔗'}
          </div>
          <p>{!isSessionActive ? 'Avatar Initializing...' : 'Connecting...'}</p>
        </div>
      )}
      
      {isSessionActive && connectionState === 'connected' && needsUserInteraction && (
        <div className="avatar-placeholder" style={{ background: 'rgba(0, 0, 0, 0.7)' }}>
          <div className="avatar-emoji">▶️</div>
          <p>Click to start avatar</p>
        </div>
      )}
    </div>
  );
};

export default AzureAvatarPlayer;

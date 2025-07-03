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
      console.log('Azure Avatar Event:', eventType, data);
      
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
          setConnectionState(data.state);
          onConnectionStateChange?.(data.state);
          break;
        case 'videoStreamReady':
          console.log('🎬 Video stream ready event received for element:', data.videoElementId);
          // Force video element to refresh and play
          if (videoRef.current) {
            console.log('🔄 Refreshing video element and forcing play...');
            
            // Multiple attempts to ensure video plays
            const playVideo = () => {
              if (videoRef.current) {
                videoRef.current.load();
                return videoRef.current.play().then(() => {
                  console.log('✅ Video play successful after stream ready');
                }).catch(error => {
                  console.warn('⚠️ Video play failed after stream ready:', error);
                  return Promise.reject(error);
                });
              }
              return Promise.reject('No video element');
            };

            // Try immediately
            playVideo().catch(() => {
              // Try again after 100ms
              setTimeout(() => {
                playVideo().catch(() => {
                  // Final attempt after 500ms
                  setTimeout(() => {
                    playVideo().catch(console.error);
                  }, 500);
                });
              }, 100);
            });
          }
          break;
        case 'avatarEvent':
        case 'avatarEventReceived':
          const eventDescription = data.description || 'Avatar event received';
          onLastEventChange?.(eventDescription);
          break;
      }
    };

    window.addEventListener('azureAvatarEvent', handleAvatarEvent);
    
    return () => {
      window.removeEventListener('azureAvatarEvent', handleAvatarEvent);
    };
  }, [onSessionStart, onSessionStop, onSpeakingStart, onSpeakingStop, onConnectionStateChange, onLastEventChange]);

  // Force video to play when session becomes active and connected
  useEffect(() => {
    if (isSessionActive && connectionState === 'connected' && videoRef.current) {
      const video = videoRef.current;
      console.log('🎬 Session active and connected, ensuring video plays');
      
      // Check if video has a stream
      if (video.srcObject) {
        console.log('📺 Video has srcObject, attempting to play');
        video.play().then(() => {
          console.log('✅ Video playing successfully');
        }).catch(error => {
          console.warn('⚠️ Video play failed:', error);
          // Try again after user interaction
          const handleUserInteraction = () => {
            video.play().catch(console.error);
            document.removeEventListener('click', handleUserInteraction);
          };
          document.addEventListener('click', handleUserInteraction);
        });
      } else {
        console.log('⚠️ Video does not have srcObject yet');
      }
    }
  }, [isSessionActive, connectionState]);

  return (
    <div className="azure-avatar-player">
      {/* Avatar Video Container */}
      <div className="avatar-video-container">
        <video
          ref={videoRef}
          id="avatarVideo"
          className={`avatar-video ${isSpeaking ? 'speaking' : ''}`}
          autoPlay={true}
          playsInline={true}
          muted={false}
          controls={false}
          onLoadedMetadata={() => {
            console.log('🎬 Video element: metadata loaded');
            if (videoRef.current) {
              videoRef.current.volume = 1.0;
              videoRef.current.muted = false;
              console.log('🔊 Audio settings applied:', {
                volume: videoRef.current.volume,
                muted: videoRef.current.muted,
                readyState: videoRef.current.readyState,
                videoWidth: videoRef.current.videoWidth,
                videoHeight: videoRef.current.videoHeight
              });
              // Ensure video plays when metadata is loaded
              videoRef.current.play().catch(error => {
                console.warn('⚠️ Video autoplay failed after metadata:', error);
              });
            }
          }}
          onLoadedData={() => {
            console.log('📊 Video element: data loaded');
            if (videoRef.current) {
              console.log('📊 Video dimensions:', {
                videoWidth: videoRef.current.videoWidth,
                videoHeight: videoRef.current.videoHeight,
                duration: videoRef.current.duration,
                readyState: videoRef.current.readyState
              });
            }
          }}
          onPlay={() => {
            console.log('▶️ Video element: started playing');
            if (videoRef.current) {
              videoRef.current.muted = false;
              videoRef.current.volume = 1.0;
              console.log('🔊 Audio enabled on play:', {
                volume: videoRef.current.volume,
                muted: videoRef.current.muted
              });
            }
          }}
          onError={(e) => console.error('❌ Video element error:', e)}
          onLoadStart={() => console.log('🔄 Video element: load started')}
          onCanPlay={() => {
            console.log('✅ Video element: can play');
            if (videoRef.current) {
              videoRef.current.volume = 1.0;
              videoRef.current.muted = false;
              // Try to play the video
              if (videoRef.current.paused) {
                videoRef.current.play().then(() => {
                  console.log('✅ Video play successful on canPlay event');
                }).catch(error => {
                  console.warn('⚠️ Video play failed on canPlay:', error);
                });
              }
            }
          }}
          onPlaying={() => {
            console.log('▶️ Video element: playing');
          }}
          onPause={() => {
            console.log('⏸️ Video element: paused');
          }}
          onEnded={() => {
            console.log('🔚 Video element: ended');
          }}
          onWaiting={() => {
            console.log('⏳ Video element: waiting for data');
          }}
          onStalled={() => {
            console.log('🛑 Video element: stalled');
          }}
          onClick={() => {
            // Enable audio and force play on user click
            if (videoRef.current) {
              videoRef.current.muted = false;
              videoRef.current.volume = 1.0;
              videoRef.current.play().then(() => {
                console.log('✅ Video playing after user click');
              }).catch(error => {
                console.error('❌ Video play failed after user click:', error);
              });
              console.log('🔊 Audio enabled via user interaction:', {
                volume: videoRef.current.volume,
                muted: videoRef.current.muted
              });
            }
          }}
        />
        
        {!isSessionActive && (
          <div className="avatar-placeholder">
            <div className="placeholder-icon">🎭</div>
            <div className="placeholder-text">Avatar Session Inactive</div>
            <div className="placeholder-subtext">
              Waiting for avatar session to start...
            </div>
          </div>
        )}
        
        {isSessionActive && connectionState !== 'connected' && (
          <div className="avatar-overlay">
            <div className="overlay-content">
              <div className="loading-spinner"></div>
              <div className="overlay-text">
                {connectionState === 'connecting' ? 'Connecting to avatar...' : 'Establishing connection...'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AzureAvatarPlayer;

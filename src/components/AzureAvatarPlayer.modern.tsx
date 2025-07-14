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
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [isEnablingVideo, setIsEnablingVideo] = useState<boolean>(false);
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const [videoUnmuted, setVideoUnmuted] = useState<boolean>(false);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);

  // Detect if device is mobile
  const detectMobileDevice = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // Detect if device is iOS (needs special audio handling)
  const detectiOSDevice = (): boolean => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  };

  // Set up mobile-optimized audio routing for proper speaker usage
  const setupMobileAudio = async (video: HTMLVideoElement): Promise<void> => {
    if (!isMobileDevice) return;

    try {
      // Create audio context for mobile speaker routing
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      
      // Resume audio context if suspended (required on mobile)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create gain node for volume control (instead of using video.muted)
      if (!gainNodeRef.current) {
        gainNodeRef.current = audioContext.createGain();
        gainNodeRef.current.connect(audioContext.destination);
      }

      // Connect video audio to Web Audio API for proper speaker routing
      if (video.srcObject && !video.getAttribute('data-audio-connected')) {
        const source = audioContext.createMediaStreamSource(video.srcObject as MediaStream);
        source.connect(gainNodeRef.current);
        video.setAttribute('data-audio-connected', 'true');
        
        // Keep video unmuted but control volume through gain node
        video.muted = false;
        video.volume = 1.0;
        
        // iOS-specific audio routing fix
        if (detectiOSDevice()) {
          // Force audio to use loudspeaker instead of earpiece
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
        }
        
        console.log('Mobile audio routing setup completed - using main speakers');
      }
    } catch (error) {
      console.warn('Failed to setup mobile audio routing:', error);
      // Fallback to default behavior
    }
  };

  // Control audio volume for mobile (instead of muting video element)
  const setMobileAudioVolume = (volume: number): void => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
      setIsAudioMuted(volume === 0);
      console.log(`Mobile audio volume set to: ${volume} (${volume === 0 ? 'muted' : 'unmuted'})`);
    }
  };

  // Initialize mobile detection
  useEffect(() => {
    const mobile = detectMobileDevice();
    setIsMobileDevice(mobile);
    if (mobile) {
      console.log('Mobile device detected - will use optimized audio routing');
    }
  }, []);

  // Monitor video srcObject changes for mobile audio setup
  useEffect(() => {
    if (!isMobileDevice || !videoRef.current) return;

    const video = videoRef.current;
    
    // Set up observer for srcObject changes
    const observer = new MutationObserver(() => {
      if (video.srcObject && !video.getAttribute('data-audio-connected')) {
        console.log('Video stream detected on mobile, setting up audio routing...');
        setTimeout(() => setupMobileAudio(video), 100);
      }
    });

    // Watch for changes to srcObject
    const watchStreamChanges = () => {
      if (video.srcObject && !video.getAttribute('data-audio-connected')) {
        setupMobileAudio(video);
      }
    };

    // Check immediately
    watchStreamChanges();

    // Set up interval to check for stream changes (backup method)
    const streamInterval = setInterval(watchStreamChanges, 1000);

    return () => {
      observer.disconnect();
      clearInterval(streamInterval);
    };
  }, [isMobileDevice]);

  const enableVideoPlayback = async () => {
    if (!videoRef.current || isEnablingVideo || videoReady) {
      return; // Prevent multiple simultaneous attempts or if already ready
    }
    
    setIsEnablingVideo(true);
    const video = videoRef.current;
    
    try {
      console.log('Attempting to enable video playback...');
      
      // Force video to be ready for mobile
      video.load();
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);
        
        const onCanPlay = () => {
          clearTimeout(timeout);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('error', onError);
          resolve(undefined);
        };
        
        const onError = () => {
          clearTimeout(timeout);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('error', onError);
          reject(new Error('Video load error'));
        };
        
        if (video.readyState >= 3) { // HAVE_FUTURE_DATA
          resolve(undefined);
        } else {
          video.addEventListener('canplay', onCanPlay);
          video.addEventListener('error', onError);
        }
      });
      
      // Set video properties for mobile compatibility
      video.muted = true; // Required for autoplay on mobile
      video.volume = 1.0;
      video.playsInline = true; // Critical for iOS
      
      // Attempt to play (keep muted for autoplay compliance)
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('Video started playing successfully (muted for autoplay compliance)');
        setVideoReady(true); // Mark as ready
        
        // Set up mobile audio routing for proper speaker usage
        if (isMobileDevice) {
          setTimeout(() => setupMobileAudio(video), 500);
        }
        
        // Video will be unmuted automatically when avatar starts speaking
        // This complies with browser autoplay policies
      }
      
    } catch (error) {
      console.log('Video autoplay failed (this is normal on some browsers):', error);
      
      // Fallback for browsers that block autoplay
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        
        // Try to at least load the video
        try {
          await videoRef.current.play();
          console.log('Video playing muted as fallback');
        } catch (fallbackError) {
          console.log('Video requires user interaction:', fallbackError);
        }
      }
    } finally {
      setIsEnablingVideo(false);
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
          // Unmute audio when avatar starts speaking (this counts as user interaction)
          if (videoRef.current && !videoUnmuted) {
            if (isMobileDevice) {
              // Use Web Audio API volume control for mobile (preserves speaker routing)
              setMobileAudioVolume(1.0);
            } else {
              // Standard desktop unmuting
              videoRef.current.muted = false;
              videoRef.current.volume = 1.0;
            }
            setVideoUnmuted(true);
            console.log('Video unmuted for avatar speech');
          }
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
          
          // Video will be handled by the useEffect, not here
          if (newState === 'connected') {
            console.log('Avatar connected');
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

  // Auto-start video when component mounts and session becomes active
  useEffect(() => {
    if (isSessionActive && connectionState === 'connected' && !isEnablingVideo && !videoReady) {
      console.log('Session active and connected, ensuring video playback...');
      // Single attempt only
      setTimeout(() => enableVideoPlayback(), 500);
    }
  }, [isSessionActive, connectionState]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current = null;
      }
    };
  }, []);

  return (
    <div className="avatar-video-container">
      <video
        ref={videoRef}
        id="avatarVideo"
        className={`avatar-video ${(!isSessionActive || connectionState !== 'connected') ? 'hidden' : ''}`}
        autoPlay
        playsInline
        muted={true}
        loop={false}
        preload="metadata"
        {...({ 'webkit-playsinline': 'true' } as any)}
        {...({ 'x5-playsinline': 'true' } as any)}
        {...({ 'x5-video-player-type': 'h5' } as any)}
        {...({ 'x5-video-player-fullscreen': 'false' } as any)}
        onLoadStart={() => {
          console.log('Video load started');
        }}
        onLoadedMetadata={() => {
          console.log('Video metadata loaded');
          // Only attempt if not already enabling or ready
          if (!isEnablingVideo && !videoReady) {
            setTimeout(() => enableVideoPlayback(), 100);
          }
        }}
        onCanPlay={() => {
          console.log('Video can play');
          // Only attempt if not already enabling or ready
          if (!isEnablingVideo && !videoReady) {
            setTimeout(() => enableVideoPlayback(), 100);
          }
        }}
        onPlay={() => {
          console.log('Video started playing');
        }}
        onPause={() => {
          console.log('Video paused');
        }}
        onWaiting={() => {
          console.log('Video waiting for data...');
        }}
        onClick={() => {
          // Manual click to ensure audio and playback
          if (videoRef.current) {
            if (isMobileDevice) {
              // Use Web Audio API volume control for mobile (preserves speaker routing)
              setMobileAudioVolume(1.0);
              // Ensure audio context is resumed on user interaction
              if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
              }
            } else {
              // Standard desktop unmuting
              videoRef.current.muted = false;
              videoRef.current.volume = 1.0;
            }
            setVideoUnmuted(true);
            videoRef.current.play().then(() => {
              console.log('Video unmuted and playing after user click');
            }).catch((error) => {
              console.log('Click play failed:', error);
            });
          }
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
    </div>
  );
};

export default AzureAvatarPlayer;

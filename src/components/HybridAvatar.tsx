import { useEffect, useState } from 'react';

interface HybridAvatarProps {
  isSpeaking: boolean;
  text?: string;
  onStopSpeaking?: () => void;
}

export const HybridAvatar = ({ isSpeaking, text, onStopSpeaking }: HybridAvatarProps) => {
  const [animationClass, setAnimationClass] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    console.log('HybridAvatar received props:', { isSpeaking, text: text?.substring(0, 50) + '...' });
    if (isSpeaking) {
      setAnimationClass('speaking');
      setDisplayText(text || '');
    } else {
      setAnimationClass('');
      setDisplayText('');
    }
  }, [isSpeaking, text]);

  // Listen for video generation events
  useEffect(() => {
    const handleVideoGeneration = (event: Event) => {
      const customEvent = event as CustomEvent<{ status: string; text: string; videoUrl?: string }>;
      const { status, videoUrl: generatedVideoUrl } = customEvent.detail;
      
      console.log('Video generation event:', status, generatedVideoUrl);
      
      switch (status) {
        case 'generation_started':
          setIsVideoGenerating(true);
          break;
        case 'generation_completed':
          setIsVideoGenerating(false);
          if (generatedVideoUrl) {
            setVideoUrl(generatedVideoUrl);
            // Auto-switch to video after a short delay
            setTimeout(() => setShowVideo(true), 1000);
          }
          break;
        case 'generation_failed':
          setIsVideoGenerating(false);
          break;
      }
    };

    window.addEventListener('avatarVideoGeneration', handleVideoGeneration);
    
    return () => {
      window.removeEventListener('avatarVideoGeneration', handleVideoGeneration);
    };
  }, []);

  const toggleVideoMode = () => {
    if (videoUrl) {
      setShowVideo(!showVideo);
    }
  };

  return (
    <div className="hybrid-avatar-container">
      {/* Video/Live Avatar Toggle */}
      <div className="avatar-controls">
        <div className="avatar-mode-info">
          {isVideoGenerating && (
            <div className="generation-status">
              <span className="generating-indicator">🎬</span>
              Generating video avatar...
            </div>
          )}
          {videoUrl && (
            <button 
              className="toggle-mode-btn"
              onClick={toggleVideoMode}
            >
              {showVideo ? '👤 Show Live Avatar' : '🎬 Show Video Avatar'}
            </button>
          )}
        </div>
      </div>

      {/* Avatar Display */}
      {showVideo && videoUrl ? (
        <div className="video-avatar-container">
          <video 
            src={videoUrl}
            autoPlay
            loop
            muted={false}
            controls
            className="avatar-video"
          />
          <div className="video-overlay">
            <div className="video-status">Video Avatar</div>
          </div>
        </div>
      ) : (
        <div className={`live-avatar ${animationClass}`}>
          {/* Avatar Head */}
          <div className="avatar-head">
            <div className="avatar-face">
              {/* Eyes */}
              <div className="avatar-eyes">
                <div className="avatar-eye"></div>
                <div className="avatar-eye"></div>
              </div>
              
              {/* Mouth */}
              <div className={`avatar-mouth ${isSpeaking ? 'talking' : ''}`}>
                <div className="mouth-shape"></div>
              </div>
            </div>
          </div>
          
          {/* Avatar Body */}
          <div className="avatar-body">
            <div className="avatar-torso"></div>
          </div>

          {/* Speaking Indicator */}
          {isSpeaking && (
            <div className="speaking-indicator">
              <div className="sound-wave">
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Text Display */}
      {displayText && (
        <div className="avatar-speech-text">
          <div className="speech-bubble">
            <p>{displayText}</p>
          </div>
        </div>
      )}

      {/* Stop Speaking Button */}
      {isSpeaking && onStopSpeaking && (
        <button
          className="stop-speaking-btn"
          onClick={onStopSpeaking}
          title="Stop Speaking"
        >
          🔇 Stop
        </button>
      )}
    </div>
  );
};

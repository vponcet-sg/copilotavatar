import { useEffect, useState } from 'react';

interface LiveAvatarProps {
  isSpeaking: boolean;
  text?: string;
  onStopSpeaking?: () => void;
}

export const LiveAvatar = ({ isSpeaking, text, onStopSpeaking }: LiveAvatarProps) => {
  const [animationClass, setAnimationClass] = useState('');
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    console.log('LiveAvatar received props:', { isSpeaking, text: text?.substring(0, 50) + '...' });
    if (isSpeaking) {
      setAnimationClass('speaking');
      setDisplayText(text || '');
    } else {
      setAnimationClass('');
      setDisplayText('');
    }
  }, [isSpeaking, text]);

  return (
    <div className="live-avatar-container">
      <div className={`live-avatar ${animationClass}`}>
        {/* Avatar Head */}
        <div className="avatar-head">
          <div className="avatar-face">
            {/* Eyes */}
            <div className="avatar-eyes">
              <div className="avatar-eye left"></div>
              <div className="avatar-eye right"></div>
            </div>
            
            {/* Mouth */}
            <div className={`avatar-mouth ${isSpeaking ? 'talking' : ''}`}>
              <div className="mouth-shape"></div>
            </div>
          </div>
        </div>
        
        {/* Avatar Body */}
        <div className="avatar-body">
          <div className="avatar-shoulders"></div>
        </div>
        
        {/* Speaking Indicator */}
        {isSpeaking && (
          <div className="speaking-indicator">
            <div className="sound-waves">
              <div className="wave wave-1"></div>
              <div className="wave wave-2"></div>
              <div className="wave wave-3"></div>
            </div>
          </div>
        )}
      </div>
      
      {/* Speech Text Display */}
      {isSpeaking && displayText && (
        <div className="speech-bubble">
          <div className="speech-text">{displayText}</div>
          {onStopSpeaking && (
            <button className="stop-speech-btn" onClick={onStopSpeaking}>
              🔇 Stop
            </button>
          )}
        </div>
      )}
      
      {/* Status */}
      <div className="avatar-status">
        {isSpeaking ? (
          <span className="status-speaking">🔊 Speaking...</span>
        ) : (
          <span className="status-idle">💬 Ready to speak</span>
        )}
      </div>
    </div>
  );
};

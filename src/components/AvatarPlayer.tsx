import { forwardRef } from 'react';

interface AvatarPlayerProps {
  videoUrl?: string;
  isProcessing: boolean;
  isAudioOnly?: boolean;
  progress?: { status: string; progress: number; elapsedSeconds: number } | null;
}

export const AvatarPlayer = forwardRef<HTMLVideoElement, AvatarPlayerProps>(
  ({ videoUrl, isProcessing, isAudioOnly = false, progress }, ref) => {
    return (
      <div className="avatar-section">
        <div className="avatar-container">
          {videoUrl && !isAudioOnly ? (
            <video
              ref={ref}
              className="avatar-video"
              controls
              muted={false}
              playsInline
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="avatar-placeholder">
              <div className="avatar-icon">
                {isAudioOnly ? '🔊' : '🤖'}
              </div>
              <p>
                {isAudioOnly 
                  ? 'Audio-only response (avatar generation took too long)' 
                  : 'Avatar will appear here'
                }
              </p>
            </div>
          )}
        </div>
        
        {isProcessing && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <div className="processing-text">
              {progress ? (
                <div>
                  <span>Generating avatar response...</span>
                  <div className="progress-details">
                    <span>Status: {progress.status}</span>
                    <span>Elapsed: {progress.elapsedSeconds}s</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${Math.min(progress.progress, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : (
                <span>Processing your request...</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

AvatarPlayer.displayName = 'AvatarPlayer';

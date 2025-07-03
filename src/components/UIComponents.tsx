import React, { useState } from 'react';

interface StatusIndicatorProps {
  isConnected: boolean;
}

export const StatusIndicator = ({ isConnected }: StatusIndicatorProps) => {
  return (
    <div className="status-indicator">
      <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
      <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
    </div>
  );
};

interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
}

export const ErrorBanner = ({ error, onDismiss }: ErrorBannerProps) => {
  return (
    <div className="error-banner">
      <span>⚠️ {error}</span>
      <button onClick={onDismiss} className="error-close">
        ✕
      </button>
    </div>
  );
};

interface ProcessingIndicatorProps {
  message?: string;
}

export const ProcessingIndicator = ({ 
  message = "Processing your request..." 
}: ProcessingIndicatorProps) => {
  return (
    <div className="processing-indicator">
      <div className="spinner"></div>
      <span>{message}</span>
    </div>
  );
};

interface StatusButtonProps {
  isSessionActive: boolean;
  connectionState: string;
  isSpeaking: boolean;
  lastEvent: string;
}

export const StatusButton: React.FC<StatusButtonProps> = ({
  isSessionActive,
  connectionState,
  isSpeaking,
  lastEvent
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getConnectionStatusColor = (state: string) => {
    switch (state) {
      case 'connected': return '#4ade80';
      case 'connecting': return '#fbbf24';
      case 'disconnected': return '#f87171';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getMainStatusColor = () => {
    if (isSessionActive && connectionState === 'connected') {
      return isSpeaking ? '#3b82f6' : '#4ade80';
    }
    return connectionState === 'connecting' ? '#fbbf24' : '#f87171';
  };

  return (
    <div className="status-button-container">
      <button 
        className="status-button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ borderColor: getMainStatusColor() }}
      >
        <span 
          className="status-button-dot"
          style={{ backgroundColor: getMainStatusColor() }}
        />
        <span className="status-button-text">
          {isSessionActive ? (isSpeaking ? 'Speaking' : 'Active') : 'Inactive'}
        </span>
        <span className={`status-button-arrow ${isExpanded ? 'expanded' : ''}`}>
          ▼
        </span>
      </button>
      
      {isExpanded && (
        <div className="status-dropdown">
          <div className="status-dropdown-item">
            <span className="status-dropdown-label">Session:</span>
            <span className={`status-dropdown-value ${isSessionActive ? 'active' : 'inactive'}`}>
              {isSessionActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="status-dropdown-item">
            <span className="status-dropdown-label">Connection:</span>
            <span 
              className="status-dropdown-value"
              style={{ color: getConnectionStatusColor(connectionState) }}
            >
              {connectionState}
            </span>
          </div>
          <div className="status-dropdown-item">
            <span className="status-dropdown-label">Speaking:</span>
            <span className={`status-dropdown-value ${isSpeaking ? 'speaking' : 'idle'}`}>
              {isSpeaking ? 'Speaking' : 'Idle'}
            </span>
          </div>
          {lastEvent && (
            <div className="status-dropdown-item">
              <span className="status-dropdown-label">Last Event:</span>
              <span className="status-dropdown-value event">{lastEvent}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

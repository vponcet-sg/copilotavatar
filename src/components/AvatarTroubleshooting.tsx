import React, { useEffect, useState } from 'react';

interface AvatarTroubleshootingProps {
  show: boolean;
  onClose: () => void;
}

interface SystemCheck {
  name: string;
  status: 'checking' | 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

export const AvatarTroubleshooting: React.FC<AvatarTroubleshootingProps> = ({ show, onClose }) => {
  const [checks, setChecks] = useState<SystemCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (show) {
      runSystemChecks();
    }
  }, [show]);

  const runSystemChecks = async () => {
    setIsRunning(true);
    const checkResults: SystemCheck[] = [];

    // Check WebRTC support
    checkResults.push(await checkWebRTCSupport());
    
    // Check HTTPS
    checkResults.push(checkHTTPS());
    
    // Check microphone permissions
    checkResults.push(await checkMicrophonePermission());
    
    // Check environment variables
    checkResults.push(checkEnvironmentVariables());
    
    // Check Speech SDK
    checkResults.push(checkSpeechSDK());
    
    setChecks(checkResults);
    setIsRunning(false);
  };

  const checkWebRTCSupport = async (): Promise<SystemCheck> => {
    try {
      if (!window.RTCPeerConnection) {
        return {
          name: 'WebRTC Support',
          status: 'fail',
          message: 'WebRTC is not supported in this browser',
          details: 'Try using Chrome, Firefox, Safari, or Edge'
        };
      }

      // Test creating a peer connection
      const pc = new RTCPeerConnection();
      pc.close();

      return {
        name: 'WebRTC Support',
        status: 'pass',
        message: 'WebRTC is supported'
      };
    } catch (error) {
      return {
        name: 'WebRTC Support',
        status: 'fail',
        message: 'WebRTC test failed',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  };

  const checkHTTPS = (): SystemCheck => {
    if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
      return {
        name: 'Secure Context',
        status: 'pass',
        message: 'Running in secure context (HTTPS or localhost)'
      };
    }

    return {
      name: 'Secure Context',
      status: 'fail',
      message: 'Not running in secure context',
      details: 'WebRTC and microphone access require HTTPS or localhost'
    };
  };

  const checkMicrophonePermission = async (): Promise<SystemCheck> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          name: 'Microphone Access',
          status: 'fail',
          message: 'Media devices API not available'
        };
      }

      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      switch (permissionStatus.state) {
        case 'granted':
          return {
            name: 'Microphone Permission',
            status: 'pass',
            message: 'Microphone permission granted'
          };
        case 'prompt':
          return {
            name: 'Microphone Permission',
            status: 'warning',
            message: 'Microphone permission will be requested when needed'
          };
        case 'denied':
          return {
            name: 'Microphone Permission',
            status: 'fail',
            message: 'Microphone permission denied',
            details: 'Please enable microphone access in browser settings'
          };
        default:
          return {
            name: 'Microphone Permission',
            status: 'warning',
            message: 'Microphone permission status unknown'
          };
      }
    } catch (error) {
      return {
        name: 'Microphone Permission',
        status: 'warning',
        message: 'Could not check microphone permission',
        details: 'This is normal in some browsers'
      };
    }
  };

  const checkEnvironmentVariables = (): SystemCheck => {
    const requiredVars = [
      'VITE_SPEECH_KEY',
      'VITE_SPEECH_REGION',
      'VITE_DIRECTLINE_SECRET'
    ];

    const missingVars = requiredVars.filter(varName => {
      const value = import.meta.env[varName];
      return !value || value.includes('your_') || value === '';
    });

    if (missingVars.length === 0) {
      return {
        name: 'Environment Variables',
        status: 'pass',
        message: 'All required environment variables are set'
      };
    }

    return {
      name: 'Environment Variables',
      status: 'fail',
      message: `Missing or invalid environment variables: ${missingVars.join(', ')}`,
      details: 'Check your .env file and make sure all variables are properly configured'
    };
  };

  const checkSpeechSDK = (): SystemCheck => {
    try {
      // Check if Speech SDK is available
      if (typeof window !== 'undefined' && (window as any).SpeechSDK) {
        return {
          name: 'Speech SDK',
          status: 'pass',
          message: 'Speech SDK is loaded'
        };
      }

      return {
        name: 'Speech SDK',
        status: 'warning',
        message: 'Speech SDK not detected on window object',
        details: 'This might be normal with ES modules'
      };
    } catch (error) {
      return {
        name: 'Speech SDK',
        status: 'fail',
        message: 'Speech SDK check failed',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  };

  const getStatusIcon = (status: SystemCheck['status']) => {
    switch (status) {
      case 'checking': return '🔄';
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'warning': return '⚠️';
      default: return '❓';
    }
  };

  const getStatusColor = (status: SystemCheck['status']) => {
    switch (status) {
      case 'pass': return '#4ade80';
      case 'fail': return '#f87171';
      case 'warning': return '#fbbf24';
      case 'checking': return '#6b7280';
      default: return '#6b7280';
    }
  };

  if (!show) return null;

  return (
    <div className="troubleshooting-overlay">
      <div className="troubleshooting-modal">
        <div className="troubleshooting-header">
          <h2>🔧 Avatar System Diagnostics</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        
        <div className="troubleshooting-content">
          {isRunning && (
            <div className="loading-section">
              <div className="loading-spinner"></div>
              <p>Running system checks...</p>
            </div>
          )}
          
          <div className="checks-list">
            {checks.map((check, index) => (
              <div key={index} className="check-item">
                <div className="check-header">
                  <span className="check-icon">{getStatusIcon(check.status)}</span>
                  <span className="check-name">{check.name}</span>
                  <span 
                    className="check-status"
                    style={{ color: getStatusColor(check.status) }}
                  >
                    {check.status.toUpperCase()}
                  </span>
                </div>
                <div className="check-message">{check.message}</div>
                {check.details && (
                  <div className="check-details">{check.details}</div>
                )}
              </div>
            ))}
          </div>
          
          {!isRunning && checks.length > 0 && (
            <div className="troubleshooting-actions">
              <button onClick={runSystemChecks} className="rerun-button">
                🔄 Run Checks Again
              </button>
              <button onClick={onClose} className="close-button secondary">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarTroubleshooting;

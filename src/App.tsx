import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AppState, BotMessage } from './types';
import { SpeechService } from './services/SpeechService';
import { BotService } from './services/BotService';
import { AzureAvatarRealTimeService } from './services/AzureAvatarRealTimeService';
import ConfigService from './services/ConfigService';
import { ErrorBanner, StatusButton } from './components/UIComponents';
import { AzureAvatarPlayer } from './components/AzureAvatarPlayer';
import { ConversationHistory } from './components/ConversationHistory';
import { AvatarTroubleshooting } from './components/AvatarTroubleshooting';
import { SettingsModal } from './components/SettingsModal';
import './App.css';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    isListening: false,
    isProcessing: false,
    isConnected: false,
    currentMessage: '',
    botResponse: '',
    error: undefined
  });

  const [conversationHistory, setConversationHistory] = useState<BotMessage[]>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'info' | 'warning' | 'success' }>>([]);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isAvatarSessionActive, setIsAvatarSessionActive] = useState(false);
  const [avatarConnectionState, setAvatarConnectionState] = useState<string>('disconnected');
  const [avatarLastEvent, setAvatarLastEvent] = useState<string>('');
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isMultiLingual, setIsMultiLingual] = useState(false); // Default to English-only
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false); // Microphone mute state - listening is on by default
  
  // Service instances (using refs to persist across renders)
  const speechServiceRef = useRef<SpeechService | null>(null);
  const botServiceRef = useRef<BotService | null>(null);
  const azureAvatarServiceRef = useRef<AzureAvatarRealTimeService | null>(null);
  
  // Debounce refs for speech recognition
  const lastProcessedMessageRef = useRef<string>('');
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingMessageRef = useRef<boolean>(false);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Validate configuration
        const configService = ConfigService.getInstance();
        const { isValid, errors } = configService.validateConfiguration();
        
        if (!isValid) {
          setAppState(prev => ({
            ...prev,
            error: `Configuration error: ${errors.join(', ')}`
          }));
          return;
        }

        // Initialize services
        speechServiceRef.current = new SpeechService();
        botServiceRef.current = new BotService();
        azureAvatarServiceRef.current = new AzureAvatarRealTimeService();

        // Connect to bot
        await botServiceRef.current.connect();
        
        // Start avatar session
        const avatarConfig = configService.getAvatarConfig();
        await azureAvatarServiceRef.current.startSession(
          avatarConfig.character,
          avatarConfig.style
        );
        
        setAppState(prev => ({
          ...prev,
          isConnected: true,
          error: undefined
        }));
        setIsAvatarSessionActive(true);

        console.log('All services initialized successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setAppState(prev => ({
          ...prev,
          error: `Initialization failed: ${errorMessage}`,
          isConnected: false
        }));
        console.error('Service initialization failed:', error);
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      speechServiceRef.current?.dispose();
      botServiceRef.current?.dispose();
      azureAvatarServiceRef.current?.dispose();
      
      // Clear any pending message timeout
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
    };
  }, []);

  // Set up bot response listener
  useEffect(() => {
    const handleBotResponse = async (event: Event) => {
      const customEvent = event as CustomEvent<BotMessage>;
      const botMessage = customEvent.detail;
      
      setAppState(prev => ({
        ...prev,
        botResponse: botMessage.text,
        isProcessing: false
      }));

      // Update conversation history
      setConversationHistory(prev => [...prev, botMessage]);

      // Immediately speak the bot response using Azure Avatar Real-Time Service with auto voice selection
      try {
        if (azureAvatarServiceRef.current && botMessage.text.trim()) {
          // Get the detected language from speech service if available
          const detectedLanguageInfo = speechServiceRef.current?.getDetectedLanguageInfo();
          const targetLanguage = detectedLanguageInfo?.detected || detectedLanguageInfo?.current;
          
          // Use the auto voice selection method (optimized)
          await azureAvatarServiceRef.current.speakWithAutoVoice(botMessage.text, targetLanguage);
        }
      } catch (error) {
        setAppState(prev => ({
          ...prev,
          error: `Avatar speech failed: ${error instanceof Error ? error.message : String(error)}`
        }));
        addNotification('Failed to speak response', 'warning');
      }
    };

    window.addEventListener('botResponse', handleBotResponse);
    
    return () => {
      window.removeEventListener('botResponse', handleBotResponse);
    };
  }, []);

  // Set up Azure avatar event listener
  useEffect(() => {
    const handleAzureAvatarEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        eventType: string;
        data: any;
        timestamp: Date;
      }>;
      
      const { eventType, data } = customEvent.detail;
      console.log('Azure avatar event:', { eventType, data });
      
      switch (eventType) {
        case 'sessionStarted':
          setIsAvatarSessionActive(true);
          addNotification('Avatar session started', 'success');
          break;
        case 'sessionStopped':
          setIsAvatarSessionActive(false);
          setIsAvatarSpeaking(false);
          addNotification('Avatar session stopped', 'info');
          break;
        case 'speakingStarted':
          console.log('🎭 Avatar started speaking');
          setIsAvatarSpeaking(true);
          break;
        case 'speakingCompleted':
        case 'speakingStopped':
          console.log('🎭 Avatar stopped speaking');
          setIsAvatarSpeaking(false);
          break;
        case 'sessionError':
        case 'speakingError':
          addNotification(`Avatar error: ${data.error}`, 'warning');
          break;
      }
    };

    window.addEventListener('azureAvatarEvent', handleAzureAvatarEvent);
    
    return () => {
      window.removeEventListener('azureAvatarEvent', handleAzureAvatarEvent);
    };
  }, []);

  // Add notification helper
  const addNotification = useCallback((message: string, type: 'info' | 'warning' | 'success' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Start speech recognition (acts as unmute button)
  const startListening = useCallback(async () => {
    if (!speechServiceRef.current || !botServiceRef.current) {
      setAppState(prev => ({ ...prev, error: 'Services not initialized' }));
      return;
    }

    try {
      // Check microphone permission
      const hasPermission = await speechServiceRef.current.checkMicrophonePermission();
      if (!hasPermission) {
        setAppState(prev => ({ ...prev, error: 'Microphone permission required' }));
        return;
      }

      // Unmute microphone
      setIsMicrophoneMuted(false);

      setAppState(prev => ({
        ...prev,
        isListening: true,
        error: undefined,
        currentMessage: ''
      }));

      await speechServiceRef.current.startRecognition(
        // onRecognizing - real-time text display for immediate feedback
        (text) => {
          // Show ALL text immediately for real-time display (no length restriction)
          setAppState(prev => ({ ...prev, currentMessage: text }));
        },
        // onRecognized - optimized for speed
        async (text) => {
          if (text.trim()) {
            // Check if this is a duplicate or very similar message
            const trimmedText = text.trim().toLowerCase();
            const lastMessage = lastProcessedMessageRef.current.toLowerCase();
            
            // Skip if the message is identical or very similar to the last one
            if (trimmedText === lastMessage || 
                (lastMessage && trimmedText.includes(lastMessage) && trimmedText.length - lastMessage.length < 5)) {
              return;
            }
            
            // Skip if we're already processing a message
            if (isProcessingMessageRef.current) {
              return;
            }
            
            // Clear any existing timeout
            if (messageTimeoutRef.current) {
              clearTimeout(messageTimeoutRef.current);
              messageTimeoutRef.current = null;
            }
            
            // Ultra-reduced debounce timeout for real-time response (150ms instead of 300ms)
            messageTimeoutRef.current = setTimeout(async () => {
              try {
                isProcessingMessageRef.current = true;
                lastProcessedMessageRef.current = text.trim();
                
                // Add user message to conversation
                const userMessage: BotMessage = {
                  id: Date.now().toString(),
                  text,
                  from: { id: 'user' },
                  timestamp: new Date(),
                  type: 'user'
                };
                setConversationHistory(prev => [...prev, userMessage]);

                // Send to bot
                setAppState(prev => ({
                  ...prev,
                  isProcessing: true,
                  currentMessage: text
                }));

                try {
                  await botServiceRef.current!.sendMessage(text);
                } catch (error) {
                  console.error('Failed to send message to bot:', error);
                  setAppState(prev => ({
                    ...prev,
                    error: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
                    isProcessing: false
                  }));
                } finally {
                  // Reset processing flag after a delay
                  setTimeout(() => {
                    isProcessingMessageRef.current = false;
                  }, 1000); // Reduced wait time for faster interaction
                }
              } catch (error) {
                console.error('Error processing message:', error);
                isProcessingMessageRef.current = false;
              }
            }, 150); // Ultra-fast debounce for real-time response
          }
        },
        // onError
        (error) => {
          console.error('Speech recognition error:', error);
          setAppState(prev => ({
            ...prev,
            error: `Speech recognition error: ${error}`,
            isListening: false
          }));
        }
      );
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setAppState(prev => ({
        ...prev,
        error: `Failed to start listening: ${error instanceof Error ? error.message : String(error)}`,
        isListening: false
      }));
    }
  }, [addNotification]);

  // Stop speech recognition (acts as mute button)
  const stopListening = useCallback(async () => {
    if (!speechServiceRef.current) return;

    try {
      // Clear any pending message timeout
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
        messageTimeoutRef.current = null;
      }
      
      // Reset processing flags
      isProcessingMessageRef.current = false;
      
      // Set microphone as muted to prevent automatic restart
      setIsMicrophoneMuted(true);
      
      await speechServiceRef.current.stopRecognition();
      setAppState(prev => ({
        ...prev,
        isListening: false
      }));
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
      setAppState(prev => ({
        ...prev,
        error: `Failed to stop listening: ${error instanceof Error ? error.message : String(error)}`,
        isListening: false
      }));
    }
  }, []);

  // Clear conversation
  const clearConversation = useCallback(() => {
    // Clear any pending message timeout
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    
    // Reset processing flags and last message
    isProcessingMessageRef.current = false;
    lastProcessedMessageRef.current = '';
    
    setConversationHistory([]);
    setAppState(prev => ({
      ...prev,
      currentMessage: '',
      botResponse: '',
      error: undefined
    }));
  }, []);

  // Test avatar speech
  const testAvatarSpeech = useCallback(async () => {
    if (!azureAvatarServiceRef.current || !isAvatarSessionActive) {
      addNotification('Avatar session not active', 'warning');
      return;
    }

    try {
      const testMessage = "Hello! This is a test of the Azure Avatar speech synthesis. I can speak any text you send to me.";
      const avatarConfig = ConfigService.getInstance().getAvatarConfig();
      
      console.log('🎭 Testing avatar speech:', testMessage);
      addNotification('Testing avatar speech...', 'info');
      
      await azureAvatarServiceRef.current.speak(testMessage, avatarConfig.voice);
      addNotification('Avatar speech test completed', 'success');
    } catch (error) {
      console.error('Avatar speech test failed:', error);
      addNotification(`Avatar speech test failed: ${error instanceof Error ? error.message : String(error)}`, 'warning');
    }
  }, [isAvatarSessionActive, addNotification]);

  // Debug microphone setup
  const debugMicrophone = useCallback(async () => {
    if (!speechServiceRef.current) {
      addNotification('Speech service not initialized', 'warning');
      return;
    }

    try {
      const debugResult = await speechServiceRef.current.debugMicrophoneSetup();
      
      console.log('🔍 Microphone Debug Results:', debugResult);
      
      if (debugResult.success) {
        addNotification('Microphone setup: SUCCESS ✅', 'success');
      } else {
        addNotification('Microphone setup: FAILED ❌', 'warning');
      }
      
      // Show detailed results in console
      debugResult.details.forEach(detail => console.log('📋', detail));
      
    } catch (error) {
      console.error('Debug test failed:', error);
      addNotification('Debug test failed', 'warning');
    }
  }, [addNotification]);

  // Toggle language mode between multilingual and English-only
  const toggleLanguageMode = useCallback(async () => {
    const newMode = !isMultiLingual;
    setIsMultiLingual(newMode);
    
    // Update ConfigService with new language settings
    const configService = ConfigService.getInstance();
    configService.updateSettings({
      multiLingualEnabled: newMode,
      recognitionLanguage: newMode ? 'en-US' : 'en-US', // Keep en-US as base
      autoDetectLanguages: newMode ? 
        configService.getMultiLingualConfig().supportedLanguages : 
        ['en-US'] // English-only mode
    });
    
    addNotification(
      newMode ? 'Switched to multilingual mode 🌐' : 'Switched to English-only mode 🇺🇸', 
      'success'
    );
    
    // If currently listening, restart recognition with new language settings
    if (appState.isListening && speechServiceRef.current) {
      try {
        await speechServiceRef.current.stopRecognition();
        // Reinitialize speech service with new settings
        speechServiceRef.current = new SpeechService();
        // Restart listening with new language configuration
        setTimeout(() => {
          if (!isMicrophoneMuted) {
            startListening();
          }
        }, 500);
      } catch (error) {
        console.error('Failed to switch language mode:', error);
        addNotification('Failed to switch language mode', 'warning');
      }
    }
  }, [isMultiLingual, appState.isListening, isMicrophoneMuted, addNotification, startListening]);

  // Handle settings save
  const handleSettingsSave = useCallback((newSettings: any) => {
    const configService = ConfigService.getInstance();
    configService.updateSettings({
      speechKey: newSettings.speechKey,
      speechRegion: newSettings.speechRegion,
      speechEndpoint: newSettings.speechEndpoint,
      directLineSecret: newSettings.directLineSecret,
      avatarCharacter: newSettings.avatarCharacter,
      avatarStyle: newSettings.avatarStyle,
      avatarVoice: newSettings.avatarVoice,
      avatarSubscriptionKey: newSettings.avatarSubscriptionKey,
      avatarRegion: newSettings.avatarRegion,
      avatarEndpoint: newSettings.avatarEndpoint,
    });
    
    addNotification('Settings saved successfully! Please refresh to apply changes.', 'success');
  }, [addNotification]);

  // Handle language change
  // Automatically manage listening state based on avatar speaking
  useEffect(() => {
    const manageListening = async () => {
      // If avatar starts speaking and we're listening, stop listening
      if (isAvatarSpeaking && appState.isListening) {
        console.log('🎭 Avatar started speaking, stopping speech recognition');
        try {
          await speechServiceRef.current?.stopRecognition();
          setAppState(prev => ({
            ...prev,
            isListening: false
          }));
        } catch (error) {
          console.warn('Failed to stop speech recognition when avatar started speaking:', error);
        }
      }
      // If avatar stops speaking and we're connected but not listening, 
      // and microphone is NOT muted, start listening again
      else if (!isAvatarSpeaking && appState.isConnected && !appState.isListening && 
               !appState.isProcessing && !isMicrophoneMuted) {
        console.log('🎭 Avatar stopped speaking, automatically restarting speech recognition');
        try {
          // Wait a short delay to ensure avatar has fully stopped
          setTimeout(async () => {
            if (!appState.isListening && !isAvatarSpeaking && appState.isConnected && !isMicrophoneMuted) {
              await startListening();
            }
          }, 1000); // 1 second delay
        } catch (error) {
          console.warn('Failed to restart speech recognition when avatar stopped speaking:', error);
        }
      }
    };

    manageListening();
  }, [isAvatarSpeaking, appState.isListening, appState.isConnected, appState.isProcessing, isMicrophoneMuted, startListening]);

  // Performance monitoring (for debugging)
  const performanceMetrics = useCallback(() => {
    console.log('🚀 Performance Metrics:');
    console.log('- Listening state:', appState.isListening);
    console.log('- Processing state:', appState.isProcessing);
    console.log('- Avatar speaking:', isAvatarSpeaking);
    console.log('- Avatar session active:', isAvatarSessionActive);
    console.log('- Conversation length:', conversationHistory.length);
    addNotification('Performance metrics logged to console', 'info');
  }, [appState.isListening, appState.isProcessing, isAvatarSpeaking, isAvatarSessionActive, conversationHistory.length, addNotification]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎤 Speech-to-Speech Avatar Assistant</h1>
        <div className="header-controls">
          <button
            className="settings-button-header"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
          <StatusButton 
            isSessionActive={isAvatarSessionActive}
            connectionState={avatarConnectionState}
            isSpeaking={isAvatarSpeaking}
            lastEvent={avatarLastEvent}
          />
        </div>
      </header>

      <main className="app-main">
        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="notifications">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification ${notification.type}`}
              >
                <span>{notification.message}</span>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                  className="notification-close"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error Display */}
        {appState.error && (
          <ErrorBanner 
            error={appState.error} 
            onDismiss={() => setAppState(prev => ({ ...prev, error: undefined }))} 
          />
        )}

        {/* Azure Avatar Section */}
        <AzureAvatarPlayer 
          isSessionActive={isAvatarSessionActive}
          isSpeaking={isAvatarSpeaking}
          onSessionStart={() => addNotification('Avatar session started', 'success')}
          onSessionStop={() => addNotification('Avatar session stopped', 'info')}
          onSpeakingStart={() => {
            console.log('Avatar started speaking (from player)');
            setIsAvatarSpeaking(true);
          }}
          onSpeakingStop={() => {
            console.log('Avatar stopped speaking (from player)');
            setIsAvatarSpeaking(false);
          }}
          onConnectionStateChange={(state) => setAvatarConnectionState(state)}
          onLastEventChange={(event) => setAvatarLastEvent(event)}
        />

        {/* Control Panel */}
        <div className="control-panel">
          <div className="speech-controls">
            <div className="primary-controls">
              {!appState.isListening ? (
                <button
                  className="control-button primary"
                  onClick={startListening}
                  disabled={!appState.isConnected || appState.isProcessing}
                >
                  🎤 Start Listening
                </button>
              ) : (
                <button
                  className="control-button danger listening-active"
                  onClick={stopListening}
                >
                  🛑 Stop Listening
                  <div className="listening-indicator">
                    <div className="listening-pulse"></div>
                  </div>
                </button>
              )}
              
              {/* Language Mode Toggle */}
              <button
                className={`control-button ${isMultiLingual ? 'multilingual' : 'english-only'}`}
                onClick={toggleLanguageMode}
                disabled={appState.isProcessing}
                title={isMultiLingual ? 'Switch to English-only mode' : 'Switch to multilingual mode'}
              >
                {isMultiLingual ? '🌐 Multilingual' : '🇺🇸 English Only'}
              </button>
            </div>
            
            <div className="secondary-controls">
              <button
                className="control-button secondary"
                onClick={clearConversation}
                disabled={appState.isListening}
              >
                🗑️ Clear Chat
              </button>
              
              <button
                className="control-button secondary"
                onClick={() => testAvatarSpeech()}
                disabled={!isAvatarSessionActive}
              >
                🎭 Test Avatar
              </button>
              
              <button
                className="control-button secondary"
                onClick={debugMicrophone}
                disabled={appState.isListening}
                title="Test microphone and speech setup"
              >
                🔍 Debug Microphone
              </button>
              
              <button
                className="control-button secondary"
                onClick={() => performanceMetrics()}
              >
                🚀 Performance
              </button>
              
              <button
                className="control-button secondary"
                onClick={() => setShowTroubleshooting(true)}
              >
                🔧 Diagnostics
              </button>
            </div>
          </div>

          {/* Current Message Display */}
          {appState.currentMessage && (
            <div className="current-message">
              <h4>You said:</h4>
              <p>"{appState.currentMessage}"</p>
              {appState.isProcessing && (
                <div className="processing-indicator">
                  <div className="spinner"></div>
                  <span>Processing...</span>
                </div>
              )}
            </div>
          )}

          {/* Bot Response Display */}
          {appState.botResponse && (
            <div className="bot-response">
              <h4>Bot replied:</h4>
              <p>"{appState.botResponse}"</p>
            </div>
          )}
        </div>

        {/* Conversation History */}
        <ConversationHistory messages={conversationHistory} />
      </main>

      {/* Troubleshooting Modal */}
      <AvatarTroubleshooting 
        show={showTroubleshooting}
        onClose={() => setShowTroubleshooting(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSettingsSave}
      />

      <footer className="app-footer">
        <p>Powered by Azure Speech Services & Copilot Studio</p>
      </footer>
    </div>
  );
};

export default App;

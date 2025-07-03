import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AppState, BotMessage } from './types';
import { SpeechService } from './services/SpeechService';
import { BotService } from './services/BotService';
import { AzureAvatarRealTimeService } from './services/AzureAvatarRealTimeService';
import ConfigService from './services/ConfigService';
import { StatusIndicator, ErrorBanner } from './components/UIComponents';
import { AzureAvatarPlayer } from './components/AzureAvatarPlayer';
import { ConversationHistory } from './components/ConversationHistory';
import { AvatarTroubleshooting } from './components/AvatarTroubleshooting';
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
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  
  // Service instances (using refs to persist across renders)
  const speechServiceRef = useRef<SpeechService | null>(null);
  const botServiceRef = useRef<BotService | null>(null);
  const azureAvatarServiceRef = useRef<AzureAvatarRealTimeService | null>(null);

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
    };
  }, []);

  // Set up bot response listener
  useEffect(() => {
    const handleBotResponse = async (event: Event) => {
      const customEvent = event as CustomEvent<BotMessage>;
      const botMessage = customEvent.detail;
      console.log('Received bot response:', botMessage.text);
      
      setAppState(prev => ({
        ...prev,
        botResponse: botMessage.text,
        isProcessing: false
      }));

      // Update conversation history
      setConversationHistory(prev => [...prev, botMessage]);

      // Immediately speak the bot response using Azure Avatar Real-Time Service
      try {
        if (azureAvatarServiceRef.current && botMessage.text.trim()) {
          console.log('Speaking bot response immediately via Azure Avatar');
          await azureAvatarServiceRef.current.speak(botMessage.text);
        }
      } catch (error) {
        console.error('Azure avatar speech failed:', error);
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
          setIsAvatarSpeaking(true);
          break;
        case 'speakingCompleted':
        case 'speakingStopped':
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

  // Start speech recognition
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

      setAppState(prev => ({
        ...prev,
        isListening: true,
        error: undefined,
        currentMessage: ''
      }));

      await speechServiceRef.current.startRecognition(
        // onRecognizing
        (text) => {
          setAppState(prev => ({ ...prev, currentMessage: text }));
        },
        // onRecognized
        async (text) => {
          if (text.trim()) {
            console.log('Speech recognized:', text);
            
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
            }
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
  }, []);

  // Stop speech recognition
  const stopListening = useCallback(async () => {
    if (!speechServiceRef.current) return;

    try {
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
    setConversationHistory([]);
    setAppState(prev => ({
      ...prev,
      currentMessage: '',
      botResponse: '',
      error: undefined
    }));
  }, []);

  // Add notification helper
  const addNotification = useCallback((message: string, type: 'info' | 'warning' | 'success' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎤 Copilot Agent Avatar/h1>
        <StatusIndicator isConnected={appState.isConnected} />
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
          onSpeakingStart={() => console.log('Avatar started speaking')}
          onSpeakingStop={() => console.log('Avatar stopped speaking')}
        />

        {/* Control Panel */}
        <div className="control-panel">
          <div className="speech-controls">
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
                className="control-button danger"
                onClick={stopListening}
              >
                🛑 Stop Listening
              </button>
            )}
            
            <button
              className="control-button secondary"
              onClick={clearConversation}
              disabled={appState.isListening}
            >
              🗑️ Clear Chat
            </button>
            
            <button
              className="control-button secondary"
              onClick={() => setShowTroubleshooting(true)}
            >
              🔧 Diagnostics
            </button>
          </div>

          {/* Current Message Display */}
          {appState.currentMessage && (
            <div className="current-message">
              <h4>You said:</h4>
              <p>"{appState.currentMessage}"</p>
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

      <footer className="app-footer">
        <p>Powered by Azure Speech Services & Copilot Studio</p>
      </footer>
    </div>
  );
};

export default App;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AppState, BotMessage } from './types';
import { SpeechService } from './services/SpeechService';
import { BotService } from './services/BotService';
import { AzureAvatarRealTimeService } from './services/AzureAvatarRealTimeService';
import ConfigService from './services/ConfigService';
import { ErrorBanner } from './components/UIComponents';
import { AzureAvatarPlayer } from './components/AzureAvatarPlayer.modern';
import { ConversationHistory } from './components/ConversationHistory';
import { ChatInput } from './components/ChatInput';
import './App.modern.css';

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
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(true); // Microphone mute state - START MUTED for better UX
  
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

        // Pre-initialize speech recognizer for faster startup
        await speechServiceRef.current.preInitializeRecognizer();

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

        // Avatar session started - auto-start will be handled by onSessionStart callback

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
  // CRITICAL FLOW STEP 3: Bridge from Copilot Studio to Avatar System
  useEffect(() => {
    const handleBotResponse = async (event: Event) => {
      const customEvent = event as CustomEvent<BotMessage>;
      const botMessage = customEvent.detail;  // BOT RESPONSE FROM COPILOT STUDIO
      
      setAppState(prev => ({
        ...prev,
        botResponse: botMessage.text,
        isProcessing: false
      }));

      // Update conversation history
      setConversationHistory(prev => [...prev, botMessage]);

      // THE MAGIC BRIDGE: Convert Copilot Studio text to Avatar speech + video
      // COPILOT STUDIO to AVATAR CONVERSION HAPPENS HERE
      try {
        if (azureAvatarServiceRef.current && botMessage.text.trim()) {
          // Check if avatar is already speaking and log queue status
          const currentlySpeaking = azureAvatarServiceRef.current.isSpeakingNow();
          const queueLength = azureAvatarServiceRef.current.getQueueLength();
          const deviceId = azureAvatarServiceRef.current.getDeviceSessionId();
          
          if (currentlySpeaking || queueLength > 0) {
            console.log(`Device ${deviceId} - Avatar busy - Speaking: ${currentlySpeaking}, Queue: ${queueLength}`);
          }
          
          // CRITICAL CALL: Convert bot text to live avatar speech with lip-sync
          // This single line transforms Copilot Studio text into a speaking avatar
          await azureAvatarServiceRef.current.speakWithAutoVoice(botMessage.text, 'en-US');
        }
      } catch (error) {
        setAppState(prev => ({
          ...prev,
          error: `Avatar speech failed: ${error instanceof Error ? error.message : String(error)}`
        }));
        addNotification('Failed to speak response', 'warning');
      }
    };

    // LISTEN FOR BOT RESPONSES: This catches the custom event from BotService
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
          // Notification will be handled by onSessionStart callback to avoid duplicates
          break;
        case 'sessionStopped':
          setIsAvatarSessionActive(false);
          setIsAvatarSpeaking(false);
          // Notification will be handled by onSessionStop callback to avoid duplicates
          break;
        case 'speakingStarted':
          console.log('Avatar started speaking');
          setIsAvatarSpeaking(true);
          break;
        case 'speakingCompleted':
        case 'speakingStopped':
          console.log('Avatar stopped speaking');
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
    
    // Auto-remove notification after 2.5 seconds (faster dismissal)
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 2500);
  }, []);

  // Start speech recognition (acts as unmute button)
  const startListening = useCallback(async () => {
    console.log('🎤 startListening called - checking conditions...');
    console.log('Services available:', {
      speech: !!speechServiceRef.current,
      bot: !!botServiceRef.current,
      isListening: appState.isListening,
      isMuted: isMicrophoneMuted
    });

    if (!speechServiceRef.current || !botServiceRef.current) {
      setAppState(prev => ({ ...prev, error: 'Services not initialized' }));
      return;
    }

    // Check if recognition is already active
    if (speechServiceRef.current.isRecognitionActive()) {
      console.log('🎤 Speech recognition already active, updating UI state');
      setAppState(prev => ({ ...prev, isListening: true }));
      setIsMicrophoneMuted(false);
      return;
    }

    try {
      // Enhanced microphone permission check with better error messages
      console.log('🎤 Checking microphone permission...');
      console.log('Current protocol:', window.location.protocol);
      console.log('Current host:', window.location.host);
      
      // Check if we're on HTTPS (required for microphone access on remote domains)
      if (window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost')) {
        const httpsUrl = window.location.href.replace('http:', 'https:');
        setAppState(prev => ({ 
          ...prev, 
          error: `Microphone access requires HTTPS. Please visit: ${httpsUrl}` 
        }));
        addNotification('🔒 Redirecting to HTTPS for microphone access...', 'info');
        // Redirect to HTTPS
        window.location.href = httpsUrl;
        return;
      }

      const hasPermission = await speechServiceRef.current.checkMicrophonePermission();
      if (!hasPermission) {
        setAppState(prev => ({ 
          ...prev, 
          error: 'Microphone permission required. Please allow microphone access when prompted.' 
        }));
        addNotification('🎤 Please allow microphone access in your browser', 'warning');
        return;
      }

      // Unmute microphone and update state BEFORE starting recognition
      setIsMicrophoneMuted(false);
      setAppState(prev => ({
        ...prev,
        isListening: true,
        error: undefined,
        currentMessage: ''
      }));

      console.log('🎤 Starting speech recognition service...');

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
            
            // Ultra-reduced debounce timeout for real-time response (100ms instead of 150ms)
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
      
      console.log('🎤 Speech recognition started successfully');
      addNotification('🟢 Microphone LIVE - Start speaking!', 'success');
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
    console.log('🔇 stopListening called');
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
      
      console.log('🔇 Speech recognition stopped successfully');
      addNotification('� Microphone MUTED - Click to unmute for voice chat', 'info');
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

  // Send message function for typing
  const sendMessage = useCallback(async (message: string) => {
    if (!botServiceRef.current || !message.trim()) return;
    
    setAppState(prev => ({ ...prev, isProcessing: true, currentMessage: message }));
    
    // Add user message to history
    const userMessage: BotMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: message,
      from: { id: 'user', name: 'You' },
      timestamp: new Date()
    };
    setConversationHistory(prev => [...prev, userMessage]);
    
    try {
      await botServiceRef.current.sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      setAppState(prev => ({ 
        ...prev, 
        error: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        isProcessing: false
      }));
    }
  }, []);

  // Automatically manage listening state based on avatar speaking
  // REMOVED: Auto-mute functionality - microphone stays on even when avatar speaks
  // Manual mute functionality remains through the mute button

  // Video autoplay is now handled automatically without user interaction required
  // Microphone starts muted - user manually unmutes when ready

  return (
    <div className="app">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="notifications">
          {notifications.map((notification) => (
            <div key={notification.id} className={`notification ${notification.type}`}>
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

      {/* Main Layout */}
      <div className="app-layout">
        {/* Unified Container - Seamlessly integrating avatar and chat */}
        <div className="unified-container">
          {/* Avatar Section */}
          <div className="avatar-section">
            <AzureAvatarPlayer 
              isSessionActive={isAvatarSessionActive}
              isSpeaking={isAvatarSpeaking}
              onSessionStart={() => {
                addNotification('🎤 Avatar ready! Unmute to Talk to Avatar', 'success');
                // Microphone starts muted - user will manually unmute when ready
                console.log('🎤 Avatar session started - microphone is muted by default');
              }}
              onSessionStop={() => addNotification('Avatar session stopped', 'info')}
              onSpeakingStart={() => {
                console.log('Avatar started speaking (from player)');
                setIsAvatarSpeaking(true);
                // REMOVED: No longer stopping speech recognition when avatar speaks
              }}
              onSpeakingStop={() => {
                console.log('Avatar stopped speaking (from player)');
                setIsAvatarSpeaking(false);
                // REMOVED: No longer auto-restarting speech recognition when avatar stops
              }}
              onConnectionStateChange={(state) => setAvatarConnectionState(state)}
              onLastEventChange={(event) => setAvatarLastEvent(event)}
            />
            
            {/* Status Indicator */}
            <div className="status-indicator">
              <div className={`status-dot ${isAvatarSessionActive ? 'active' : 'inactive'}`}></div>
              <span>{isAvatarSpeaking ? 'Speaking' : isAvatarSessionActive ? 'Ready' : 'Connecting'}</span>
            </div>
          </div>

          {/* Chat Section */}
          <div className="chat-section">
            <ConversationHistory messages={conversationHistory} />
            
            {/* Input Area */}
            <div className="input-area">
              <ChatInput 
                onSendMessage={sendMessage}
                isProcessing={appState.isProcessing}
                isListening={appState.isListening}
                onStartListening={startListening}
                onStopListening={stopListening}
                isConnected={appState.isConnected}
                onClearChat={clearConversation}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

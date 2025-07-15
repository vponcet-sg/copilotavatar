import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  isConnected: boolean;
  onClearChat: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isProcessing,
  isListening,
  onStartListening,
  onStopListening,
  isConnected,
  onClearChat
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isProcessing) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="input-group">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message or use voice..."
            className="chat-input"
            disabled={isProcessing}
            rows={1}
          />
          
          <div className="input-actions">
            {/* Voice Button with Clear Mute/Unmute States */}
            <button
              type="button"
              className={`voice-button ${isListening ? 'listening' : 'muted'}`}
              onClick={isListening ? onStopListening : onStartListening}
              disabled={!isConnected || isProcessing}
              title={isListening ? 'Mute microphone' : 'Unmute microphone to speak'}
            >
              {isListening ? (
                <div className="listening-indicator">
                  <div className="pulse"></div>
                  <span className="mic-icon">🎤</span>
                  <span className="mic-status">LIVE</span>
                </div>
              ) : (
                <div className="muted-indicator">
                  <span className="mic-icon">🎤</span>
                  <span className="mic-status">MUTED</span>
                  <span className="slash-overlay">/</span>
                </div>
              )}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              className="send-button"
              disabled={!message.trim() || isProcessing}
              title="Send message"
            >
              {isProcessing ? (
                <div className="spinner"></div>
              ) : (
                '→'
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button
          type="button"
          className="clear-button"
          onClick={onClearChat}
          disabled={isProcessing}
          title="Clear conversation"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

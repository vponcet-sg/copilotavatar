import { useRef, useEffect } from 'react';
import type { BotMessage } from '../types';

interface ConversationHistoryProps {
  messages: BotMessage[];
}

export const ConversationHistory = ({ messages }: ConversationHistoryProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="conversation-history empty">
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h3>Welcome to Your AI Assistant</h3>
          <p>Start a conversation by typing a message or using voice input</p>
          <div className="empty-features">
            <div className="feature">
              <span className="feature-icon">🎤</span>
              <span>Voice Recognition</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🎭</span>
              <span>AI Avatar</span>
            </div>
            <div className="feature">
              <span className="feature-icon">⚡</span>
              <span>Real-time Responses</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-history">
      <div className="messages-container">
        {messages.map((message, index) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-content">
              <p>{message.text}</p>
            </div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

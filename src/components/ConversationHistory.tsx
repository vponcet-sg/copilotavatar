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
          <div className="empty-icon">�</div>
          <p>Start a conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-history">
      <div className="messages-container">
        {messages.map((message) => (
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

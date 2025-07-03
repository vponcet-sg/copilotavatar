import { useRef } from 'react';
import type { BotMessage } from '../types';

interface ConversationHistoryProps {
  messages: BotMessage[];
}

export const ConversationHistory = ({ messages }: ConversationHistoryProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (messages.length === 0) {
    return (
      <div className="conversation-history">
        <div className="conversation-header">
          <h3>💬 Conversation</h3>
        </div>
        <div className="empty-conversation">
          <div className="empty-icon">💭</div>
          <p>Start a conversation by clicking "Start Listening"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-history">
      <div className="conversation-header">
        <h3>💬 Conversation</h3>
        <span className="message-count">{messages.length} messages</span>
      </div>
      <div className="messages-container">
        <div className="messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message-bubble ${message.type}`}
            >
              <div className="message-avatar">
                {message.type === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-content-wrapper">
                <div className="message-header">
                  <span className="sender-name">
                    {message.type === 'user' ? 'You' : 'Assistant'}
                  </span>
                  <span className="message-timestamp">
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <div className="message-text">
                  {message.text}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

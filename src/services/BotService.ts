import { DirectLine, ConnectionStatus } from 'botframework-directlinejs';
import type { BotMessage, ConversationState } from '../types';
import { v4 as uuidv4 } from 'uuid';
import ConfigService from './ConfigService';

export class BotService {
  private directLine: DirectLine | null = null;
  private conversationState: ConversationState = { messages: [] };
  private isConnected = false;

  constructor() {}

  /**
   * Initialize connection with the bot
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const config = ConfigService.getInstance().getBotConfig();
        
        // Initialize Direct Line with secret (in production, use token from backend)
        this.directLine = new DirectLine({
          secret: config.directLineSecret,
          webSocket: true
        });

        // Monitor connection status
        this.directLine.connectionStatus$.subscribe({
          next: (status) => {
            console.log('Bot connection status:', this.getConnectionStatusText(status));
            
            switch (status) {
              case ConnectionStatus.Uninitialized:
                console.log('Connection uninitialized');
                break;
              case ConnectionStatus.Connecting:
                console.log('Connecting to bot...');
                break;
              case ConnectionStatus.Online:
                console.log('Connected to bot successfully');
                this.isConnected = true;
                resolve();
                break;
              case ConnectionStatus.FailedToConnect:
                console.error('Failed to connect to bot');
                this.isConnected = false;
                reject(new Error('Failed to connect to bot'));
                break;
              case ConnectionStatus.Ended:
                console.log('Bot conversation ended');
                this.isConnected = false;
                break;
              default:
                console.log('Unknown connection status:', status);
            }
          },
          error: (error) => {
            console.error('Bot connection error:', error);
            this.isConnected = false;
            reject(error);
          }
        });

        // Set up activity listener
        this.setupActivityListener();

      } catch (error) {
        console.error('Failed to initialize bot connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Send message to the bot
   */
  public async sendMessage(text: string): Promise<void> {
    if (!this.directLine || !this.isConnected) {
      throw new Error('Bot is not connected');
    }

    const userMessage: BotMessage = {
      id: uuidv4(),
      text,
      from: { id: 'user' },
      timestamp: new Date(),
      type: 'user'
    };

    // Add user message to conversation state
    this.conversationState.messages.push(userMessage);

    // Send activity to bot
    return new Promise((resolve, reject) => {
      this.directLine!.postActivity({
        from: { id: 'user' },
        type: 'message',
        text: text
      }).subscribe({
        next: (id) => {
          console.log('Message sent to bot, activity ID:', id);
          resolve();
        },
        error: (error) => {
          console.error('Failed to send message to bot:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Set up listener for bot responses
   * CRITICAL FLOW STEP 1: Receiving Copilot Studio Bot Responses
   */
  private setupActivityListener(): void {
    if (!this.directLine) return;

    this.directLine.activity$.subscribe({
      next: (activity) => {
        console.log('Received activity from bot:', activity);
        
        // COPILOT STUDIO RESPONSE: Only process messages from the bot
        if (activity.from && activity.from.id !== 'user' && activity.type === 'message') {
          const botMessage: BotMessage = {
            id: activity.id || uuidv4(),
            text: activity.text || '',              // THE BOT'S TEXT RESPONSE
            from: { 
              id: activity.from.id,
              name: activity.from.name 
            },
            timestamp: new Date(activity.timestamp || Date.now()),
            type: 'bot'
          };

          this.conversationState.messages.push(botMessage);
          
          // TRIGGER AVATAR SPEECH: Emit custom event for bot response
          this.emitBotResponse(botMessage);
        }
      },
      error: (error) => {
        console.error('Error receiving bot activity:', error);
      }
    });
  }

  /**
   * Emit bot response event
   * CRITICAL FLOW STEP 2: Broadcasting Bot Response to Avatar System
   */
  private emitBotResponse(message: BotMessage): void {
    // EVENT BRIDGE: This custom event triggers avatar speech in App.tsx
    const event = new CustomEvent('botResponse', { detail: message });
    window.dispatchEvent(event);  // THE MAGIC BRIDGE TO AVATAR SYSTEM
  }

  /**
   * Get conversation history
   */
  public getConversationHistory(): BotMessage[] {
    return [...this.conversationState.messages];
  }

  /**
   * Get connection status text
   */
  private getConnectionStatusText(status: ConnectionStatus): string {
    switch (status) {
      case ConnectionStatus.Uninitialized: return 'Uninitialized';
      case ConnectionStatus.Connecting: return 'Connecting';
      case ConnectionStatus.Online: return 'Online';
      case ConnectionStatus.FailedToConnect: return 'Failed to Connect';
      case ConnectionStatus.Ended: return 'Ended';
      default: return 'Unknown';
    }
  }

  /**
   * Check if bot is connected
   */
  public isConnectedToBoot(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from bot
   */
  public disconnect(): void {
    if (this.directLine) {
      this.directLine.end();
      this.directLine = null;
    }
    this.isConnected = false;
    this.conversationState = { messages: [] };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.disconnect();
  }
}

// Azure Speech SDK types
export interface SpeechConfig {
  speechKey: string;
  speechRegion: string;
  speechEndpoint: string;
  recognitionLanguage?: string;
  synthesisLanguage?: string;
  synthesisVoice?: string;
}

// Language support types - English only
export interface LanguageOption {
  code: string;
  name: string;
  voice: string;
  region: string;
}

// Direct Line Bot types
export interface BotConfig {
  directLineSecret: string;
}

export interface BotMessage {
  id: string;
  text: string;
  from: {
    id: string;
    name?: string;
  };
  timestamp: Date;
  type: 'user' | 'bot';
}

// Avatar types
export interface AvatarConfig {
  character: string;
  style: string;
  voice: string;
}

export interface AvatarApiConfig {
  subscriptionKey: string;
  region: string;
  endpoint: string;
}

export interface AvatarSynthesisJob {
  id: string;
  status: 'Running' | 'Succeeded' | 'Failed';
  downloadUrl?: string;
}

// App state types
export interface AppState {
  isListening: boolean;
  isProcessing: boolean;
  isConnected: boolean;
  currentMessage: string;
  botResponse: string;
  error?: string;
}

export interface ConversationState {
  conversationId?: string;
  messages: BotMessage[];
}

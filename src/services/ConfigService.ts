import type { SpeechConfig, BotConfig, AvatarConfig, AvatarApiConfig, LanguageOption } from '../types';

interface DynamicConfig {
  speechKey?: string;
  speechRegion?: string;
  speechEndpoint?: string;
  directLineSecret?: string;
  avatarCharacter?: string;
  avatarStyle?: string;
  avatarVoice?: string;
  avatarSubscriptionKey?: string;
  avatarRegion?: string;
  avatarEndpoint?: string;
  // Multi-lingual settings - removed, English-only
  recognitionLanguage?: string;
  synthesisLanguage?: string;
  synthesisVoice?: string;
}

class ConfigService {
  private static instance: ConfigService;
  private dynamicConfig: DynamicConfig = {};

  private constructor() {
    // Load saved settings from localStorage
    this.loadSettings();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('app-settings');
      if (saved) {
        this.dynamicConfig = JSON.parse(saved);
      }
    } catch (error) {
      // Failed to load settings from localStorage
    }
  }

  public updateSettings(config: DynamicConfig): void {
    this.dynamicConfig = { ...this.dynamicConfig, ...config };
    try {
      localStorage.setItem('app-settings', JSON.stringify(this.dynamicConfig));
    } catch (error) {
      // Failed to save settings to localStorage
    }
  }

  public getSpeechConfig(): SpeechConfig {
    const speechKey = this.dynamicConfig.speechKey || import.meta.env.VITE_SPEECH_KEY;
    const speechRegion = this.dynamicConfig.speechRegion || import.meta.env.VITE_SPEECH_REGION;
    const speechEndpoint = this.dynamicConfig.speechEndpoint || import.meta.env.VITE_SPEECH_ENDPOINT;

    if (!speechKey || !speechRegion || !speechEndpoint) {
      throw new Error('Missing Azure Speech Service configuration. Please check your environment variables or settings.');
    }

    return {
      speechKey,
      speechRegion,
      speechEndpoint,
      recognitionLanguage: this.dynamicConfig.recognitionLanguage || 'en-US',
      synthesisLanguage: this.dynamicConfig.synthesisLanguage || 'en-US',
      synthesisVoice: this.dynamicConfig.synthesisVoice || 'en-US-JennyNeural'
    };
  }

  public getAvailableLanguages(): LanguageOption[] {
    // English-only support
    return [
      { code: 'en-US', name: 'English (US)', voice: 'en-US-JennyNeural', region: 'us' },
      { code: 'en-GB', name: 'English (UK)', voice: 'en-GB-SoniaNeural', region: 'gb' }
    ];
  }

  public getBotConfig(): BotConfig {
    const directLineSecret = this.dynamicConfig.directLineSecret || import.meta.env.VITE_DIRECTLINE_SECRET;

    if (!directLineSecret) {
      throw new Error('Missing Direct Line secret. Please check your environment variables or settings.');
    }

    return {
      directLineSecret
    };
  }

  public getAvatarConfig(): AvatarConfig {
    return {
      character: this.dynamicConfig.avatarCharacter || import.meta.env.VITE_AVATAR_CHARACTER || 'lisa',
      style: this.dynamicConfig.avatarStyle || import.meta.env.VITE_AVATAR_STYLE || 'graceful-sitting',
      voice: this.dynamicConfig.avatarVoice || import.meta.env.VITE_AVATAR_VOICE || 'en-US-JennyNeural'
    };
  }

  public getAvatarApiConfig(): AvatarApiConfig {
    const subscriptionKey = this.dynamicConfig.avatarSubscriptionKey || import.meta.env.VITE_AVATAR_SUBSCRIPTION_KEY;
    const region = this.dynamicConfig.avatarRegion || import.meta.env.VITE_AVATAR_REGION;
    const endpoint = this.dynamicConfig.avatarEndpoint || import.meta.env.VITE_AVATAR_ENDPOINT;

    if (!subscriptionKey || !region || !endpoint) {
      throw new Error('Missing Azure Avatar Real-Time API configuration. Please check your environment variables or settings.');
    }

    return {
      subscriptionKey,
      region,
      endpoint
    };
  }

  public validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      this.getSpeechConfig();
    } catch (error) {
      errors.push('Speech Service configuration is invalid');
    }

    try {
      this.getBotConfig();
    } catch (error) {
      errors.push('Bot configuration is invalid');
    }

    try {
      this.getAvatarApiConfig();
    } catch (error) {
      errors.push('Avatar API configuration is invalid');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default ConfigService;

import type { SpeechConfig, BotConfig, AvatarConfig, AvatarApiConfig, LanguageOption, MultiLingualConfig } from '../types';

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
  // Multi-lingual settings
  recognitionLanguage?: string;
  autoDetectLanguages?: string[];
  synthesisLanguage?: string;
  synthesisVoice?: string;
  multiLingualEnabled?: boolean;
  primaryLanguage?: string;
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
      console.error('Failed to load settings from localStorage:', error);
    }
  }

  public updateSettings(config: DynamicConfig): void {
    this.dynamicConfig = { ...this.dynamicConfig, ...config };
    try {
      localStorage.setItem('app-settings', JSON.stringify(this.dynamicConfig));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
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
      autoDetectLanguages: this.dynamicConfig.autoDetectLanguages || this.getDefaultAutoDetectLanguages(),
      synthesisLanguage: this.dynamicConfig.synthesisLanguage || 'en-US',
      synthesisVoice: this.dynamicConfig.synthesisVoice || 'en-US-JennyMultilingualNeural'
    };
  }

  public getMultiLingualConfig(): MultiLingualConfig {
    return {
      autoDetect: this.dynamicConfig.multiLingualEnabled ?? false, // Default to English-only
      primaryLanguage: this.dynamicConfig.primaryLanguage || 'en-US',
      supportedLanguages: this.dynamicConfig.autoDetectLanguages || this.getDefaultAutoDetectLanguages(),
      languageOptions: this.getAvailableLanguages()
    };
  }

  private getDefaultAutoDetectLanguages(): string[] {
    // Azure Speech Service DetectContinuous mode supports maximum 10 languages
    // Using the most commonly spoken languages worldwide for optimal coverage
    return [
      'en-US', // English (US) - Most widely used
      'es-ES', // Spanish (Spain) - 500M+ speakers
      'fr-FR', // French (France) - 280M+ speakers
      'de-DE', // German (Germany) - 100M+ speakers
      'it-IT', // Italian (Italy) - 65M+ speakers
      'pt-BR', // Portuguese (Brazil) - 230M+ speakers
      'ja-JP', // Japanese (Japan) - 125M+ speakers
      'ko-KR', // Korean (South Korea) - 77M+ speakers
      'zh-CN', // Chinese (Mainland China) - 900M+ speakers
      'ar-SA'  // Arabic (Saudi Arabia) - 420M+ speakers
      // Note: Limited to 10 languages due to Azure DetectContinuous mode restriction
    ];
  }

  public getAvailableLanguages(): LanguageOption[] {
    return [
      { code: 'en-US', name: 'English (US)', voice: 'en-US-JennyMultilingualNeural', region: 'us' },
      { code: 'en-GB', name: 'English (UK)', voice: 'en-GB-SoniaNeural', region: 'gb' },
      { code: 'es-ES', name: 'Spanish (Spain)', voice: 'es-ES-ElviraNeural', region: 'es' },
      { code: 'es-MX', name: 'Spanish (Mexico)', voice: 'es-MX-DaliaNeural', region: 'mx' },
      { code: 'fr-FR', name: 'French (France)', voice: 'fr-FR-DeniseNeural', region: 'fr' },
      { code: 'fr-CA', name: 'French (Canada)', voice: 'fr-CA-SylvieNeural', region: 'ca' },
      { code: 'de-DE', name: 'German (Germany)', voice: 'de-DE-KatjaNeural', region: 'de' },
      { code: 'it-IT', name: 'Italian (Italy)', voice: 'it-IT-ElsaNeural', region: 'it' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)', voice: 'pt-BR-FranciscaNeural', region: 'br' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)', voice: 'pt-PT-RaquelNeural', region: 'pt' },
      { code: 'ja-JP', name: 'Japanese (Japan)', voice: 'ja-JP-NanamiNeural', region: 'jp' },
      { code: 'ko-KR', name: 'Korean (South Korea)', voice: 'ko-KR-SunHiNeural', region: 'kr' },
      { code: 'zh-CN', name: 'Chinese (Mainland)', voice: 'zh-CN-XiaoxiaoNeural', region: 'cn' },
      { code: 'zh-HK', name: 'Chinese (Hong Kong)', voice: 'zh-HK-HiuMaanNeural', region: 'hk' },
      { code: 'zh-TW', name: 'Chinese (Taiwan)', voice: 'zh-TW-HsiaoChenNeural', region: 'tw' },
      { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', voice: 'ar-SA-ZariyahNeural', region: 'sa' },
      { code: 'hi-IN', name: 'Hindi (India)', voice: 'hi-IN-SwaraNeural', region: 'in' },
      { code: 'th-TH', name: 'Thai (Thailand)', voice: 'th-TH-PremwadeeNeural', region: 'th' },
      { code: 'vi-VN', name: 'Vietnamese (Vietnam)', voice: 'vi-VN-HoaiMyNeural', region: 'vn' },
      { code: 'nl-NL', name: 'Dutch (Netherlands)', voice: 'nl-NL-ColetteNeural', region: 'nl' },
      { code: 'sv-SE', name: 'Swedish (Sweden)', voice: 'sv-SE-SofieNeural', region: 'se' },
      { code: 'da-DK', name: 'Danish (Denmark)', voice: 'da-DK-ChristelNeural', region: 'dk' },
      { code: 'no-NO', name: 'Norwegian (Norway)', voice: 'nb-NO-PernilleNeural', region: 'no' },
      { code: 'fi-FI', name: 'Finnish (Finland)', voice: 'fi-FI-SelmaNeural', region: 'fi' },
      { code: 'ru-RU', name: 'Russian (Russia)', voice: 'ru-RU-SvetlanaNeural', region: 'ru' },
      { code: 'pl-PL', name: 'Polish (Poland)', voice: 'pl-PL-ZofiaNeural', region: 'pl' },
      { code: 'tr-TR', name: 'Turkish (Turkey)', voice: 'tr-TR-EmelNeural', region: 'tr' },
      { code: 'he-IL', name: 'Hebrew (Israel)', voice: 'he-IL-HilaNeural', region: 'il' }
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

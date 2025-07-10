import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import ConfigService from './ConfigService';

/**
 * Azure Speech Service implementation for English-only speech recognition
 * Features:
 * - English speech recognition and synthesis
 * - Azure Speech SDK best practices for error handling and performance
 * 
 * References:
 * - https://docs.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech
 */

export class SpeechService {
  private speechConfig: SpeechSDK.SpeechConfig;
  private audioConfig: SpeechSDK.AudioConfig | null = null;
  private speechRecognizer: SpeechSDK.SpeechRecognizer | null = null;
  private speechSynthesizer: SpeechSDK.SpeechSynthesizer | null = null;
  private currentLanguage: string = 'en-US';
  private detectedLanguage: string | null = null;
  private microphoneKeepAliveInterval: NodeJS.Timeout | null = null;

  constructor() {
    const config = ConfigService.getInstance().getSpeechConfig();
    
    // Initialize Speech SDK configuration
    this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(config.speechKey, config.speechRegion);
    
    // Set to English-only
    this.currentLanguage = config.recognitionLanguage || 'en-US';
    
    // Azure Speech SDK configuration for English-only
    console.log('�🇸 Azure Speech SDK: English-only mode enabled');
    
    // Performance optimizations for Azure Speech SDK
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
      '2000' // Reduced from 3000ms for faster startup
    );
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
      '1000' // Reduced from 1500ms for faster response
    );
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
      '500' // Reduced from 1000ms for faster voice detection
    );
    
    // Microphone configuration
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_RecoMode,
      'CONVERSATION' // Conversation mode for continuous listening
    );
    
    // Enable continuous recognition
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_EnableAudioLogging,
      'false' // Disable audio logging to reduce overhead
    );
    
    // Add additional properties to improve speech detection
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceResponse_ProfanityOption,
      'Raw' // Don't filter content
    );
    
    // Set output format to simple for better compatibility
    this.speechConfig.outputFormat = SpeechSDK.OutputFormat.Simple;
    
    // Set synthesis defaults for English
    this.speechConfig.speechSynthesisLanguage = config.synthesisLanguage || 'en-US';
    this.speechConfig.speechSynthesisVoiceName = config.synthesisVoice || 'en-US-JennyNeural';
    
    // Configure optimized microphone settings
    this.configureOptimizedMicrophone();
  }

  /**
   * Configure always-on microphone settings for instant voice capture
   */
  private configureOptimizedMicrophone(): void {
    // Enhanced audio configuration for always-on microphone
    this.audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    
    // Additional optimizations for always-on mode
    console.log('🎤 Microphone configured for English-only instant voice capture');
    
    // Pre-warm the microphone connection to reduce startup delay
    this.preWarmMicrophone();
  }

  /**
   * Pre-warm microphone connection to reduce speech recognition startup delay
   */
  private async preWarmMicrophone(): Promise<void> {
    try {
      console.log('🔥 Pre-warming microphone connection...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Optimize for speech recognition
        } 
      });
      
      // Keep connection alive briefly then close
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Microphone pre-warming completed');
      }, 200);
    } catch (error) {
      console.warn('Microphone pre-warming failed (non-critical):', error);
    }
  }

  /**
   * Pre-initialize speech recognizer for faster startup
   */
  public async preInitializeRecognizer(): Promise<void> {
    try {
      console.log('🚀 Pre-initializing speech recognizer...');
      
      // Create a temporary recognizer to warm up the connection
      const tempConfig = SpeechSDK.SpeechConfig.fromSubscription(
        this.speechConfig.authorizationToken || this.speechConfig.subscriptionKey,
        this.speechConfig.region
      );
      tempConfig.speechRecognitionLanguage = 'en-US';
      
      const tempRecognizer = new SpeechSDK.SpeechRecognizer(tempConfig, this.audioConfig!);
      
      // Clean up immediately
      setTimeout(() => {
        tempRecognizer.close();
        console.log('✅ Speech recognizer pre-initialization completed');
      }, 100);
    } catch (error) {
      console.warn('Speech recognizer pre-initialization failed (non-critical):', error);
    }
  }

  /**
   * Check if speech recognition is currently active
   */
  public isRecognitionActive(): boolean {
    return this.speechRecognizer !== null;
  }

  /**
   * Start continuous speech recognition with English-only support
   */
  public startRecognition(
    onRecognizing: (text: string, language?: string) => void,
    onRecognized: (text: string, language?: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use English-only mode
        console.log('🇺🇸 Setting up ENGLISH-ONLY speech recognizer');
        this.speechConfig.speechRecognitionLanguage = 'en-US';
        this.speechRecognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig!);
        console.log('✅ English-only speech recognizer ready');

        // Event handlers - optimized for real-time text display with debugging
        this.speechRecognizer.recognizing = (_sender, e) => {
          console.log('🎤 Recognizing event:', {
            reason: e.result.reason,
            text: e.result.text,
            length: e.result.text.length
          });
          
          // Real-time display: show text immediately, even single characters
          if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech && e.result.text.length > 0) {
            // Immediate text display for real-time feedback
            onRecognizing(e.result.text, this.detectedLanguage || this.currentLanguage);
            
            // Quick language detection for longer text
            if (e.result.text.length > 2) {
              const detectedLanguage = this.getDetectedLanguage(e.result);
              if (detectedLanguage && detectedLanguage !== this.detectedLanguage) {
                this.detectedLanguage = detectedLanguage;
                console.log('🌐 Language detected:', detectedLanguage);
              }
            }
          }
        };

        this.speechRecognizer.recognized = (_sender, e) => {
          console.log('✅ Recognized event:', {
            reason: e.result.reason,
            reasonString: this.getReasonString(e.result.reason),
            text: e.result.text,
            hasText: !!e.result.text.trim(),
            duration: e.result.duration,
            offset: e.result.offset
          });
          
          // Handle recognition results using Azure Speech SDK best practices
          switch (e.result.reason) {
            case SpeechSDK.ResultReason.RecognizedSpeech:
              if (e.result.text.trim()) {
                // Process final result with enhanced language detection
                const detectedLanguage = this.getDetectedLanguage(e.result);
                if (detectedLanguage && detectedLanguage !== this.detectedLanguage) {
                  this.detectedLanguage = detectedLanguage;
                  
                  // Immediate voice update for next recognition
                  this.updateSynthesisVoiceForLanguage(detectedLanguage);
                }
                onRecognized(e.result.text, detectedLanguage || this.currentLanguage);
              } else {
                console.log('⚠️ Empty speech recognized - microphone detects sound but no clear speech');
              }
              break;
              
            case SpeechSDK.ResultReason.NoMatch:
              console.log('⚠️ No speech match detected - check microphone and speak clearly');
              break;
              
            default:
              console.log('ℹ️ Recognition result:', this.getReasonString(e.result.reason));
              break;
          }
        };

        this.speechRecognizer.canceled = (_sender, e) => {
          console.error('❌ Speech recognition cancelled:', {
            reason: e.reason,
            errorDetails: e.errorDetails,
            errorCode: e.errorCode
          });
          
          // Handle cancellation using Azure Speech SDK best practices
          if (e.reason === SpeechSDK.CancellationReason.Error) {
            console.log(`CANCELED: ErrorCode=${e.errorCode}`);
            console.log(`CANCELED: ErrorDetails=${e.errorDetails}`);
            console.log("CANCELED: Did you set the speech resource key and region values?");
            onError(`Speech recognition error: ${e.errorDetails}`);
          } else {
            console.log(`CANCELED: Reason=${e.reason}`);
          }
        };

        this.speechRecognizer.sessionStarted = (_sender, e) => {
          console.log('🎤 Speech recognition session started:', e.sessionId);
        };

        this.speechRecognizer.sessionStopped = (_sender, e) => {
          console.log('🛑 Speech recognition session stopped:', e.sessionId);
        };

        // Start continuous recognition with always-on microphone
        this.speechRecognizer.startContinuousRecognitionAsync(
          () => {
            console.log('✅ Azure Speech SDK English-only continuous recognition started - optimized for real-time speech detection');
            
            // Keep microphone connection alive immediately
            this.keepMicrophoneAlive();
            
            // Set up more frequent keep-alive to ensure microphone stays active
            this.microphoneKeepAliveInterval = setInterval(() => {
              this.keepMicrophoneAlive();
            }, 15000); // Keep alive every 15 seconds instead of 30
            
            resolve();
          },
          (error) => {
            console.error('❌ Failed to start always-on speech recognition:', error);
            onError(`Failed to start speech recognition: ${error}`);
            reject(error);
          }
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        onError(`Speech recognition initialization error: ${errorMessage}`);
        reject(error);
      }
    });
  }

  /**
   * Stop speech recognition and clean up always-on microphone
   */
  public stopRecognition(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up keep-alive interval
      if (this.microphoneKeepAliveInterval) {
        clearInterval(this.microphoneKeepAliveInterval);
        this.microphoneKeepAliveInterval = null;
      }

      if (!this.speechRecognizer) {
        resolve();
        return;
      }

      this.speechRecognizer.stopContinuousRecognitionAsync(
        () => {
          console.log('Speech recognition stopped.');
          this.speechRecognizer?.close();
          this.speechRecognizer = null;
          resolve();
        },
        (error) => {
          console.error('Failed to stop speech recognition:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Synthesize speech from text
   */
  public synthesizeSpeech(text: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      try {
        // Create speech synthesizer
        this.speechSynthesizer = new SpeechSDK.SpeechSynthesizer(this.speechConfig);

        this.speechSynthesizer.speakTextAsync(
          text,
          (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              console.log('Speech synthesis completed.');
              resolve(result.audioData);
            } else {
              const errorMessage = `Speech synthesis failed: ${result.errorDetails}`;
              console.error(errorMessage);
              reject(new Error(errorMessage));
            }
            this.speechSynthesizer?.close();
            this.speechSynthesizer = null;
          },
          (error) => {
            console.error('Speech synthesis error:', error);
            reject(new Error(`Speech synthesis error: ${error}`));
            this.speechSynthesizer?.close();
            this.speechSynthesizer = null;
          }
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        reject(new Error(`Speech synthesis initialization error: ${errorMessage}`));
      }
    });
  }

  /**
   * Check if microphone permission is granted
   */
  public async checkMicrophonePermission(): Promise<boolean> {
    try {
      console.log('🎤 Checking microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('✅ Microphone permission granted');
      return true;
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Cleanup resources including always-on microphone
   */
  public dispose(): void {
    // Clean up keep-alive interval
    if (this.microphoneKeepAliveInterval) {
      clearInterval(this.microphoneKeepAliveInterval);
      this.microphoneKeepAliveInterval = null;
    }

    if (this.speechRecognizer) {
      this.speechRecognizer.close();
      this.speechRecognizer = null;
    }
    if (this.speechSynthesizer) {
      this.speechSynthesizer.close();
      this.speechSynthesizer = null;
    }
  }

  /**
   * Extract detected language from speech recognition result using Azure Speech SDK best practices
   * Reference: https://docs.microsoft.com/en-us/azure/ai-services/speech-service/how-to-automatic-language-detection
   */
  private getDetectedLanguage(result: SpeechSDK.SpeechRecognitionResult): string | null {
    try {
      // Primary method: Get language from auto-detection result using Azure SDK best practices
      const autoDetectResult = SpeechSDK.AutoDetectSourceLanguageResult.fromResult(result);
      if (autoDetectResult && autoDetectResult.language) {
        console.log('🌐 Auto-detected language (Azure SDK method):', autoDetectResult.language);
        return autoDetectResult.language;
      }
      
      // Secondary method: Try to get from result properties for continuous LID
      const languageProperty = result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages);
      if (languageProperty) {
        console.log('🌐 Language from continuous LID properties:', languageProperty);
        return languageProperty;
      }
      
      // Tertiary method: Parse JSON result for additional language information
      const detectedLanguageProperty = result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);
      if (detectedLanguageProperty) {
        try {
          const parsed = JSON.parse(detectedLanguageProperty);
          if (parsed.Language) {
            console.log('🌐 Language from JSON result:', parsed.Language);
            return parsed.Language;
          }
          // Check for language in NBest results (multiple recognition candidates)
          if (parsed.NBest && parsed.NBest.length > 0 && parsed.NBest[0].Language) {
            console.log('🌐 Language from NBest results:', parsed.NBest[0].Language);
            return parsed.NBest[0].Language;
          }
        } catch (error) {
          console.warn('Failed to parse language from JSON result:', error);
        }
      }
      
      // Fallback: return current language for valid speech results
      if (result.text && result.text.trim()) {
        console.log('🌐 Using current language as fallback:', this.currentLanguage);
        return this.currentLanguage;
      }
    } catch (error) {
      console.warn('Failed to get detected language:', error);
    }
    
    return null;
  }

  /**
   * Update synthesis voice based on detected language
   */
  private updateSynthesisVoiceForLanguage(language: string): void {
    const languageOptions = ConfigService.getInstance().getAvailableLanguages();
    const matchedLanguage = languageOptions.find(lang => lang.code === language);
    
    if (matchedLanguage) {
      console.log(`🔊 Updating synthesis voice to: ${matchedLanguage.voice} for language: ${language}`);
      this.speechConfig.speechSynthesisVoiceName = matchedLanguage.voice;
      this.speechConfig.speechSynthesisLanguage = language;
    } else {
      console.warn(`🔊 No voice found for detected language: ${language}, keeping current voice`);
    }
  }

  /**
   * Language selection is now fully automatic - this method is deprecated
   * Auto-detection is always enabled for the best user experience
   */
  public setRecognitionLanguage(languageCode: string): void {
    console.log('🌐 Manual language selection disabled - using auto-detection for optimal experience');
    console.log('📝 Attempted to set language:', languageCode, '- ignoring in favor of auto-detection');
    // Auto-detection is always active, so we don't change anything
  }

  /**
   * Get current language (English-only)
   */
  public getDetectedLanguageInfo(): { current: string; detected: string | null } {
    return {
      current: 'en-US',
      detected: 'en-US'
    };
  }

  /**
   * Auto language detection is disabled in English-only mode
   */
  public setAutoDetectionEnabled(enabled: boolean): void {
    console.log('�🇸 Auto-detection disabled in English-only mode');
  }

  /**
   * Keep microphone connection alive for always-on functionality - gentle approach
   */
  public keepMicrophoneAlive(): void {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Light microphone check to maintain connection
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          console.log('🎤 Microphone connection verified');
          
          // Quick cleanup to avoid resource conflicts
          setTimeout(() => {
            stream.getTracks().forEach(track => track.stop());
          }, 100);
        })
        .catch(error => {
          console.warn('Microphone keep-alive check failed (non-critical):', error);
        });
    }
  }

  /**
   * Convert result reason to readable string for debugging
   */
  private getReasonString(reason: SpeechSDK.ResultReason): string {
    switch (reason) {
      case SpeechSDK.ResultReason.RecognizedSpeech:
        return 'RecognizedSpeech';
      case SpeechSDK.ResultReason.NoMatch:
        return 'NoMatch';
      case SpeechSDK.ResultReason.RecognizingSpeech:
        return 'RecognizingSpeech';
      case SpeechSDK.ResultReason.Canceled:
        return 'Canceled';
      default:
        return `Unknown(${reason})`;
    }
  }
}

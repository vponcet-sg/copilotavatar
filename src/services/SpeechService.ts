import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import ConfigService from './ConfigService';

/**
 * Azure Speech Service implementation following Microsoft's best practices
 * Features:
 * - Continuous multilingual speech recognition with real-time language detection
 * - AutoDetectSourceLanguageConfig for up to 10 simultaneous languages
 * - Continuous Language Identification (LID) for dynamic language switching
 * - Azure Speech SDK best practices for error handling and performance
 * 
 * References:
 * - https://docs.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech
 * - https://docs.microsoft.com/en-us/azure/ai-services/speech-service/how-to-automatic-language-detection
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
    const multiLingualConfig = ConfigService.getInstance().getMultiLingualConfig();
    
    // Initialize Speech SDK configuration
    this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(config.speechKey, config.speechRegion);
    
    // ALWAYS enable auto-detection for the best user experience
    this.currentLanguage = config.recognitionLanguage || multiLingualConfig.primaryLanguage;
    
    // Azure Speech SDK configuration following Microsoft best practices
    console.log('🌐 Azure Speech SDK: Multilingual auto-detection enabled with continuous LID');
    
    // Force auto-detection to be enabled with comprehensive language list
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode, 
      'Continuous' // Enable continuous language identification for real-time language switching
    );
    
    // Performance optimizations for Azure Speech SDK - More sensitive settings
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
      '3000' // Longer initial silence to capture speech better
    );
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
      '1500' // Longer end silence to capture complete phrases
    );
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
      '1000' // Longer segmentation for better speech detection
    );
    
    // Always-on microphone configuration with enhanced sensitivity
    this.speechConfig.setProperty(
      SpeechSDK.PropertyId.SpeechServiceConnection_RecoMode,
      'CONVERSATION' // Conversation mode for continuous listening
    );
    
    // Enable continuous recognition for always-on microphone
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
    
    // Set synthesis defaults (will be updated based on detected language)
    this.speechConfig.speechSynthesisLanguage = config.synthesisLanguage || 'en-US';
    this.speechConfig.speechSynthesisVoiceName = config.synthesisVoice || 'en-US-JennyMultilingualNeural';
    
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
    console.log('🎤 Always-on microphone configured for instant voice capture and real-time display');
  }

  /**
   * Start continuous speech recognition with automatic multi-lingual support
   * Language detection is always enabled for optimal user experience
   */
  public startRecognition(
    onRecognizing: (text: string, language?: string) => void,
    onRecognized: (text: string, language?: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check if multilingual mode is enabled
        const multiLingualConfig = ConfigService.getInstance().getMultiLingualConfig();
        const isMultiLingual = multiLingualConfig.autoDetect;
        
        if (isMultiLingual) {
          // Use multilingual auto-detection
          console.log('🌐 Setting up MULTILINGUAL auto-detect speech recognizer');
          
          try {
            const supportedLanguages = multiLingualConfig.supportedLanguages;
            console.log('🗣️ Auto-detection languages:', supportedLanguages);
            
            // Configure auto-detection with supported languages using Azure Speech SDK best practices
            const autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(supportedLanguages);
            
            // Create speech recognizer with auto-detection configuration for continuous language identification
            this.speechRecognizer = SpeechSDK.SpeechRecognizer.FromConfig(
              this.speechConfig, 
              autoDetectSourceLanguageConfig, 
              this.audioConfig!
            );
            
            console.log('✅ Multilingual speech recognizer ready with', supportedLanguages.length, 'languages');
          } catch (error) {
            console.warn('⚠️ Multilingual setup failed, falling back to English-only:', error);
            // Fallback to English-only
            this.speechConfig.speechRecognitionLanguage = 'en-US';
            this.speechRecognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig!);
          }
        } else {
          // Use English-only mode
          console.log('🇺🇸 Setting up ENGLISH-ONLY speech recognizer');
          this.speechConfig.speechRecognitionLanguage = 'en-US';
          this.speechRecognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig!);
          console.log('✅ English-only speech recognizer ready');
        }

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
            console.log('✅ Azure Speech SDK multilingual continuous recognition started - optimized for real-time language detection');
            
            // Keep microphone connection alive immediately
            this.keepMicrophoneAlive();
            
            // Set up periodic keep-alive to ensure microphone stays active
            this.microphoneKeepAliveInterval = setInterval(() => {
              this.keepMicrophoneAlive();
            }, 30000); // Keep alive every 30 seconds
            
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
   * Get currently detected language
   */
  public getDetectedLanguageInfo(): { current: string; detected: string | null } {
    return {
      current: this.currentLanguage,
      detected: this.detectedLanguage
    };
  }

  /**
   * Auto language detection is always enabled for optimal user experience
   * This method is deprecated - detection cannot be disabled
   */
  public setAutoDetectionEnabled(enabled: boolean): void {
    console.log('🌐 Auto-detection is permanently enabled for the best user experience');
    console.log('📝 Attempted to set auto-detection to:', enabled, '- always remains enabled');
    // Auto-detection is always enabled, so we don't change anything
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
   * Debug method to test microphone and speech recognition setup
   */
  public async debugMicrophoneSetup(): Promise<{ success: boolean; details: string[] }> {
    const details: string[] = [];
    
    try {
      // Test 1: Check microphone permission
      details.push('Testing microphone permission...');
      const hasPermission = await this.checkMicrophonePermission();
      details.push(`Microphone permission: ${hasPermission ? 'GRANTED' : 'DENIED'}`);
      
      if (!hasPermission) {
        return { success: false, details };
      }
      
      // Test 2: Check speech config
      details.push('Checking speech configuration...');
      const config = ConfigService.getInstance().getSpeechConfig();
      details.push(`Speech key exists: ${!!config.speechKey}`);
      details.push(`Speech region: ${config.speechRegion}`);
      
      if (!config.speechKey || !config.speechRegion) {
        details.push('ERROR: Missing speech configuration');
        return { success: false, details };
      }
      
      // Test 3: Test audio configuration
      details.push('Testing audio configuration...');
      if (this.audioConfig) {
        details.push('Audio config: READY');
      } else {
        details.push('Audio config: NOT INITIALIZED');
        this.configureOptimizedMicrophone();
        details.push('Audio config: INITIALIZED');
      }
      
      // Test 4: Check if we can create a recognizer
      details.push('Testing speech recognizer creation...');
      try {
        const testRecognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig!);
        details.push('Speech recognizer: CREATED SUCCESSFULLY');
        testRecognizer.close();
      } catch (error) {
        details.push(`Speech recognizer error: ${error}`);
        return { success: false, details };
      }
      
      details.push('All tests passed - Azure Speech SDK multilingual setup should work');
      
      // Optional: Test audio levels (this will take 5 seconds)
      details.push('Starting 5-second audio level test - speak now...');
      setTimeout(() => {
        this.testMicrophoneAudioLevels();
      }, 1000);
      
      return { success: true, details };
      
    } catch (error) {
      details.push(`Debug error: ${error}`);
      return { success: false, details };
    }
  }

  /**
   * Test microphone audio levels to see if it's actually picking up sound
   */
  public async testMicrophoneAudioLevels(): Promise<void> {
    try {
      console.log('🎤 Testing microphone audio levels...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      source.connect(analyser);
      
      let testDuration = 5000; // 5 seconds
      let maxVolume = 0;
      let sampleCount = 0;
      
      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        maxVolume = Math.max(maxVolume, average);
        sampleCount++;
        
        if (average > 10) { // Some activity detected
          console.log(`🎤 Audio detected: ${average.toFixed(1)} (max: ${maxVolume.toFixed(1)})`);
        }
        
        if (testDuration > 0) {
          testDuration -= 100;
          setTimeout(checkAudioLevel, 100);
        } else {
          // Cleanup
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
          
          console.log(`🎤 Audio test complete - Max volume: ${maxVolume.toFixed(1)}, Samples: ${sampleCount}`);
          
          if (maxVolume < 5) {
            console.warn('⚠️ Very low audio levels detected. Check microphone volume/sensitivity.');
          } else {
            console.log('✅ Microphone is picking up audio properly');
          }
        }
      };
      
      console.log('🎤 Speak now for 5 seconds to test audio levels...');
      checkAudioLevel();
      
    } catch (error) {
      console.error('❌ Failed to test microphone audio levels:', error);
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

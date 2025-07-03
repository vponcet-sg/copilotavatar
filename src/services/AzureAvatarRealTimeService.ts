import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import ConfigService from './ConfigService';

/**
 * Azure Avatar Real-Time Service - Performance Optimized
 * Implements real-time avatar video generation using Azure Speech Services Avatar API
 * 
 * Performance Optimizations:
 * - Reduced logging during video playback to prevent UI lag
 * - Optimized event emission with requestIdleCallback for non-critical events
 * - Eliminated expensive stream cloning during audio track handling
 * - Minimized video element manipulations and event handler complexity
 * - Deferred non-critical event emissions to prevent blocking avatar speech
 * 
 * Reference: https://docs.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-avatar
 */
export class AzureAvatarRealTimeService {
  private avatarSynthesizer: SpeechSDK.AvatarSynthesizer | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private isSessionActive = false;
  private configService: ConfigService;

  constructor() {
    this.configService = ConfigService.getInstance();
  }

  /**
   * Initialize and start the avatar session
   */
  public async startSession(
    talkingAvatarCharacter: string = 'lisa',
    talkingAvatarStyle: string = 'casual-sitting',
    videoElementId: string = 'avatarVideo'
  ): Promise<void> {
    if (this.isSessionActive) {
      console.log('Avatar session already active');
      return;
    }

    try {
      const speechConfig = this.createSpeechConfig();
      console.log('✅ Speech config created successfully');
      
      // Get ICE server credentials for WebRTC
      console.log('🔄 Getting ICE server credentials...');
      const iceServerInfo = await this.getIceServerInfo();
      console.log('✅ ICE server credentials obtained:', { url: iceServerInfo.url.substring(0, 50) + '...' });
      
      // Try avatar configurations with fallbacks
      await this.tryAvatarConfigurations(
        speechConfig,
        iceServerInfo,
        talkingAvatarCharacter,
        talkingAvatarStyle,
        videoElementId
      );

      console.log('🎉 Azure Avatar Real-Time session started successfully');
      this.isSessionActive = true;

      // Emit session started event
      this.emitEvent('sessionStarted', { message: 'Avatar session started' });
      
    } catch (error) {
      console.error('❌ Failed to start avatar session:', error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      this.emitEvent('sessionError', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Speak text using the avatar with multi-lingual support - ultra-optimized for minimal lag
   */
  public async speak(text: string, voice?: string): Promise<void> {
    if (!this.avatarSynthesizer || !this.isSessionActive) {
      throw new Error('Avatar session not started. Call startSession() first.');
    }

    try {
      // Ultra-fast voice determination
      const selectedVoice = voice || this.configService.getSpeechConfig().synthesisVoice || 'en-US-JennyMultilingualNeural';
      
      // Create ultra-optimized SSML
      const ssml = this.createSSML(text, selectedVoice);
      
      // Fire-and-forget event emission to prevent any blocking
      setTimeout(() => this.emitEvent('speakingStarted', { text, voice: selectedVoice }), 0);

      // Ultra-fast speaking
      const result = await this.avatarSynthesizer.speakSsmlAsync(ssml);

      // Non-blocking result handling
      setTimeout(() => {
        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          this.emitEvent('speakingCompleted', { text, voice: selectedVoice, resultId: result.resultId });
        } else {
          this.emitEvent('speakingError', { error: `Speech synthesis failed: ${result.reason}`, voice: selectedVoice });
        }
      }, 0);

    } catch (error) {
      console.error('❌ Avatar speaking failed:', error);
      setTimeout(() => this.emitEvent('speakingError', { error: error instanceof Error ? error.message : String(error) }), 0);
      throw error;
    }
  }

  /**
   * Stop current speaking - ultra-fast for instant response
   */
  public async stopSpeaking(): Promise<void> {
    if (!this.avatarSynthesizer) {
      return;
    }

    try {
      // Instant stop with very short timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          this.avatarSynthesizer!.stopSpeakingAsync()
            .then(() => {
              console.log('Avatar stopped speaking');
              setTimeout(() => this.emitEvent('speakingStopped', {}), 0);
              resolve();
            })
            .catch(reject);
        }),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Stop speaking timeout')), 1000) // 1 second timeout
        )
      ]);
    } catch (error) {
      console.warn('Stop speaking timeout (non-critical):', error);
      // Emit stopped event anyway to keep UI responsive
      setTimeout(() => this.emitEvent('speakingStopped', {}), 0);
    }
  }

  /**
   * Stop the avatar session
   */
  public async stopSession(): Promise<void> {
    if (!this.isSessionActive) {
      return;
    }

    try {
      // Stop any current speaking
      await this.stopSpeaking();

      // Close avatar synthesizer
      if (this.avatarSynthesizer) {
        this.avatarSynthesizer.close();
        this.avatarSynthesizer = null;
      }

      // Close WebRTC connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      this.isSessionActive = false;
      console.log('Avatar session stopped');
      this.emitEvent('sessionStopped', {});
      
    } catch (error) {
      console.error('Failed to stop avatar session:', error);
      throw error;
    }
  }

  /**
   * Check if session is active
   */
  public isActive(): boolean {
    return this.isSessionActive;
  }

  /**
   * Create Speech SDK configuration
   */
  private createSpeechConfig(): SpeechSDK.SpeechConfig {
    const speechConfig = this.configService.getSpeechConfig();
    
    console.log('🔧 Creating speech config:', {
      hasKey: !!speechConfig.speechKey,
      keyLength: speechConfig.speechKey?.length,
      region: speechConfig.speechRegion,
      hasEndpoint: !!speechConfig.speechEndpoint
    });
    
    if (!speechConfig.speechKey || !speechConfig.speechRegion) {
      throw new Error('Missing required speech configuration. Please check VITE_SPEECH_KEY and VITE_SPEECH_REGION environment variables.');
    }
    
    // Use region-based endpoint for avatar synthesis
    const config = SpeechSDK.SpeechConfig.fromSubscription(speechConfig.speechKey, speechConfig.speechRegion);
    
    return config;
  }

  /**
   * Create Avatar configuration
   */
  private createAvatarConfig(character: string, style: string): SpeechSDK.AvatarConfig {
    // Create video format configuration
    const videoFormat = new SpeechSDK.AvatarVideoFormat();
    // Set crop range if needed (optional)
    // videoFormat.setCropRange(new SpeechSDK.Coordinate(0, 0), new SpeechSDK.Coordinate(1920, 1080));

    const avatarConfig = new SpeechSDK.AvatarConfig(character, style, videoFormat);
    
    // Configure avatar settings
    avatarConfig.customized = false; // Set to true if using custom avatar
    avatarConfig.backgroundColor = '#FFFFFFFF'; // White background
    
    return avatarConfig;
  }

  /**
   * Get ICE server information for WebRTC
   */
  private async getIceServerInfo(): Promise<{ url: string; username: string; credential: string }> {
    const speechConfig = this.configService.getSpeechConfig();
    
    const endpoint = `https://${speechConfig.speechRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`;
    console.log('🔄 Requesting ICE server token from:', endpoint);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': speechConfig.speechKey
        }
      });

      console.log('📡 ICE server response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ICE server request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Failed to get ICE server info: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ ICE server response received:', {
        hasUrls: !!data.Urls,
        urlCount: data.Urls?.length,
        hasUsername: !!data.Username,
        hasPassword: !!data.Password
      });
      
      if (!data.Urls || !data.Username || !data.Password) {
        throw new Error('Invalid ICE server response: missing required fields');
      }

      return {
        url: data.Urls[0],
        username: data.Username,
        credential: data.Password
      };
    } catch (error) {
      console.error('❌ Failed to get ICE server info:', error);
      throw error;
    }
  }

  /**
   * Set up WebRTC peer connection
   */
  private async setupWebRTC(iceServerInfo: { url: string; username: string; credential: string }, videoElementId: string): Promise<void> {
    // Create WebRTC peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{
        urls: [iceServerInfo.url],
        username: iceServerInfo.username,
        credential: iceServerInfo.credential
      }]
    });

    // Handle incoming video/audio tracks - optimized for performance
    this.peerConnection.ontrack = (event) => {
      // Reduce logging during video playback to prevent lag
      if (event.track.kind === 'video') {
        console.log('🎬 Video track received - setting up stream...');
      } else if (event.track.kind === 'audio') {
        console.log('🔊 Audio track received - configuring audio...');
      }
      
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      
      if (videoElement) {
        if (event.track.kind === 'video') {
          console.log('� Attaching video stream to video element...');
          videoElement.srcObject = event.streams[0];
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.muted = false;
          videoElement.volume = 1.0;
          
          console.log('✅ Video stream attached to video element');
          this.emitEvent('videoStreamReady', { videoElementId });
          
        } else if (event.track.kind === 'audio') {
          console.log('� Handling audio track...');
          
          // Get the current video element's stream
          const currentStream = videoElement.srcObject as MediaStream;
          
          if (currentStream) {
            // Simply add the audio track without expensive cloning
            currentStream.addTrack(event.track);
            event.track.enabled = true;
            
          } else {
            // No video stream yet, create new stream with just audio
            console.log('� Creating new stream with audio track...');
            const audioStream = new MediaStream([event.track]);
            videoElement.srcObject = audioStream;
          }
          
          // Ensure audio is enabled
          videoElement.muted = false;
          videoElement.volume = 1.0;
          event.track.enabled = true;
          
          console.log('🔊 Audio track added to video element:', {
            muted: videoElement.muted,
            volume: videoElement.volume,
            trackEnabled: event.track.enabled,
            trackMuted: event.track.muted
          });
        }
        
        // Set up optimized video event listeners (minimal logging for performance)
        if (!videoElement.onloadedmetadata) {
          videoElement.onloadedmetadata = () => {
            // Minimal logging to prevent performance issues during avatar speaking
            console.log('✅ Avatar video ready');
          };
          
          videoElement.onplay = () => {
            console.log('▶️ Avatar video playing');
          };
          
          // Simplified error handling
          videoElement.onerror = (error) => {
            console.error('❌ Avatar video error:', error);
          };
        }
      }
    };

    // Handle connection state changes - optimized logging
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection!.iceConnectionState;
      
      // Only log important state changes to prevent performance issues
      if (state === 'connected' || state === 'failed' || state === 'disconnected') {
        console.log('WebRTC connection state:', state);
      }
      
      this.emitEvent('connectionStateChanged', { state });
      
      if (state === 'failed' || state === 'disconnected') {
        this.emitEvent('connectionError', { state });
      }
    };

    // Set up data channel for receiving events from avatar service - optimized
    this.peerConnection.addEventListener('datachannel', (event) => {
      const dataChannel = event.channel;
      dataChannel.onmessage = (e) => {
        try {
          const webRTCEvent = JSON.parse(e.data);
          // Reduce logging during avatar speaking to prevent lag
          if (webRTCEvent.type !== 'speaking' && webRTCEvent.type !== 'audio') {
            console.log('Avatar event received:', webRTCEvent);
          }
          this.emitEvent('avatarEvent', webRTCEvent);
        } catch (error) {
          console.error('Failed to parse avatar event:', error);
        }
      };
    });

    // Create data channel to enable event listening
    this.peerConnection.createDataChannel('eventChannel');

    // Add transceivers for audio and video
    this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    // Start avatar with WebRTC connection
    console.log('🔄 Starting avatar with WebRTC connection...');
    await new Promise<void>((resolve, reject) => {
      this.avatarSynthesizer!.startAvatarAsync(this.peerConnection!)
        .then((result) => {
          console.log('🔍 Avatar start result:', {
            reason: result.reason,
            resultId: result.resultId,
            reasonString: this.getResultReasonString(result.reason)
          });
          
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log('✅ Avatar WebRTC session started successfully');
            resolve();
          } else {
            const errorDetails = this.getDetailedErrorInfo(result);
            console.error('❌ Failed to start avatar:', errorDetails);
            reject(new Error(`Failed to start avatar: ${errorDetails.reason} - ${errorDetails.details}`));
          }
        })
        .catch((error) => {
          console.error('❌ Avatar start promise rejected:', error);
          reject(error);
        });
    });
  }

  /**
   * Set up event handlers for avatar synthesizer - optimized for performance
   */
  private setupEventHandlers(): void {
    if (!this.avatarSynthesizer) return;

    this.avatarSynthesizer.avatarEventReceived = (_sender, event) => {
      // Reduce logging during speaking to prevent performance issues
      const offsetMessage = event.offset === 0 ? '' : `, offset: ${event.offset / 10000}ms`;
      
      // Only log important events, not every audio frame
      if (!event.description.includes('audio') && !event.description.includes('frame')) {
        console.log(`Avatar event: ${event.description}${offsetMessage}`);
      }
      
      this.emitEvent('avatarEventReceived', {
        description: event.description,
        offset: event.offset
      });
    };
  }

  /**
   * Create ultra-fast SSML for minimal processing lag
   */
  private createSSML(text: string, voice: string): string {
    // Ultra-minimal HTML encoding - only escape essential characters
    const encodedText = text.replace(/[&<>]/g, (char) => {
      return char === '&' ? '&amp;' : char === '<' ? '&lt;' : '&gt;';
    });

    // Minimal SSML for maximum speed
    return `<speak version="1.0" xml:lang="en-US"><voice name="${voice}">${encodedText}</voice></speak>`;
  }

  /**
   * Emit custom events for UI updates - optimized for performance during avatar speaking
   */
  private emitEvent(eventType: string, data: any): void {
    // Use requestIdleCallback for non-critical events during avatar speaking to prevent lag
    const emitFunction = () => {
      const event = new CustomEvent('azureAvatarEvent', {
        detail: { eventType, data, timestamp: new Date() }
      });
      window.dispatchEvent(event);
    };

    // Critical events (like speakingStarted, speakingCompleted) - emit immediately
    const criticalEvents = ['speakingStarted', 'speakingCompleted', 'speakingStopped', 'speakingError', 'sessionStarted', 'sessionError'];
    
    if (criticalEvents.includes(eventType)) {
      emitFunction();
    } else {
      // Non-critical events - defer to prevent UI lag during avatar speaking
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(emitFunction, { timeout: 100 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(emitFunction, 0);
      }
    }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopSession().catch(console.error);
  }

  /**
   * Get detailed error information from result
   */
  private getDetailedErrorInfo(result: any): { reason: string; details: string } {
    const reasonString = this.getResultReasonString(result.reason);
    let details = 'Unknown error';
    
    if (result.reason === SpeechSDK.ResultReason.Canceled) {
      try {
        const cancellationDetails = SpeechSDK.CancellationDetails.fromResult(result);
        details = `Cancellation reason: ${this.getCancellationReasonString(cancellationDetails.reason)}`;
        
        if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
          details += ` | Error details: ${cancellationDetails.errorDetails || 'No additional details'}`;
          details += ` | Error code: ${cancellationDetails.ErrorCode || 'Unknown'}`;
        }
      } catch (error) {
        details = `Failed to get cancellation details: ${error}`;
      }
    }
    
    return { reason: reasonString, details };
  }

  /**
   * Convert result reason enum to readable string
   */
  private getResultReasonString(reason: any): string {
    const reasonMap: { [key: number]: string } = {
      0: 'NoMatch',
      1: 'RecognizedSpeech', 
      2: 'RecognizedIntent',
      3: 'TranslatedSpeech',
      4: 'SynthesizingAudio',
      5: 'SynthesizingAudioCompleted',
      6: 'SynthesizingAudioStarted',
      7: 'Canceled'
    };
    
    return reasonMap[reason] || `Unknown reason (${reason})`;
  }

  /**
   * Convert cancellation reason enum to readable string
   */
  private getCancellationReasonString(reason: any): string {
    const reasonMap: { [key: number]: string } = {
      0: 'Error',
      1: 'EndOfStream',
      2: 'CancelledByUser'
    };
    
    return reasonMap[reason] || `Unknown cancellation reason (${reason})`;
  }

  /**
   * Get fallback avatar configurations to try if the primary one fails
   */
  private getAvatarFallbacks(): Array<{ character: string; style: string }> {
    return [
      { character: 'lisa', style: 'casual-sitting' },
      { character: 'lisa', style: 'technical-sitting' },
      { character: 'anna', style: 'casual-sitting' },
      { character: 'anna', style: 'technical-sitting' },
      { character: 'lisa', style: 'graceful-sitting' }
    ];
  }

  /**
   * Try to start avatar session with fallback configurations
   */
  private async tryAvatarConfigurations(
    speechConfig: SpeechSDK.SpeechConfig,
    iceServerInfo: { url: string; username: string; credential: string },
    primaryCharacter: string,
    primaryStyle: string,
    videoElementId: string
  ): Promise<void> {
    const configurations = [
      { character: primaryCharacter, style: primaryStyle },
      ...this.getAvatarFallbacks().filter(config => 
        !(config.character === primaryCharacter && config.style === primaryStyle)
      )
    ];

    for (let i = 0; i < configurations.length; i++) {
      const config = configurations[i];
      
      try {
        console.log(`🔄 Trying avatar configuration ${i + 1}/${configurations.length}:`, config);
        
        const avatarConfig = this.createAvatarConfig(config.character, config.style);
        avatarConfig.remoteIceServers = [{
          urls: [iceServerInfo.url],
          username: iceServerInfo.username,
          credential: iceServerInfo.credential
        }];

        console.log('🔄 Creating avatar synthesizer...');
        console.log('📋 Avatar configuration:', {
          character: config.character,
          style: config.style,
          hasRemoteIceServers: !!avatarConfig.remoteIceServers,
          iceServerCount: avatarConfig.remoteIceServers?.length || 0
        });
        
        this.avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);
        console.log('✅ Avatar synthesizer created successfully');
        
        // Set up event handlers
        this.setupEventHandlers();
        console.log('✅ Event handlers set up');

        // Set up WebRTC
        console.log('🔄 Setting up WebRTC connection...');
        await this.setupWebRTC(iceServerInfo, videoElementId);
        console.log('✅ WebRTC connection established');

        console.log(`🎉 Azure Avatar Real-Time session started successfully with ${config.character}/${config.style}`);
        return; // Success! Exit the function
        
      } catch (error) {
        console.warn(`❌ Failed to start avatar with ${config.character}/${config.style}:`, error);
        
        // Clean up failed attempt
        if (this.avatarSynthesizer) {
          try {
            this.avatarSynthesizer.close();
          } catch (closeError) {
            console.warn('Failed to close avatar synthesizer:', closeError);
          }
          this.avatarSynthesizer = null;
        }
        
        // If this is the last configuration, re-throw the error
        if (i === configurations.length - 1) {
          throw error;
        }
      }
    }
  }

  /**
   * Get the best voice for a given language
   */
  public getBestVoiceForLanguage(languageCode: string): string {
    const availableLanguages = this.configService.getAvailableLanguages();
    const matchedLanguage = availableLanguages.find((lang: any) => lang.code === languageCode);
    
    if (matchedLanguage) {
      console.log(`🗣️ Found voice for ${languageCode}: ${matchedLanguage.voice}`);
      return matchedLanguage.voice;
    }
    
    // Fallback to multilingual voice or default
    console.log(`🗣️ No specific voice found for ${languageCode}, using multilingual fallback`);
    return 'en-US-JennyMultilingualNeural';
  }

  /**
   * Speak text with automatic voice selection based on language
   */
  public async speakWithAutoVoice(text: string, detectedLanguage?: string): Promise<void> {
    const language = detectedLanguage || 'en-US';
    const bestVoice = this.getBestVoiceForLanguage(language);
    
    await this.speak(text, bestVoice);
  }
}

export default AzureAvatarRealTimeService;

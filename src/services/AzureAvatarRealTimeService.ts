import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import ConfigService from './ConfigService';

/**
 * Azure Avatar Real-Time Service - Performance Optimized with Multi-Device Support
 * Implements real-time avatar video generation using Azure Speech Services Avatar API
 * 
 * Multi-Device Architecture:
 * - Supports concurrent sessions from multiple devices/browsers (10+ simultaneous users)
 * - Each device/browser instance maintains its own isolated session and queue
 * - Prevents concurrent requests only within the same device/browser instance
 * - Uses unique device session IDs for isolation and debugging
 * 
 * Performance Optimizations:
 * - Reduced logging during video playback to prevent UI lag
 * - Optimized event emission with requestIdleCallback for non-critical events
 * - Eliminated expensive stream cloning during audio track handling
 * - Minimized video element manipulations and event handler complexity
 * - Deferred non-critical event emissions to prevent blocking avatar speech
 * 
 * Concurrency Protection (Per Device):
 * - Only one avatar session per device/browser
 * - Only one speaking request at a time per device
 * - Request queuing system for multiple speak requests on same device
 * - Proper cleanup and state management per device
 * 
 * Reference: https://docs.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-avatar
 */
export class AzureAvatarRealTimeService {
  private avatarSynthesizer: SpeechSDK.AvatarSynthesizer | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private isSessionActive = false;
  private isSessionStarting = false; // Prevent concurrent session starts on THIS device
  private isSpeaking = false; // Prevent concurrent speaking requests on THIS device
  private speakQueue: Array<{ text: string; voice?: string; resolve: () => void; reject: (error: any) => void }> = [];
  private configService: ConfigService;
  private deviceSessionId: string; // Unique identifier for this device/browser session

  constructor() {
    this.configService = ConfigService.getInstance();
    // Generate unique device session ID for this browser/device instance
    this.deviceSessionId = this.generateDeviceSessionId();
    console.log(`Avatar service initialized for device: ${this.deviceSessionId}`);
  }

  /**
   * Generate unique device session ID
   */
  private generateDeviceSessionId(): string {
    // Use combination of timestamp, random number, and browser fingerprint
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const userAgent = navigator.userAgent.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '');
    return `device-${userAgent}-${timestamp}-${random}`;
  }

  /**
   * Initialize and start the avatar session for this device
   */
  public async startSession(
    talkingAvatarCharacter: string = 'lisa',
    talkingAvatarStyle: string = 'casual-sitting',
    videoElementId: string = 'avatarVideo'
  ): Promise<void> {
    // Prevent concurrent session starts on THIS device only
    if (this.isSessionActive) {
      console.log(`Avatar session already active on device: ${this.deviceSessionId}`);
      return;
    }
    
    if (this.isSessionStarting) {
      console.log(`Avatar session already starting on device: ${this.deviceSessionId}, waiting...`);
      // Wait for current session start to complete on THIS device
      while (this.isSessionStarting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isSessionStarting = true;
    console.log(`Starting avatar session for device: ${this.deviceSessionId}`);

    try {
      const speechConfig = this.createSpeechConfig();
      console.log('Speech config created successfully');
      
      // Get ICE server credentials for WebRTC
      console.log('Getting ICE server credentials...');
      const iceServerInfo = await this.getIceServerInfo();
      console.log('ICE server credentials obtained:', { url: iceServerInfo.url.substring(0, 50) + '...' });
      
      // Try primary avatar configuration with retry for connection limits
      await this.startAvatarWithRetry(
        speechConfig,
        iceServerInfo,
        talkingAvatarCharacter,
        talkingAvatarStyle,
        videoElementId
      );

      console.log(`Azure Avatar Real-Time session started successfully for device: ${this.deviceSessionId}`);
      this.isSessionActive = true;
      this.isSessionStarting = false;

      // Emit session started event with device info
      this.emitEvent('sessionStarted', { message: 'Avatar session started', deviceId: this.deviceSessionId });
      
    } catch (error) {
      this.isSessionStarting = false;
      console.error(`Failed to start avatar session for device ${this.deviceSessionId}:`, error);
      
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
   * Speak text using the avatar with multi-lingual support - with per-device concurrency protection
   * CRITICAL FLOW STEP 5: Convert Text to Live Avatar Speech + Video
   */
  public async speak(text: string, voice?: string): Promise<void> {
    if (!this.avatarSynthesizer || !this.isSessionActive) {
      throw new Error(`Avatar session not started on device ${this.deviceSessionId}. Call startSession() first.`);
    }

    console.log(`Speak request for device ${this.deviceSessionId} - Current state: speaking=${this.isSpeaking}, queue=${this.speakQueue.length}`);

    // Add to queue if currently speaking on THIS device
    if (this.isSpeaking) {
      console.log(`Avatar currently speaking on device ${this.deviceSessionId}, queueing request...`);
      return new Promise((resolve, reject) => {
        this.speakQueue.push({ text, voice, resolve, reject });
        console.log(`Request queued for device ${this.deviceSessionId}, new queue length: ${this.speakQueue.length}`);
      });
    }

    this.isSpeaking = true;
    console.log(`Device ${this.deviceSessionId} starting to speak:`, text.substring(0, 50) + (text.length > 50 ? '...' : ''));

    try {
      // Ultra-fast voice determination
      const selectedVoice = voice || this.configService.getSpeechConfig().synthesisVoice || 'en-US-JennyMultilingualNeural';
      
      // CONVERT TEXT TO SSML: Create ultra-optimized SSML for Azure Avatar API
      const ssml = this.createSSML(text, selectedVoice);
      
      // Fire-and-forget event emission to prevent any blocking
      setTimeout(() => this.emitEvent('speakingStarted', { text, voice: selectedVoice, deviceId: this.deviceSessionId }), 0);

      // CRITICAL FLOW: Azure Avatar API creates lip-sync video + audio
      // LIVE VIDEO GENERATION: This creates real-time avatar video with lip-sync
      const result = await this.avatarSynthesizer.speakSsmlAsync(ssml);

      // Non-blocking result handling
      setTimeout(() => {
        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          // SUCCESS: Avatar video with speech completed
          this.emitEvent('speakingCompleted', { text, voice: selectedVoice, resultId: result.resultId, deviceId: this.deviceSessionId });
        } else {
          this.emitEvent('speakingError', { error: `Speech synthesis failed: ${result.reason}`, voice: selectedVoice, deviceId: this.deviceSessionId });
        }
      }, 0);

    } catch (error) {
      console.error(`Avatar speaking failed on device ${this.deviceSessionId}:`, error);
      setTimeout(() => this.emitEvent('speakingError', { error: error instanceof Error ? error.message : String(error), deviceId: this.deviceSessionId }), 0);
      throw error;
    } finally {
      this.isSpeaking = false;
      console.log(`Device ${this.deviceSessionId} finished speaking, queue length: ${this.speakQueue.length}`);
      // Process next item in queue for this device
      this.processNextInQueue();
    }
  }

  /**
   * Process next speaking request in queue for this device
   */
  private async processNextInQueue(): Promise<void> {
    if (this.speakQueue.length > 0 && !this.isSpeaking) {
      console.log(`Device ${this.deviceSessionId} processing next item in queue (${this.speakQueue.length} remaining)`);
      const nextRequest = this.speakQueue.shift()!;
      try {
        await this.speak(nextRequest.text, nextRequest.voice);
        nextRequest.resolve();
      } catch (error) {
        nextRequest.reject(error);
      }
    }
  }

  /**
   * Stop current speaking on this device - ultra-fast for instant response
   */
  public async stopSpeaking(): Promise<void> {
    if (!this.avatarSynthesizer) {
      return;
    }

    // Clear the speaking queue to prevent further requests on this device
    this.speakQueue = [];
    console.log(`Stopping speech on device ${this.deviceSessionId}`);

    try {
      // Instant stop with very short timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          this.avatarSynthesizer!.stopSpeakingAsync()
            .then(() => {
              console.log(`Avatar stopped speaking on device ${this.deviceSessionId}`);
              setTimeout(() => this.emitEvent('speakingStopped', { deviceId: this.deviceSessionId }), 0);
              resolve();
            })
            .catch(reject);
        }),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Stop speaking timeout')), 1000) // 1 second timeout
        )
      ]);
    } catch (error) {
      console.warn(`Stop speaking timeout on device ${this.deviceSessionId} (non-critical):`, error);
      // Emit stopped event anyway to keep UI responsive
      setTimeout(() => this.emitEvent('speakingStopped', { deviceId: this.deviceSessionId }), 0);
    } finally {
      this.isSpeaking = false;
    }
  }

  /**
   * Stop the avatar session for this device
   */
  public async stopSession(): Promise<void> {
    if (!this.isSessionActive) {
      return;
    }

    console.log(`Stopping avatar session for device ${this.deviceSessionId}`);

    try {
      // Clear any pending speaking requests on this device
      this.speakQueue = [];
      this.isSpeaking = false;
      
      // Stop any current speaking
      await this.stopSpeaking();

      // Close avatar synthesizer for this device
      if (this.avatarSynthesizer) {
        this.avatarSynthesizer.close();
        this.avatarSynthesizer = null;
      }

      // Close WebRTC connection for this device
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      this.isSessionActive = false;
      this.isSessionStarting = false;
      console.log(`Avatar session stopped for device ${this.deviceSessionId}`);
      this.emitEvent('sessionStopped', { deviceId: this.deviceSessionId });
      
    } catch (error) {
      console.error(`Failed to stop avatar session for device ${this.deviceSessionId}:`, error);
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
    
    console.log('Creating speech config:', {
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
    console.log('Requesting ICE server token from:', endpoint);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': speechConfig.speechKey
        }
      });

      console.log('ICE server response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ICE server request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`Failed to get ICE server info: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('ICE server response received:', {
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
      console.error('Failed to get ICE server info:', error);
      throw error;
    }
  }

  /**
   * Set up WebRTC peer connection for this device
   * CRITICAL FLOW STEP 7: Live Video Streaming Setup
   */
  private async setupWebRTC(iceServerInfo: { url: string; username: string; credential: string }, videoElementId: string): Promise<void> {
    // Close any existing peer connection to prevent multiple concurrent connections on this device
    if (this.peerConnection) {
      console.log(`Closing existing peer connection for device ${this.deviceSessionId}`);
      this.peerConnection.close();
      this.peerConnection = null;
    }

    console.log(`Creating WebRTC peer connection for device ${this.deviceSessionId}`);
    // WEBRTC CONNECTION: Create WebRTC peer connection for live video streaming
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{
        urls: [iceServerInfo.url],
        username: iceServerInfo.username,
        credential: iceServerInfo.credential
      }]
    });

    // LIVE VIDEO STREAMING: Handle incoming video/audio tracks - optimized for performance
    this.peerConnection.ontrack = (event) => {
      // Reduce logging during video playback to prevent lag
      if (event.track.kind === 'video') {
        // VIDEO TRACK: Avatar video with lip-sync received
      } else if (event.track.kind === 'audio') {
        // AUDIO TRACK: Avatar speech audio received
      }
      
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      
      if (videoElement) {
        if (event.track.kind === 'video') {
          // CONNECT LIVE STREAM: Attaching avatar video stream to HTML video element
          videoElement.srcObject = event.streams[0];  // LIVE AVATAR VIDEO APPEARS HERE
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.muted = false;
          videoElement.volume = 1.0;
          
          // Trigger autoplay
          setTimeout(() => {
            videoElement.play().catch(() => {
              // Autoplay blocked - user interaction required
            });
          }, 100);
          
          this.emitEvent('videoStreamReady', { videoElementId });
          
        } else if (event.track.kind === 'audio') {
          // Handling audio track
          
          // Get the current video element's stream
          const currentStream = videoElement.srcObject as MediaStream;
          
          if (currentStream) {
            // Simply add the audio track without expensive cloning
            currentStream.addTrack(event.track);
            event.track.enabled = true;
            
          } else {
            // No video stream yet, create new stream with just audio
            const audioStream = new MediaStream([event.track]);
            videoElement.srcObject = audioStream;
          }
          
          // Ensure audio is enabled
          videoElement.muted = false;
          videoElement.volume = 1.0;
          event.track.enabled = true;
          
          // Trigger autoplay for audio
          setTimeout(() => {
            videoElement.play().catch(() => {
              // Autoplay blocked - user interaction required
            });
          }, 100);
        }
        
        // Set up optimized video event listeners (minimal logging for performance)
        if (!videoElement.onloadedmetadata) {
          videoElement.onloadedmetadata = () => {
            // Minimal logging to prevent performance issues during avatar speaking
            console.log('Avatar video ready');
          };
          
          videoElement.onplay = () => {
            console.log('Avatar video playing');
          };
          
          // Simplified error handling
          videoElement.onerror = (error) => {
            console.error('Avatar video error:', error);
          };
        }
      }
    };

    // Handle connection state changes - optimized logging
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection!.iceConnectionState;
      
      // Only log important state changes to prevent performance issues
      if (state === 'connected' || state === 'failed' || state === 'disconnected') {
        console.log(`WebRTC connection state for device ${this.deviceSessionId}:`, state);
      }
      
      this.emitEvent('connectionStateChanged', { state, deviceId: this.deviceSessionId });
      
      if (state === 'failed' || state === 'disconnected') {
        this.emitEvent('connectionError', { state, deviceId: this.deviceSessionId });
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
    console.log('Starting avatar with WebRTC connection...');
    await new Promise<void>((resolve, reject) => {
      this.avatarSynthesizer!.startAvatarAsync(this.peerConnection!)
        .then((result) => {
          console.log('Avatar start result:', {
            reason: result.reason,
            resultId: result.resultId,
            reasonString: this.getResultReasonString(result.reason)
          });
          
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log('Avatar WebRTC session started successfully');
            resolve();
          } else {
            const errorDetails = this.getDetailedErrorInfo(result);
            console.error('Failed to start avatar:', errorDetails);
            reject(new Error(`Failed to start avatar: ${errorDetails.reason} - ${errorDetails.details}`));
          }
        })
        .catch((error) => {
          console.error('Avatar start promise rejected:', error);
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
   * CRITICAL FLOW STEP 6: Format Text for Azure Avatar API
   */
  private createSSML(text: string, voice: string): string {
    // SAFE TEXT PROCESSING: Ultra-minimal HTML encoding - only escape essential characters
    const encodedText = text.replace(/[&<>]/g, (char) => {
      return char === '&' ? '&amp;' : char === '<' ? '&lt;' : '&gt;';
    });

    // SSML CREATION: Minimal SSML for maximum speed - this is what Azure Avatar API reads
    // VOICE SELECTION: The voice determines how the avatar sounds and looks
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
  /**
   * Start avatar with retry mechanism for connection limits - NO FALLBACKS
   */
  private async startAvatarWithRetry(
    speechConfig: SpeechSDK.SpeechConfig,
    iceServerInfo: { url: string; username: string; credential: string },
    primaryCharacter: string,
    primaryStyle: string,
    videoElementId: string
  ): Promise<void> {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Starting avatar attempt ${attempt}/${maxRetries} for device ${this.deviceSessionId} with ${primaryCharacter}/${primaryStyle}`);
        
        const avatarConfig = this.createAvatarConfig(primaryCharacter, primaryStyle);
        avatarConfig.remoteIceServers = [{
          urls: [iceServerInfo.url],
          username: iceServerInfo.username,
          credential: iceServerInfo.credential
        }];

        console.log(`Creating avatar synthesizer for device ${this.deviceSessionId}...`);
        
        // Clean up any existing avatar synthesizer to prevent multiple instances on this device
        if (this.avatarSynthesizer) {
          try {
            this.avatarSynthesizer.close();
          } catch (closeError) {
            console.warn(`Failed to close existing avatar synthesizer for device ${this.deviceSessionId}:`, closeError);
          }
          this.avatarSynthesizer = null;
        }
        
        this.avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);
        console.log(`Avatar synthesizer created successfully for device ${this.deviceSessionId}`);
        
        // Set up event handlers
        this.setupEventHandlers();
        console.log('Event handlers set up');

        // Set up WebRTC
        console.log('Setting up WebRTC connection...');
        await this.setupWebRTC(iceServerInfo, videoElementId);
        console.log('WebRTC connection established');

        console.log(`Azure Avatar Real-Time session started successfully with ${primaryCharacter}/${primaryStyle} for device ${this.deviceSessionId}`);
        return; // Success! Exit the function
        
      } catch (error) {
        console.warn(`Avatar start attempt ${attempt}/${maxRetries} failed for device ${this.deviceSessionId}:`, error);
        
        // Clean up failed attempt on this device
        if (this.avatarSynthesizer) {
          try {
            this.avatarSynthesizer.close();
          } catch (closeError) {
            console.warn(`Failed to close avatar synthesizer for device ${this.deviceSessionId}:`, closeError);
          }
          this.avatarSynthesizer = null;
        }
        
        // If this is the last attempt, re-throw the error
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff for connection limits)
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Waiting ${delay}ms before retry attempt ${attempt + 1} for device ${this.deviceSessionId}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
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
      console.log(`Found voice for ${languageCode}: ${matchedLanguage.voice}`);
      return matchedLanguage.voice;
    }
    
    // Fallback to multilingual voice or default
    console.log(`No specific voice found for ${languageCode}, using multilingual fallback`);
    return 'en-US-JennyMultilingualNeural';
  }

  /**
   * Speak text with automatic voice selection based on language
   * CRITICAL FLOW STEP 4: Entry Point for Avatar Speech from Copilot Studio
   */
  public async speakWithAutoVoice(text: string, detectedLanguage?: string): Promise<void> {
    // COPILOT STUDIO TEXT to AVATAR SPEECH CONVERSION STARTS HERE
    const language = detectedLanguage || 'en-US';
    const bestVoice = this.getBestVoiceForLanguage(language);
    
    // TRIGGER AVATAR SPEECH: Convert bot text to speaking avatar
    await this.speak(text, bestVoice);
  }

  /**
   * Check if avatar is currently speaking
   */
  public isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get current queue length
   */
  public getQueueLength(): number {
    return this.speakQueue.length;
  }

  /**
   * Clear the speaking queue for this device
   */
  public clearQueue(): void {
    const queueLength = this.speakQueue.length;
    this.speakQueue = [];
    if (queueLength > 0) {
      console.log(`Cleared ${queueLength} items from speaking queue for device ${this.deviceSessionId}`);
    }
  }

  /**
   * Debug information for troubleshooting concurrent requests on this device
   */
  public getDebugInfo(): { 
    deviceSessionId: string;
    isSessionActive: boolean; 
    isSessionStarting: boolean; 
    isSpeaking: boolean; 
    queueLength: number;
    hasAvatarSynthesizer: boolean;
    hasPeerConnection: boolean;
  } {
    return {
      deviceSessionId: this.deviceSessionId,
      isSessionActive: this.isSessionActive,
      isSessionStarting: this.isSessionStarting,
      isSpeaking: this.isSpeaking,
      queueLength: this.speakQueue.length,
      hasAvatarSynthesizer: !!this.avatarSynthesizer,
      hasPeerConnection: !!this.peerConnection
    };
  }

  /**
   * Get the unique device session ID
   */
  public getDeviceSessionId(): string {
    return this.deviceSessionId;
  }

}

export default AzureAvatarRealTimeService;

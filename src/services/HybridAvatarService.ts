import { SpeechService } from './SpeechService';
import { AvatarService } from './AvatarService';

export class HybridAvatarService {
  private speechService: SpeechService;
  private avatarService: AvatarService;
  private isCurrentlySpeaking = false;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    this.speechService = new SpeechService();
    this.avatarService = new AvatarService();
  }

  /**
   * Hybrid approach: Immediate speech + background video generation
   */
  public async speakWithVideoGeneration(text: string): Promise<{ 
    audioStarted: boolean; 
    videoPromise: Promise<string | null> 
  }> {
    try {
      // 1. Start immediate speech synthesis (no wait)
      const audioPromise = this.startImmediateSpeech(text);
      
      // 2. Start background video generation (parallel)
      const videoPromise = this.startBackgroundVideoGeneration(text);
      
      // 3. Wait for audio to start, but don't wait for video
      const audioStarted = await audioPromise;
      
      return {
        audioStarted,
        videoPromise
      };
    } catch (error) {
      console.error('Hybrid avatar service error:', error);
      throw error;
    }
  }

  /**
   * Start immediate speech synthesis
   */
  private async startImmediateSpeech(text: string): Promise<boolean> {
    try {
      // Stop any current speech
      this.stopSpeaking();

      console.log('Starting immediate speech synthesis:', text.substring(0, 50) + '...');
      this.isCurrentlySpeaking = true;
      
      // Emit speaking started event
      this.emitSpeakingEvent('started', text);

      // Use Azure Speech Synthesis for immediate audio
      const audioData = await this.speechService.synthesizeSpeech(text);
      
      // Convert ArrayBuffer to audio and play
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.currentAudio = new Audio(audioUrl);
      
      // Set up audio event listeners
      this.currentAudio.onplay = () => {
        console.log('Immediate speech started playing');
        this.emitSpeakingEvent('playing', text);
      };
      
      this.currentAudio.onended = () => {
        console.log('Immediate speech finished');
        this.isCurrentlySpeaking = false;
        this.emitSpeakingEvent('ended', text);
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };
      
      this.currentAudio.onerror = (error) => {
        console.error('Immediate speech playback error:', error);
        this.isCurrentlySpeaking = false;
        this.emitSpeakingEvent('error', text);
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };

      // Start playback
      await this.currentAudio.play();
      return true;
      
    } catch (error) {
      console.error('Immediate speech synthesis failed:', error);
      this.isCurrentlySpeaking = false;
      this.emitSpeakingEvent('error', text);
      return false;
    }
  }

  /**
   * Start background video generation (doesn't block)
   */
  private async startBackgroundVideoGeneration(text: string): Promise<string | null> {
    try {
      console.log('Starting background video generation:', text.substring(0, 50) + '...');
      
      // Emit video generation started event
      this.emitVideoEvent('generation_started', text);
      
      // Use existing AvatarService for video generation
      const videoUrl = await this.avatarService.synthesizeAvatar(text);
      
      if (videoUrl) {
        console.log('Background video generation completed:', videoUrl);
        this.emitVideoEvent('generation_completed', text, videoUrl);
        return videoUrl;
      } else {
        console.log('Background video generation failed or returned no URL');
        this.emitVideoEvent('generation_failed', text);
        return null;
      }
    } catch (error) {
      console.error('Background video generation failed:', error);
      this.emitVideoEvent('generation_failed', text);
      return null;
    }
  }

  /**
   * Stop current speech
   */
  public stopSpeaking(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.isCurrentlySpeaking) {
      this.isCurrentlySpeaking = false;
      this.emitSpeakingEvent('stopped', '');
    }
  }

  /**
   * Check if avatar is currently speaking
   */
  public isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }

  /**
   * Emit speaking events for UI updates
   */
  private emitSpeakingEvent(status: 'started' | 'playing' | 'ended' | 'stopped' | 'error', text: string): void {
    const event = new CustomEvent('avatarSpeaking', { 
      detail: { status, text, isSpeaking: this.isCurrentlySpeaking } 
    });
    window.dispatchEvent(event);
  }

  /**
   * Emit video generation events for UI updates
   */
  private emitVideoEvent(status: 'generation_started' | 'generation_completed' | 'generation_failed', text: string, videoUrl?: string): void {
    const event = new CustomEvent('avatarVideoGeneration', { 
      detail: { status, text, videoUrl } 
    });
    window.dispatchEvent(event);
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopSpeaking();
    this.speechService.dispose();
    // Note: AvatarService doesn't have dispose method
  }
}

import { SpeechService } from './SpeechService';

export class LiveAvatarService {
  private speechService: SpeechService;
  private isCurrentlySpeaking = false;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    this.speechService = new SpeechService();
  }

  /**
   * Make the avatar speak immediately using Azure Speech Synthesis
   */
  public async speakImmediately(text: string): Promise<void> {
    try {
      // Stop any current speech
      this.stopSpeaking();

      console.log('Avatar starting to speak:', text);
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
        console.log('Avatar audio started playing');
        this.emitSpeakingEvent('playing', text);
      };
      
      this.currentAudio.onended = () => {
        console.log('Avatar finished speaking');
        this.isCurrentlySpeaking = false;
        this.emitSpeakingEvent('ended', text);
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };
      
      this.currentAudio.onerror = (error) => {
        console.error('Avatar audio playback error:', error);
        this.isCurrentlySpeaking = false;
        this.emitSpeakingEvent('error', text);
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };

      // Start playback
      await this.currentAudio.play();
      
    } catch (error) {
      console.error('Avatar speech synthesis failed:', error);
      this.isCurrentlySpeaking = false;
      this.emitSpeakingEvent('error', text);
      throw error;
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
   * Get current speaking status
   */
  public getSpeakingStatus(): { isSpeaking: boolean; text?: string } {
    return {
      isSpeaking: this.isCurrentlySpeaking
    };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopSpeaking();
    this.speechService.dispose();
  }
}

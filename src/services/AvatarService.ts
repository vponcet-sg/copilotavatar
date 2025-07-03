import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import type { AvatarSynthesisJob } from '../types';
import ConfigService from './ConfigService';

export class AvatarService {
  private speechEndpoint: string;
  private speechKey: string;
  private apiVersion = '2024-08-01';

  constructor() {
    const config = ConfigService.getInstance().getSpeechConfig();
    this.speechEndpoint = config.speechEndpoint;
    this.speechKey = config.speechKey;
  }

  /**
   * Create authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      'Ocp-Apim-Subscription-Key': this.speechKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Submit avatar synthesis job
   */
  public async submitSynthesis(text: string): Promise<string> {
    const jobId = uuidv4();
    const avatarConfig = ConfigService.getInstance().getAvatarConfig();
    
    const url = `${this.speechEndpoint}/avatar/batchsyntheses/${jobId}?api-version=${this.apiVersion}`;
    
    const payload = {
      synthesisConfig: {
        voice: avatarConfig.voice,
      },
      customVoices: {},
      inputKind: 'PlainText',
      inputs: [
        {
          content: text,
        },
      ],
      avatarConfig: {
        customized: false,
        talkingAvatarCharacter: avatarConfig.character,
        talkingAvatarStyle: avatarConfig.style,
        videoFormat: 'mp4',
        videoCodec: 'h264',
        subtitleType: 'soft_embedded',
        backgroundColor: '#FFFFFFFF',
      }
    };

    try {
      const response = await axios.put(url, payload, {
        headers: this.getAuthHeaders()
      });

      if (response.status < 400) {
        console.log('Avatar synthesis job submitted successfully');
        console.log('Job ID:', response.data.id);
        return response.data.id;
      } else {
        throw new Error(`Failed to submit avatar synthesis job: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Avatar synthesis submission failed: ${error.response?.data || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get synthesis job status and result
   */
  public async getSynthesis(jobId: string): Promise<AvatarSynthesisJob> {
    const url = `${this.speechEndpoint}/avatar/batchsyntheses/${jobId}?api-version=${this.apiVersion}`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.speechKey
        }
      });

      if (response.status < 400) {
        console.log('Retrieved avatar synthesis job status successfully');
        
        const data = response.data;
        const job: AvatarSynthesisJob = {
          id: data.id,
          status: data.status
        };

        if (data.status === 'Succeeded' && data.outputs?.result) {
          job.downloadUrl = data.outputs.result;
          console.log('Avatar synthesis completed, download URL:', job.downloadUrl);
        }

        return job;
      } else {
        throw new Error(`Failed to get avatar synthesis job: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Avatar synthesis status check failed: ${error.response?.data || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Poll for synthesis completion
   */
  public async waitForCompletion(jobId: string, maxWaitTime = 180000, pollInterval = 5000): Promise<AvatarSynthesisJob> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const job = await this.getSynthesis(jobId);
        
        if (job.status === 'Succeeded') {
          console.log('Avatar synthesis job completed successfully');
          return job;
        } else if (job.status === 'Failed') {
          throw new Error('Avatar synthesis job failed');
        }
        
        const elapsedTime = Math.round((Date.now() - startTime) / 1000);
        console.log(`Avatar synthesis job is still running, status: ${job.status} (${elapsedTime}s elapsed)`);
        
        // Emit progress event for UI updates
        this.emitProgressEvent(job.status, elapsedTime, Math.round(maxWaitTime / 1000));
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error('Error polling avatar synthesis job:', error);
        throw error;
      }
    }
    
    throw new Error(`Avatar synthesis job timed out after ${Math.round(maxWaitTime / 1000)} seconds`);
  }

  /**
   * Emit progress event for UI updates
   */
  private emitProgressEvent(status: string, elapsedSeconds: number, totalSeconds: number): void {
    const event = new CustomEvent('avatarProgress', { 
      detail: { status, elapsedSeconds, totalSeconds, progress: (elapsedSeconds / totalSeconds) * 100 } 
    });
    window.dispatchEvent(event);
  }

  /**
   * Synthesize avatar video from text (convenience method)
   */
  public async synthesizeAvatar(text: string): Promise<string> {
    try {
      console.log('Starting avatar synthesis for text:', text);
      
      // Submit synthesis job
      const jobId = await this.submitSynthesis(text);
      
      // Wait for completion
      const completedJob = await this.waitForCompletion(jobId);
      
      if (!completedJob.downloadUrl) {
        throw new Error('Avatar synthesis completed but no download URL available');
      }
      
      return completedJob.downloadUrl;
    } catch (error) {
      console.error('Avatar synthesis failed:', error);
      throw error;
    }
  }

  /**
   * Synthesize avatar with fallback to audio-only
   */
  public async synthesizeAvatarWithFallback(text: string): Promise<{ videoUrl?: string; audioUrl?: string; isAudioOnly: boolean }> {
    try {
      console.log('Starting avatar synthesis for text:', text);
      
      // Submit synthesis job
      const jobId = await this.submitSynthesis(text);
      
      // Wait for completion with shorter timeout for initial attempt
      const completedJob = await this.waitForCompletion(jobId, 120000); // 2 minutes
      
      if (!completedJob.downloadUrl) {
        throw new Error('Avatar synthesis completed but no download URL available');
      }
      
      return { videoUrl: completedJob.downloadUrl, isAudioOnly: false };
    } catch (error) {
      console.warn('Avatar synthesis failed or timed out, falling back to audio-only:', error);
      
      // Fallback: Just return text for speech synthesis
      return { audioUrl: text, isAudioOnly: true };
    }
  }

  /**
   * List all synthesis jobs (for debugging)
   */
  public async listSynthesisJobs(skip = 0, maxPageSize = 10): Promise<any[]> {
    const url = `${this.speechEndpoint}/avatar/batchsyntheses?api-version=${this.apiVersion}&skip=${skip}&maxpagesize=${maxPageSize}`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.speechKey
        }
      });

      if (response.status < 400) {
        console.log(`Listed ${response.data.values?.length || 0} avatar synthesis jobs`);
        return response.data.values || [];
      } else {
        throw new Error(`Failed to list avatar synthesis jobs: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Avatar synthesis job listing failed: ${error.response?.data || error.message}`);
      }
      throw error;
    }
  }
}

# 🎤🤖 Copilot Studio Speech Avatar Assistant

Real-time speech-to-speech avatar system that converts Copilot Studio bot responses into live avatar video with lip-sync.

**Live Demo**: [https://gydjv2-cbd8hma6fvcuedh5.eastasia-01.azurewebsites.net/](https://gydjv2-cbd8hma6fvcuedh5.eastasia-01.azurewebsites.net/)

## How It Works

```
User Speech → Azure Speech → Copilot Studio Bot → Bot Response → Azure Avatar TTS → Live Video Avatar
```

1. **Speech Recognition**: Azure Speech SDK captures and converts speech to text
2. **Bot Processing**: Text sent to Copilot Studio bot via Direct Line API
3. **Avatar Response**: Bot response converted to avatar speech with lip-sync via Azure Avatar Real-Time API
4. **Video Streaming**: Avatar video delivered via WebRTC

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Azure Speech Services resource
- Microsoft Copilot Studio bot with Direct Line channel
- Azure Avatar Real-Time API access

### Setup & Run

```bash
# 1. Clone and install
git clone https://github.com/vponcet-sg/copilotavatar.git
cd copilotavatar
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials (see below)

# 3. Start the app
npm run dev
# App runs at http://localhost:5173
```

### Environment Configuration

```bash
# Azure Speech Services (Required)
VITE_SPEECH_KEY=your_speech_subscription_key
VITE_SPEECH_REGION=eastus

# Copilot Studio Bot (Required)
VITE_DIRECTLINE_SECRET=your_directline_secret

# Azure Avatar API (Required)
VITE_AVATAR_SUBSCRIPTION_KEY=your_avatar_subscription_key
VITE_AVATAR_REGION=eastus
```

## 🔧 Core Technical Implementation

### How Copilot Studio Response Becomes Avatar Speech

Here's the exact code flow that converts your bot's text response into a speaking avatar:

#### 1. Bot Service Receives Response

```typescript
// src/services/BotService.ts
private setupActivityListener(): void {
  this.directLine.activity$.subscribe({
    next: (activity) => {
      if (activity.from && activity.from.id !== 'user' && activity.type === 'message') {
        const botMessage: BotMessage = {
          id: activity.id || uuidv4(),
          text: activity.text || '',              // ← Bot response text from Copilot Studio
          from: { id: activity.from.id, name: activity.from.name },
          timestamp: new Date(activity.timestamp || Date.now()),
          type: 'bot'
        };

        // Emit event to trigger avatar speech
        this.emitBotResponse(botMessage);
      }
    }
  });
}

private emitBotResponse(message: BotMessage): void {
  const event = new CustomEvent('botResponse', { detail: message });
  window.dispatchEvent(event);                   // ← Triggers avatar speech
}
```

#### 2. App Component Handles Bot Response

```typescript
// src/App.tsx
useEffect(() => {
  const handleBotResponse = async (event: Event) => {
    const customEvent = event as CustomEvent<BotMessage>;
    const botMessage = customEvent.detail;
    
    // Update conversation history
    setAppState(prev => ({
      ...prev,
      botResponse: botMessage.text,
      isProcessing: false
    }));

    // THIS IS THE KEY LINE: Convert bot text to avatar speech
    try {
      if (azureAvatarServiceRef.current && botMessage.text.trim()) {
        await azureAvatarServiceRef.current.speakWithAutoVoice(
          botMessage.text,    // ← Bot's response text
          'en-US'            // ← Language for voice selection
        );
      }
    } catch (error) {
      console.error('Avatar speech failed:', error);
    }
  };

  window.addEventListener('botResponse', handleBotResponse);
  return () => window.removeEventListener('botResponse', handleBotResponse);
}, []);
```

#### 3. Avatar Service Converts Text to Speech

```typescript
// src/services/AzureAvatarRealTimeService.ts
public async speakWithAutoVoice(text: string, detectedLanguage?: string): Promise<void> {
  const language = detectedLanguage || 'en-US';
  const bestVoice = this.getBestVoiceForLanguage(language);
  await this.speak(text, bestVoice);
}

public async speak(text: string, voice?: string): Promise<void> {
  if (!this.avatarSynthesizer || !this.isSessionActive) {
    throw new Error('Avatar session not started');
  }

  // Queue management for multiple requests
  if (this.isSpeaking) {
    return new Promise((resolve, reject) => {
      this.speakQueue.push({ text, voice, resolve, reject });
    });
  }

  this.isSpeaking = true;

  try {
    const selectedVoice = voice || 'en-US-JennyMultilingualNeural';
    const ssml = this.createSSML(text, selectedVoice);
    
    // 🎯 THE MAGIC: Azure Avatar API creates lip-sync video
    const result = await this.avatarSynthesizer.speakSsmlAsync(ssml);

    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
      this.emitEvent('speakingCompleted', { text, voice: selectedVoice });
    } else {
      this.emitEvent('speakingError', { error: `Speech synthesis failed: ${result.reason}` });
    }
  } catch (error) {
    this.emitEvent('speakingError', { error: error.message });
    throw error;
  } finally {
    this.isSpeaking = false;
    this.processNextInQueue();
  }
}

private createSSML(text: string, voice: string): string {
  // Escape XML characters
  const encodedText = text.replace(/[&<>]/g, (char) => {
    return char === '&' ? '&amp;' : char === '<' ? '&lt;' : '&gt;';
  });
  // Create SSML for Azure Avatar API
  return `<speak version="1.0" xml:lang="en-US"><voice name="${voice}">${encodedText}</voice></speak>`;
}
```

#### 4. WebRTC Delivers Live Video

```typescript
// Avatar session setup with WebRTC
private async setupWebRTC(iceServerInfo: any, videoElementId: string): Promise<void> {
  this.peerConnection = new RTCPeerConnection({
    iceServers: [{ 
      urls: [iceServerInfo.url], 
      username: iceServerInfo.username, 
      credential: iceServerInfo.credential 
    }]
  });

  // Handle incoming avatar video stream
  this.peerConnection.ontrack = (event) => {
    if (event.track.kind === 'video') {
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = event.streams[0];  // ← Live avatar video
        videoElement.autoplay = true;
        videoElement.play();
      }
    }
  };

  // Connect avatar synthesizer to WebRTC
  await this.avatarSynthesizer.startAvatarAsync(this.peerConnection);
}
```

### The Key Method

The critical line that bridges Copilot Studio responses to avatar speech:

```typescript
await azureAvatarServiceRef.current.speakWithAutoVoice(botMessage.text, 'en-US');
```

This single method call:
1. Takes any text from your Copilot Studio bot
2. Converts it to SSML with proper voice selection
3. Sends it to Azure Avatar Real-Time API
4. Generates live video with perfect lip-sync
5. Streams it via WebRTC to the user's browser

## 🎮 Usage

1. Open the app and grant microphone permissions
2. Click "Start Listening" 
3. Speak to the app - your speech is converted to text
4. Text is sent to your Copilot Studio bot
5. Bot response is automatically converted to avatar speech
6. Watch the avatar speak your bot's response with lip-sync

## 📁 Key Files

- `src/services/BotService.ts` - Handles Copilot Studio integration
- `src/services/AzureAvatarRealTimeService.ts` - Avatar speech synthesis
- `src/services/SpeechService.ts` - Speech recognition
- `src/App.tsx` - Main app logic and event handling

## 🔗 Useful Links

- [Live Demo](https://gydjv2-cbd8hma6fvcuedh5.eastasia-01.azurewebsites.net/)
- [Azure Avatar Real-Time API Docs](https://docs.microsoft.com/azure/cognitive-services/speech-service/real-time-synthesis)
- [Copilot Studio Documentation](https://docs.microsoft.com/microsoft-copilot-studio/)

---

*Built with ❤️ for conversational AI*

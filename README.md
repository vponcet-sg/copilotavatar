# Speech-to-Speech Live Avatar Assistant

A React TypeScript application that implements a speech-to-speech live avatar system using:
- **Azure Speech Services** for speech recognition and synthesis
- **Microsoft Copilot Studio** bot integration via Direct Line API
- **Azure Avatar Real-Time API** for live video avatar generation with WebRTC
- **Modern React** with TypeScript and Vite for fast development

## 🎯 Features

- **Live Speech Recognition**: Real-time speech-to-text using Azure Speech Services
- **Bot Integration**: Seamless conversation with Copilot Studio bot via Direct Line API
- **Real-Time Avatar**: Live video avatar that speaks bot responses using Azure Avatar Real-Time API
- **WebRTC Streaming**: Real-time video streaming with synchronized speech synthesis  
- **Modern UI**: Responsive React interface with real-time feedback
- **Error Handling**: Comprehensive error handling and diagnostics
- **Environment Configuration**: Secure credential management via environment variables

## 🏗️ Architecture

```
Speech Input → Azure Speech SDK → Text → Copilot Studio Bot → Response Text → Azure Avatar Real-Time API → Live Video + Speech
```

The application uses:
1. **Azure Speech SDK** for speech-to-text conversion
2. **Direct Line API** for bot communication via WebSocket
3. **Azure Avatar Real-Time API** for generating live avatar video with WebRTC
4. **React State Management** for coordinating the speech-to-speech pipeline

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Azure Speech Services resource
- Microsoft Copilot Studio bot with Direct Line channel
- Azure Avatar Real-Time API access (preview)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd copilot-studio-speech-avatar
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your credentials:
```bash
# Azure Speech Services
VITE_SPEECH_KEY=your_speech_key_here
VITE_SPEECH_REGION=your_region_here  
VITE_SPEECH_ENDPOINT=https://your-speech-resource.cognitiveservices.azure.com/

# Bot Framework Direct Line
VITE_DIRECTLINE_SECRET=your_directline_secret_here

# Azure Avatar Real-Time API (uses same credentials as Speech Services)
VITE_AVATAR_SUBSCRIPTION_KEY=your_avatar_subscription_key_here
VITE_AVATAR_REGION=your_avatar_region_here
VITE_AVATAR_ENDPOINT=https://your-avatar-resource.cognitiveservices.azure.com/

# Avatar Configuration
VITE_AVATAR_CHARACTER=lisa
VITE_AVATAR_STYLE=graceful-sitting
VITE_AVATAR_VOICE=en-US-JennyNeural
```

5. Start the development server:
```bash
npm run dev
```

## 🔧 Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SPEECH_KEY` | Azure Speech Services subscription key | `abc123...` |
| `VITE_SPEECH_REGION` | Azure Speech Services region | `westeurope` |
| `VITE_SPEECH_ENDPOINT` | Azure Speech Services endpoint | `https://xxx.cognitiveservices.azure.com/` |
| `VITE_DIRECTLINE_SECRET` | Direct Line channel secret | `xyz789...` |
| `VITE_AVATAR_SUBSCRIPTION_KEY` | Azure Avatar API key (usually same as Speech key) | `abc123...` |
| `VITE_AVATAR_REGION` | Azure Avatar API region | `westeurope` |
| `VITE_AVATAR_ENDPOINT` | Azure Avatar API endpoint | `https://xxx.cognitiveservices.azure.com/` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_AVATAR_CHARACTER` | Avatar character | `lisa` |
| `VITE_AVATAR_STYLE` | Avatar style | `graceful-sitting` |
| `VITE_AVATAR_VOICE` | Speech synthesis voice | `en-US-JennyNeural` |

## 🎮 Usage

1. **Start Conversation**: Click the microphone button to begin speech recognition
2. **Speak**: Talk naturally - your speech will be converted to text and sent to the bot
3. **Watch Avatar**: The live avatar will speak the bot's response in real-time
4. **Troubleshoot**: Use the diagnostics button for detailed system information

## 🔍 Troubleshooting

### Common Issues

**Avatar not appearing:**
- Check that all Avatar API credentials are correct
- Verify WebRTC connection in browser developer tools
- Ensure microphone permissions are granted

**Speech recognition not working:**
- Verify Azure Speech Services credentials
- Check microphone permissions in browser
- Ensure stable internet connection

**Bot not responding:**
- Validate Direct Line secret
- Check bot deployment status in Copilot Studio
- Review browser console for WebSocket errors

### Diagnostics

The app includes a built-in diagnostics modal that shows:
- Configuration validation
- Service connection status  
- WebRTC connection details
- Recent error logs

## 🏃‍♂️ Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/          # React components
│   ├── AzureAvatarPlayer.tsx
│   ├── ConversationHistory.tsx
│   ├── AvatarTroubleshooting.tsx
│   └── UIComponents.tsx
├── services/           # Core services
│   ├── ConfigService.ts
│   ├── SpeechService.ts
│   ├── BotService.ts
│   └── AzureAvatarRealTimeService.ts
├── types/             # TypeScript definitions
└── App.tsx           # Main application
```

## 🔒 Security

- All credentials are managed via environment variables
- No hardcoded secrets in source code
- Secure WebRTC connections for avatar streaming
- Follows Azure security best practices

## 📚 References

- [Azure Speech Services Documentation](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/)
- [Azure Avatar Real-Time API](https://docs.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-avatar)
- [Microsoft Bot Framework Direct Line API](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-direct-line-3-0-concepts)
- [Microsoft Copilot Studio](https://docs.microsoft.com/en-us/microsoft-copilot-studio/)

## 📄 License

MIT License - see LICENSE file for details.

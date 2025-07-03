# Troubleshooting Guide

## Common Issues and Solutions

### 1. Avatar Synthesis Timeouts

**Problem**: Avatar generation takes too long or times out
- **Solution**: The app now automatically falls back to audio-only responses after 2 minutes
- **Why it happens**: Azure Avatar synthesis can take 1-5 minutes depending on text length and service load
- **What you see**: A notification saying "Avatar generation is taking too long, playing audio response instead"

### 2. Microphone Permission Issues

**Problem**: "Microphone permission required" error
- **Solution**: 
  1. Click the microphone icon in your browser's address bar
  2. Select "Allow" for microphone access
  3. Refresh the page if needed
- **Chrome**: Look for 🎤 icon in address bar
- **Safari**: Check Safari > Settings > Websites > Microphone

### 3. Bot Connection Failed

**Problem**: "Failed to connect to bot" error
- **Check**: Direct Line secret is correct in `.env`
- **Verify**: Bot is published in Copilot Studio
- **Ensure**: Direct Line channel is enabled in Azure Bot Service
- **Test**: Try opening the bot in the test chat first

### 4. Speech Recognition Not Working

**Problem**: "Start Listening" button doesn't work
- **Browser support**: Use Chrome, Edge, or Safari (Firefox has limited support)
- **HTTPS required**: Speech SDK requires HTTPS in production
- **Check**: Browser console for specific error messages

### 5. Audio Playback Issues

**Problem**: No sound from avatar or speech synthesis
- **Check**: Browser's audio isn't muted
- **Verify**: System volume is up
- **Try**: Click the video player's unmute button
- **Note**: Some browsers require user interaction before playing audio

### 6. Configuration Errors

**Problem**: "Configuration error" on startup
- **Check**: All required environment variables are set in `.env`
- **Verify**: No typos in region names or endpoints
- **Ensure**: Keys and secrets are valid and not expired

### 7. CORS Errors

**Problem**: Network requests blocked by CORS
- **Development**: Usually not an issue with Vite dev server
- **Production**: Ensure your hosting supports the required domains
- **Azure**: Check that your speech resource allows your domain

## Performance Tips

### For Faster Avatar Generation
1. Keep bot responses concise (shorter text = faster avatar generation)
2. Use simpler sentences
3. The app will automatically use audio-only for long responses

### For Better Speech Recognition
1. Speak clearly and at moderate pace
2. Use a good quality microphone
3. Minimize background noise
4. Check browser's microphone permissions

### For Smooth Operation
1. Use a stable internet connection
2. Close unnecessary browser tabs
3. Use Chrome or Edge for best compatibility

## Debug Mode

### Enable Detailed Logging
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. All services log their operations for debugging

### Check Network Activity
1. Open Developer Tools
2. Go to Network tab
3. Look for failed requests to Azure services

## Getting Help

If issues persist:
1. Check the browser console for specific error messages
2. Verify all Azure services are active and have available quota
3. Test individual components (speech recognition, bot chat, avatar synthesis) separately
4. Ensure your Azure keys and regions are correct

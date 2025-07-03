# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a React TypeScript application that implements a speech-to-speech live avatar system using:
- Azure Speech Services for speech recognition and synthesis
- Microsoft Copilot Studio bot integration via Direct Line API
- Azure Avatar Real-Time API for live video avatar generation
- Modern React with TypeScript and Vite

## Key Technologies
- **Frontend**: React 18 with TypeScript and Vite
- **Speech Services**: Microsoft Cognitive Services Speech SDK
- **Bot Integration**: Bot Framework Direct Line API
- **Live Avatar**: Azure Avatar Real-Time API with WebRTC for live video avatars
- **Authentication**: Azure Identity with managed identity support

## Development Guidelines
- Follow Azure development best practices for security and authentication
- Use environment variables for all sensitive configuration
- Implement proper error handling and retry logic for Azure services
- Use TypeScript for type safety across all components
- Implement responsive design principles for the UI
- Follow React hooks best practices for state management

## Architecture Notes
- Speech input flows through Speech SDK → text → Copilot Studio bot → response text → Azure Avatar Real-Time API
- WebSocket connections are used for real-time bot communication
- Avatar videos are generated in real-time using Azure Avatar Real-Time API with WebRTC
- Visual avatar streams live video with synchronized speech synthesis
- All Azure credentials should use managed identity when possible

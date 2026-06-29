# Jackie Jeans Sizing & Fit Advisor

Jackie Jeans is a conversational voice AI and manual styling questionnaire built to analyze user measurements and preferences, generate a customized fit profile via Gemini, and persist the results in Firestore.

## Features
- **Conversational Voice AI**: Speak directly to Jackie, powered by Deepgram for low-latency streaming transcription and ElevenLabs for text-to-speech.
- **Manual Sizing Questionnaire**: Multi-step interactive flow with custom BubblyButton animations and Lenis smooth scrolling.
- **Dynamic Fit Profiler**: Integrates Gemini 3.1 Flash Lite to parse transcripts, extract details, and output structured fit summaries.
- **Secure Persistence**: Stores profiles in Firestore under verified user sessions with atomic 3-quiz FIFO limits.
- **Rate-Limited Actions**: Uses custom token buckets to throttle abuse.

---


## Directory Structure
- `src/app/`: Next.js App Router folders.
  - `src/app/page.tsx`: Landing page.
  - `src/app/quiz/page.tsx`: Manual quiz flow page.
  - `src/app/voice/page.tsx`: Voice AI styling page.
  - `src/app/signin/page.tsx`: One-time password (OTP) email login.
  - `src/app/profile/page.tsx`: Historical log of saved user profiles.
  - `src/app/api/`: REST endpoints for Deepgram token, ElevenLabs TTS, answer processing, and Firebase operations.
- `src/components/`: Shared UI components (BubblyButton, TextPressure, LenisScroller, GlassSurface).
- `src/lib/`: Client and Admin Firebase initializers, rate limiter, and questionnaire configuration.

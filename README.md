<div align="center">
  <img src="public/images/logo.png" alt="Jackie Jeans Logo" width="150" />
  <h1>👖 Jackie Jeans AI</h1>
  <p><strong>A Next-Generation Voice & Conversational Fit Advisor</strong></p>

  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
  [![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
</div>

<br />

Jackie Jeans is a premium, conversational voice AI and manual styling questionnaire built to analyze user measurements and preferences, generate a customized fit profile, and persist the results securely in the cloud. It completely reimagines the e-commerce onboarding flow by bringing a personalized AI stylist directly into the browser.

---

## ✨ Features

- **🎙️ Conversational Voice AI**: Speak naturally to Jackie! Powered by **Deepgram** for low-latency streaming transcription and **ElevenLabs** for hyper-realistic text-to-speech.
- **✨ Dynamic Fit Profiler**: Integrates **Google Gemini Flash Lite** to parse conversational transcripts, extract context, and output structured, actionable fit summaries.
- **📱 Premium Manual Questionnaire**: A multi-step interactive flow with custom `BubblyButton` animations, glassmorphism UI, and `Lenis` smooth scrolling for a native app feel.
- **🔐 Secure Persistence & Auth**: Uses Firebase Auth (OTP email login) and stores profiles securely in Firestore under verified user sessions with atomic FIFO limits (max 3 profiles per user).
- **🛡️ Rate-Limited Endpoints**: Utilizes custom server-side token buckets to throttle API abuse and protect AI usage.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & Framer Motion
- **AI/LLM**: [Google Gemini](https://deepmind.google/technologies/gemini/)
- **Voice / Speech**: [Deepgram](https://deepgram.com/) (STT) & [ElevenLabs](https://elevenlabs.io/) (TTS)
- **Database & Auth**: [Firebase](https://firebase.google.com/) (Firestore & Authentication)

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### 1. Clone & Install
```bash
git clone https://github.com/your-username/jackie-jeans-onboarding.git
cd jackie-jeans-onboarding
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root of your project and add the following keys. You will need active accounts with Gemini, ElevenLabs, Deepgram, and Firebase.

```env
# AI & Voice Providers
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key

# Email Auth (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin (Secret)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Directory Structure

```text
src/
├── app/                  # Next.js App Router
│   ├── api/              # REST endpoints (TTS, STT, Gemini parsing, Firebase admin)
│   ├── profile/          # Historical log of saved user profiles
│   ├── quiz/             # Manual quiz flow page
│   ├── signin/           # Passwordless OTP email login
│   └── voice/            # Voice AI conversational styling page
├── components/           # Shared UI (BubblyButton, SeamlessVideo, CardNav)
└── lib/                  # Utilities (Firebase init, rate limiters, AI schemas)
```



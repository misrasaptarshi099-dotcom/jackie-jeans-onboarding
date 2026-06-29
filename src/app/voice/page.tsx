'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { questions, Question } from '@/lib/questions';
import BubblyButton from '@/components/BubblyButton';
import { auth } from '@/lib/firebase-client';

interface Answers {
  height: string;
  weight: string;
  waist: string;
  hip: string;
  waistFit: string;
  rise: string;
  thighFit: string;
  brands: string[];
  brandSizes: Record<string, string>;
  frustrations: string[];
}

export interface JackieProfile {
  summary: string;
  fitProfile: {
    primaryIssue: string;
    recommendedRise: string;
    recommendedCut: string;
    avoidCuts: string[];
    sizingNote: string;
    inseamNote: string;
  };
  jackieSays: string;
}

type VoiceStatus = 'idle' | 'speaking' | 'listening' | 'processing' | 'error';

export default function VoiceQuiz({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  // Voice quiz status states
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentBrandIdx, setCurrentBrandIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    height: '',
    weight: '',
    waist: '',
    hip: '',
    waistFit: '',
    rise: '',
    thighFit: '',
    brands: [],
    brandSizes: {},
    frustrations: [],
  });

  const [transcriptText, setTranscriptText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState('');
  const [jackieProfile, setJackieProfile] = useState<JackieProfile | null>(null);
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);

  // Refs for tracking streams and sockets
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const answersRef = useRef<Answers>(answers);
  const isMutedRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const showManualInputRef = useRef(false);

  // Sync answersRef with answers state to avoid stale closure references in async loops
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Main coordinator to start quiz
  const startVoiceStylist = async () => {
    setTranscriptText('Initializing Jackie...');
    const greeting = "Hi there, I'm Jackie, your denim fit stylist. Let's find your perfect pair of jeans, jorts, or loose fits. First, what is your height?";
    try {
      await playSpeech(greeting);
    } catch (e) {
      console.error(e);
    }
    startListening(questions[0], 0);
  };

  // Helper to call ElevenLabs proxy stream and play
  const playSpeech = async (text: string): Promise<void> => {
    if (isUnmountedRef.current || showManualInputRef.current) return;
    setVoiceStatus('speaking');

    const speakNatively = (fallbackText: string) => {
      if (isUnmountedRef.current) return;
      setTranscriptText(`[Jackie]: "${fallbackText}"`);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(fallbackText);
          const voices = window.speechSynthesis.getVoices();
          
          // Find a strictly female voice. Prioritize known female names. Reject explicitly male voices like David.
          let femaleVoice = voices.find(v => 
            v.lang.startsWith('en') && 
            (v.name.includes('Zira') || v.name.includes('Google US English') || v.name.includes('Samantha')) &&
            !v.name.includes('David') && !v.name.includes('Mark')
          );
          
          if (!femaleVoice) {
            femaleVoice = voices.find(v => 
              v.lang.startsWith('en') && !v.name.includes('David') && !v.name.includes('Mark') && !v.name.includes('Male')
            );
          }
          
          if (femaleVoice) utterance.voice = femaleVoice;
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch (speechErr) {
          console.error('Browser SpeechSynthesis error:', speechErr);
        }
      }
    };

    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (isUnmountedRef.current) return;

      // Handle local text fallback indicator or server error response
      if (!res.ok || res.headers.get('X-Voice-Fallback') === 'true') {
        console.warn('ElevenLabs API unavailable or restricted. Simulating voice using subtitles and browser SpeechSynthesis.');
        speakNatively(text);

        const duration = Math.max(2000, text.split(' ').length * 220);
        await new Promise((resolve) => setTimeout(resolve, duration));
        return;
      }

      const audioBlob = await res.blob();
      if (isUnmountedRef.current) return;
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      return new Promise((resolve, reject) => {
        if (isUnmountedRef.current) {
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Component unmounted'));
          return;
        }
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          activeAudioRef.current = null;
          resolve();
        };
        audio.onerror = (e) => {
          URL.revokeObjectURL(audioUrl);
          activeAudioRef.current = null;
          reject(e);
        };
        audio.play().catch(reject);
      });
    } catch (err) {
      console.error('ElevenLabs playback failed, falling back to simulated delay and native SpeechSynthesis.', err);
      speakNatively(text);
      const duration = Math.max(2000, text.split(' ').length * 220);
      await new Promise((resolve) => setTimeout(resolve, duration));
    }
  };

  // Connect to Deepgram and start microphone recording
  const startListening = async (question: Question, brandIdx: number) => {
    if (isUnmountedRef.current || showManualInputRef.current) return;
    if (isMutedRef.current) return;
    setVoiceStatus('listening');
    setTranscriptText('Listening...');
    cleanupStreams();

    try {
      // 1. Get temporary Deepgram token
      const tokenRes = await fetch('/api/deepgram-token');

      // Check lifecycle after async token fetch
      if (isUnmountedRef.current || showManualInputRef.current || isMutedRef.current) return;

      if (!tokenRes.ok) {
        console.warn('Failed to fetch Deepgram token. Activating manual text input.');
        setShowManualInput(true);
        setVoiceStatus('idle');
        setTranscriptText('Unable to access microphone. Please type your response.');
        return;
      }
      const tokenData = await tokenRes.json();
      const token = tokenData.token;

      if (!token || token === 'mock_token_for_local_testing') {
        console.warn('Using offline mock token. Displaying manual text input fallback.');
        setShowManualInput(true);
        setVoiceStatus('idle');
        setTranscriptText('Microphone offline. Please use the text input below to respond.');
        return;
      }

      // Check lifecycle before requesting microphone access
      if (isUnmountedRef.current || showManualInputRef.current || isMutedRef.current) return;

      // 2. Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // If cleanup happened during getUserMedia, release the stream immediately
      if (isUnmountedRef.current || showManualInputRef.current || isMutedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;

      // Generate contextual keywords based on the active question
      let keywordQuery = '&keywords=jeans:2&keywords=denim:2';
      if (question.id === 'waist' || question.id === 'hip' || question.id === 'weight' || question.id === 'height') {
        keywordQuery += '&keywords=inches:3&keywords=pounds:3&keywords=foot:3&keywords=waist:4&keywords=hip:5';
      } else if (question.id === 'waistFit' || question.id === 'rise' || question.id === 'thighFit') {
        keywordQuery += '&keywords=high+rise:4&keywords=mid+rise:4&keywords=low+rise:4&keywords=snug:4&keywords=relaxed:4&keywords=fitted:4&keywords=loose:4';
      } else if (question.id === 'brands' || question.id === 'brandSizes') {
        keywordQuery += '&keywords=zara:5&keywords=levis:5&keywords=asos:5&keywords=uniqlo:5&keywords=everlane:5&keywords=ag+jeans:5&keywords=topshop:5&keywords=wrangler:5&keywords=gap:5';
      } else if (question.id === 'frustrations') {
        keywordQuery += '&keywords=waist+gap:5&keywords=tightness:5&keywords=length:5&keywords=thigh:5&keywords=rise:5';
      }

      // Add replace parameters for common severe mishearings
      const replaceQuery = '&replace=if:hip&replace=sarah:zara&replace=a+sauce:asos';

      // 3. Establish Deepgram WebSocket connection with highly contextual keywords
      const socketUrl = `wss://api.deepgram.com/v1/listen?model=nova-2-conversationalai&language=en-US&smart_format=true&interim_results=true&endpointing=500${keywordQuery}${replaceQuery}`;
      const ws = new WebSocket(socketUrl, ['token', token]);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Deepgram transcription socket.');
        
        // Start streaming chunks of audio WebM format
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        recorder.start(250); // Fire ondataavailable every 250ms
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          const transcript = data.channel?.alternatives[0]?.transcript || '';
          
          if (transcript) {
            setTranscriptText(transcript);
            
            if (data.is_final) {
              console.log('Final Transcript:', transcript);
              // Deepgram endpointing fires when user stops speaking
              cleanupStreams();
              handleProcessResponse(transcript, question, brandIdx);
            }
          }
        } catch (e) {
          console.error('Error parsing Deepgram message:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('Deepgram WebSocket error:', e);
        cleanupStreams();
        setVoiceStatus('idle');
        setTranscriptText('Stylist connection error. Tap keyboard to type.');
        setShowManualInput(true);
      };

      ws.onclose = (event) => {
        console.log('Deepgram WebSocket closed. Code:', event.code, 'Reason:', event.reason || 'No reason provided');
        if (event.code !== 1000 && event.code !== 1005) {
          cleanupStreams();
          setVoiceStatus('idle');
          setTranscriptText('Stylist connection closed. Tap keyboard to type.');
          setShowManualInput(true);
        }
      };

    } catch (err) {
      console.error('Microphone capture / Deepgram setup failed:', err);
      setShowManualInput(true);
      setVoiceStatus('idle');
      setTranscriptText('Unable to access microphone. Please type your response.');
    }
  };

  // Clean up WebSockets and audio tracks
  const cleanupStreams = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
      } catch (e) {}
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  };

  // Start the voice quiz loop once component mounts
  useEffect(() => {
    isUnmountedRef.current = false;
    // Wait for user gesture/engagement
    const initTimer = setTimeout(() => {
      startVoiceStylist();
    }, 1000);

    return () => {
      isUnmountedRef.current = true;
      clearTimeout(initTimer);
      cleanupStreams();
    };
  }, []);

  // Process manual keyboard entry fallback
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;

    const query = manualText;
    setManualText('');
    setShowManualInput(false);
    
    const question = questions[currentIdx];
    handleProcessResponse(query, question, currentBrandIdx);
  };

  // Call Gemini proxy to parse transcript into structured option
  const handleProcessResponse = async (transcript: string, question: Question, brandIdx: number) => {
    setVoiceStatus('processing');
    setTranscriptText(`Processing: "${transcript}"...`);

    const activeBrand = question.id === 'brandSizes' ? answersRef.current.brands[brandIdx] : undefined;

    try {
      const res = await fetch('/api/process-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          questionId: question.id,
          questionType: question.type,
          options: question.options,
          optional: question.optional,
          activeBrand,
          answersState: answersRef.current,
          allQuestions: questions,
        }),
      });

      if (!res.ok) {
        console.error('Process-answer API returned non-OK status:', res.status);
        setVoiceStatus('idle');
        setTranscriptText('Stylist connection error. Tap to retry.');
        setShowManualInput(true);
        return;
      }

      const result = await res.json();
      console.log('Gemini Smart Parsing Result:', result);

      if (!result.needsClarification && result.action) {
        // 1. Apply any global state updates
        const updatedAnswers = { ...answersRef.current };
        // Deep copy brandSizes to ensure no stale references
        updatedAnswers.brandSizes = { ...answersRef.current.brandSizes };
        
        if (result.updates) {
          for (const [key, value] of Object.entries(result.updates)) {
            if (key === 'brandSizes') {
               if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                 // Gemini returned a map of sizes: { "Uniqlo": "28", "Zara": "28" }
                 for (const [b, v] of Object.entries(value)) {
                   let cleanV = String(v).replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 10);
                   updatedAnswers.brandSizes[b] = cleanV;
                 }
               } else if (activeBrand) {
                 // Gemini returned a primitive size value for the active brand
                 let cleanV = String(value).replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 10);
                 updatedAnswers.brandSizes[activeBrand] = cleanV;
               }
            } else if (key === 'brands' || key === 'frustrations') {
               updatedAnswers[key] = Array.isArray(value) ? (value as string[]) : [String(value)];
            } else if (['height', 'weight', 'waist', 'hip', 'waistFit', 'rise', 'thighFit'].includes(key)) {
               const k = key as 'height' | 'weight' | 'waist' | 'hip' | 'waistFit' | 'rise' | 'thighFit';
               updatedAnswers[k] = String(value).slice(0, 30);
            }
          }
          setAnswers(updatedAnswers);
        }

        // 2. Play confirmation audio
        if (result.displayText) {
          await playSpeech(result.displayText);
        }

        // 3. Handle Navigation Action
        const actualIdx = questions.findIndex(q => q.id === question.id);
        
        if (result.action === 'REPEAT') {
          speakAndQueryNext(actualIdx, brandIdx, updatedAnswers);
        } else if (result.action === 'PREVIOUS') {
          // Go back one question
          if (question.id === 'brandSizes') {
             if (brandIdx > 0) {
                speakAndQueryNext(actualIdx, brandIdx - 1, updatedAnswers);
             } else {
                setCurrentIdx(actualIdx - 1);
                speakAndQueryNext(actualIdx - 1, 0, updatedAnswers);
             }
          } else if (question.id === 'frustrations' && updatedAnswers.brands.length > 0) {
             // Return to last brand size, not the first one
             const lastBrandIdx = updatedAnswers.brands.length - 1;
             setCurrentIdx(8);
             setCurrentBrandIdx(lastBrandIdx);
             speakAndQueryNext(8, lastBrandIdx, updatedAnswers);
          } else if (actualIdx > 0) {
             setCurrentIdx(actualIdx - 1);
             speakAndQueryNext(actualIdx - 1, 0, updatedAnswers);
          } else {
             // Already at start
             speakAndQueryNext(actualIdx, brandIdx, updatedAnswers);
          }
        } else if (result.action === 'STAY') {
          speakAndQueryNext(actualIdx, brandIdx, updatedAnswers);
        } else {
          // NEXT
          advanceVoiceStylist(question, brandIdx, updatedAnswers);
        }

      } else {
        // Needs clarification
        try {
          await playSpeech(result.clarificationPrompt || "I didn't quite catch that. Could you repeat?");
        } catch (e) {
          console.error(e);
        }
        startListening(question, brandIdx);
      }
    } catch (err) {
      console.error('Answer processing failed:', err);
      setVoiceStatus('error');
      setTranscriptText('Stylist connection error. Tap to retry.');
    }
  };

  // Voice state machine progression
  const advanceVoiceStylist = async (currentQuestion: Question, brandIdx: number, currentAnswers: Answers) => {
    // Q8 Brands completed
    if (currentQuestion.id === 'brands') {
      if (currentAnswers.brands.length > 0) {
        setCurrentIdx(8);
        setCurrentBrandIdx(0);
        speakAndQueryNext(8, 0, currentAnswers);
      } else {
        // Skip Brand sizes entirely
        setCurrentIdx(9);
        speakAndQueryNext(9, 0, currentAnswers);
      }
      return;
    }

    // Q9 Brand Sizes completed loop
    if (currentQuestion.id === 'brandSizes') {
      if (brandIdx < currentAnswers.brands.length - 1) {
        const nextBrandIdx = brandIdx + 1;
        setCurrentBrandIdx(nextBrandIdx);
        speakAndQueryNext(8, nextBrandIdx, currentAnswers);
      } else {
        // Loop complete, proceed to frustrations
        setCurrentIdx(9);
        speakAndQueryNext(9, 0, currentAnswers);
      }
      return;
    }

    // Q10 Frustrations completed -> Save profile to DB and finish
    if (currentQuestion.id === 'frustrations') {
      handleSubmitProfile(currentAnswers);
      return;
    }

    // Standard increment
    const actualIdx = questions.findIndex(q => q.id === currentQuestion.id);
    const nextIdx = actualIdx + 1;
    setCurrentIdx(nextIdx);
    speakAndQueryNext(nextIdx, 0, currentAnswers);
  };

  // Speak next question label and open connection
  const speakAndQueryNext = async (idx: number, bIdx: number, currentAnswers: Answers) => {
    const question = questions[idx];
    let queryText = question.jackieSays;

    if (question.id === 'brandSizes') {
      const activeBrand = currentAnswers.brands[bIdx];
      if (!activeBrand) {
        // Safeguard skip to frustrations
        setCurrentIdx(9);
        speakAndQueryNext(9, 0, currentAnswers);
        return;
      }
      queryText = `What size did you wear in ${activeBrand}?`;
    }

    setTranscriptText('');
    try {
      await playSpeech(queryText);
    } catch (e) {
      console.error(e);
    }
    startListening(question, bIdx);
  };

  // Save profile server-side on voice flow completion
  const handleSubmitProfile = async (currentAnswers: Answers) => {
    setIsSubmitting(true);
    setVoiceStatus('processing');
    setTranscriptText('Jackie is preparing your profile...');

    let hasSavedProfile = false;
    let hasGeneratedProfile = false;

    try {
      // Fetch user ID Token if logged in
      const currentUser = auth.currentUser;
      let token: string | null = null;
      if (currentUser) {
        try {
          token = await currentUser.getIdToken();
        } catch (tokenErr) {
          console.error('Failed to retrieve user ID token in Voice:', tokenErr);
        }
      }

      const saveHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        saveHeaders['Authorization'] = `Bearer ${token}`;
      }

      const [saveRes, profileRes] = await Promise.all([
        fetch('/api/save-profile', {
          method: 'POST',
          headers: saveHeaders,
          body: JSON.stringify(currentAnswers),
        }).catch(err => {
          console.error('Failed to save profile to Firestore:', err);
          return null;
        }),
        fetch('/api/generate-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: currentAnswers }),
        }).catch(err => {
          console.error('Failed to generate profile with Gemini:', err);
          return null;
        })
      ]);

      if (saveRes && saveRes.ok) {
        const saveData = await saveRes.json();
        if (saveData.success && saveData.id) {
          setSavedProfileId(saveData.id);
          hasSavedProfile = true;
        }
      } else if (saveRes && !saveRes.ok) {
        console.warn('DB Save warning in Voice.');
      }

      if (profileRes && profileRes.ok) {
        const profileData = await profileRes.json();
        setJackieProfile(profileData);
        hasGeneratedProfile = true;
        try {
          localStorage.setItem('jackieProfile', JSON.stringify(profileData));
        } catch (e) {
          console.error('Failed to write to localStorage:', e);
        }
      }
    } catch (err) {
      console.error('Unhandled error in Voice Quiz submission:', err);
    } finally {
      setIsSubmitting(false);
      // Only mark completed if we got a saved profile or a generated profile
      if (hasSavedProfile || hasGeneratedProfile) {
        setIsCompleted(true);
      }
    }
  };

  // Redirect to final vercel app with secure opaque profileId
  const handleRedirect = () => {
    const params = new URLSearchParams();
    if (savedProfileId) {
      params.set('profileId', savedProfileId);
    }

    // Use window.location.href for external redirects as Next.js router.push expects internal paths
    window.location.href = `https://jackie-jeans.vercel.app/?${params.toString()}`;
  };

  // Toggle mic mute/pause
  const toggleMute = () => {
    const targetMute = !isMuted;
    setIsMuted(targetMute);
    isMutedRef.current = targetMute;

    if (targetMute) {
      cleanupStreams();
      setVoiceStatus('idle');
      setTranscriptText('Microphone muted.');
    } else {
      const question = questions[currentIdx];
      startListening(question, currentBrandIdx);
    }
  };

  // Waveform pulsing animation states
  const renderWaveform = () => {
    if (voiceStatus === 'listening') {
      return (
        <div className="relative w-36 h-36 flex items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.25, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 rounded-full bg-primary/20 border border-primary/40"
          />
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 0.4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.1,
            }}
            className="w-24 h-24 rounded-full bg-primary/40 border border-primary/60 flex items-center justify-center"
          >
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(229,196,135,0.6)]">
              <svg className="w-6 h-6 text-black fill-current animate-pulse" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
          </motion.div>
        </div>
      );
    }

    if (voiceStatus === 'processing') {
      return (
        <div className="relative w-36 h-36 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      );
    }

    if (voiceStatus === 'speaking') {
      return (
        <div className="relative w-36 h-36 flex items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.12, 1],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="w-20 h-20 rounded-full border border-primary text-primary flex items-center justify-center relative shadow-[0_0_15px_rgba(229,196,135,0.2)]"
          >
            <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              🎙️
            </span>
          </motion.div>
        </div>
      );
    }

    // Default 'idle' slow pulse
    return (
      <div
        onClick={() => {
          // Allow click on waveform to retry listening if stuck
          const question = questions[currentIdx];
          startListening(question, currentBrandIdx);
        }}
        className="relative w-36 h-36 flex items-center justify-center cursor-pointer"
      >
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-20 h-20 rounded-full border border-white/20 text-white/50 flex items-center justify-center hover:border-primary/40 hover:text-primary transition-all duration-300"
        >
          <span className="text-xl">🎙️</span>
        </motion.div>
      </div>
    );
  };

  // Return completion screen on success
  if (isCompleted) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center p-8 bg-background text-on-surface">
        <div className="w-full max-w-[420px] bg-neutral-900 border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
          <div className="w-20 h-20 mb-6 flex items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <svg
              className="w-10 h-10 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6 }}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="font-display text-2xl font-bold text-pure-white mb-2">
            Your fit profile is ready.
          </h2>
          <p className="font-body text-xs text-white/50 mb-6 leading-relaxed">
            Jackie has compiled your metrics and preferences. You&apos;re ready to see recommendations.
          </p>

          {jackieProfile?.jackieSays && (
            <div className="w-full bg-white/5 border border-white/5 rounded-xl p-4 mb-6 text-left relative overflow-hidden">
              <span className="absolute top-1 left-2 text-3xl font-serif text-primary/20 leading-none">“</span>
              <p className="font-body text-xs text-white/80 italic leading-relaxed pl-5 pr-2">
                {jackieProfile.jackieSays}
              </p>
            </div>
          )}

          <div className="w-full border-t border-white/10 py-5 flex flex-col gap-3.5 mb-8 text-left font-body text-xs">
            <div className="flex justify-between">
              <span className="text-white/40">Height</span>
              <span className="text-pure-white font-semibold">{answers.height}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Waist Size</span>
              <span className="text-pure-white font-semibold">{answers.waist}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Hip Width</span>
              <span className="text-pure-white font-semibold">{answers.hip}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Style fit</span>
              <span className="text-pure-white font-semibold">{answers.thighFit} Fit</span>
            </div>
          </div>

          <BubblyButton
            variant="primary"
            onClick={handleRedirect}
            className="w-full h-12 rounded-xl font-body text-xs font-semibold tracking-wider uppercase hover:bg-pure-white"
          >
            See Your Recommendations &rarr;
          </BubblyButton>
        </div>
      </div>
    );
  }

  // Top status label based on styling voiceStatus
  const getStatusLabel = () => {
    if (voiceStatus === 'listening') return 'Jackie is listening';
    if (voiceStatus === 'speaking') return 'Jackie is speaking';
    if (voiceStatus === 'processing') return 'Analyzing response...';
    return 'Your turn';
  };

  return (
    <div className="w-full h-screen bg-background text-on-surface flex flex-col items-center justify-between p-6 overflow-hidden">
      
      {/* Top Header Controls */}
      <div className="w-full max-w-[460px] flex justify-between items-center mt-2">
        <div className="flex flex-col">
          <span className="font-body text-[10px] text-primary tracking-[0.25em] uppercase font-semibold">
            VOICE MODE
          </span>
          <span className="font-body text-xs text-white/50">
            Stylist Session
          </span>
        </div>
        <BubblyButton
          variant="outline"
          onClick={() => {
            if (confirm('Are you sure you want to leave voice mode? Progress will be lost.')) {
              cleanupStreams();
              if (onClose) {
                onClose();
              } else {
                router.push('/');
              }
            }
          }}
          className="text-xs text-white/40 hover:text-white/70 uppercase tracking-wider font-semibold border border-white/10 rounded-full px-4 py-2"
        >
          Exit
        </BubblyButton>
      </div>

      {/* Main Core waveform elements */}
      <main className="w-full flex-1 flex flex-col items-center justify-center gap-8">
        
        {/* Status label */}
        <span className="font-body text-xs text-white/40 uppercase tracking-widest transition-opacity duration-300">
          {getStatusLabel()}
        </span>

        {/* Central waveform ring */}
        {renderWaveform()}

        {/* Floating Transcript view */}
        <div className="w-full max-w-[340px] min-h-[90px] text-center px-4 flex items-center justify-center">
          <p className="font-display italic text-lg text-pure-white/90 leading-relaxed font-semibold transition-all duration-300">
            {transcriptText || '“Speak naturally to answer...”'}
          </p>
        </div>

        {/* Manual Keyboard input fallback option */}
        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="w-full max-w-[360px] flex gap-2">
            <input
              type="text"
              placeholder="Type your response here..."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              className="flex-1 bg-neutral-900 border border-white/10 focus:border-primary rounded-xl px-4 py-3 text-sm text-pure-white outline-none transition-colors"
            />
            <BubblyButton
              type="submit"
              variant="primary"
              className="px-5 h-11 text-xs rounded-xl font-semibold uppercase tracking-wide"
            >
              Send
            </BubblyButton>
          </form>
        )}
      </main>

      {/* Bottom control bar (Mute & Keyboard triggers) */}
      <div className="w-full max-w-[460px] flex justify-between items-center mb-4">
        {/* Microphone mute toggle */}
        <BubblyButton
          variant="blank"
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${
            isMuted
              ? 'border-red-500/30 bg-red-500/10 text-red-500'
              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/8'
          }`}
          aria-label="Mute microphone"
        >
          {isMuted ? (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.79 1.79c-.76.51-1.6.83-2.44.89V21h-2v-3.03c-3.26-.47-6-3.23-6-6.97H5c0 3.33 2.45 6.13 5.6 6.81L4.27 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
          )}
        </BubblyButton>

        {/* Manual Keyboard toggle button */}
        <BubblyButton
          variant="blank"
          onClick={() => {
            const nextVal = !showManualInput;
            setShowManualInput(nextVal);
            showManualInputRef.current = nextVal;
            if (nextVal) {
              cleanupStreams();
              setVoiceStatus('idle');
            }
          }}
          className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${
            showManualInput
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/8'
          }`}
          aria-label="Toggle keyboard input"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-3 0h2v2H5v-2zm0-3h2v2H5V8zm3 6h8v2H8v-2zm8-3h2v2h-2v-2zm0-3h2v2h-2V8zm3 3h2v2h-2v-2zm0-3h2v2h-2V8z" />
          </svg>
        </BubblyButton>
      </div>

      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span className="font-body text-xs text-white/70 mt-4 tracking-wider uppercase font-semibold">
            Calibrating Your Fit...
          </span>
        </div>
      )}
    </div>
  );
}

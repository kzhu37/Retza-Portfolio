import { useState, useRef, useCallback, useEffect } from 'react'

type SpeechState = 'idle' | 'listening' | 'unsupported'

interface UseSpeechInput {
  state: SpeechState
  toggle: () => void
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript?: string }>>
}

interface SpeechRecognitionErrorEventLike {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

// Extend window for the vendor-prefixed API present in Chromium
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function useSpeechInput(onResult: (text: string) => void): UseSpeechInput {
  const [state, setState] = useState<SpeechState>('idle')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  // Detect support once on mount
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (!isSupported) setState('unsupported')
  }, [isSupported])

  // Stop and clean up on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const toggle = useCallback(() => {
    if (!isSupported) return

    if (state === 'listening') {
      recognitionRef.current?.stop()
      setState('idle')
      return
    }

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) onResult(transcript)
    }

    recognition.onerror = (event) => {
      // 'aborted' fires when we call .stop() ourselves — not a real error
      if (event.error !== 'aborted') {
        console.warn('[speech]', event.error)
      }
      setState('idle')
    }

    recognition.onend = () => {
      setState('idle')
    }

    recognition.start()
    setState('listening')
  }, [state, isSupported, onResult])

  return { state, toggle }
}

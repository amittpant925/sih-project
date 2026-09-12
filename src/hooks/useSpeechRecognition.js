import { useCallback, useEffect, useRef, useState } from 'react';

export const VOICE_STATES = {
  idle: 'idle',
  listening: 'listening',
  processing: 'processing',
  error: 'error',
  success: 'success',
};

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({ lang = 'en-IN' } = {}) {
  const recognitionRef = useRef(null);
  const resultRef = useRef('');
  const cancelledRef = useRef(false);
  const [state, setState] = useState(VOICE_STATES.idle);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    recognitionRef.current?.stop();
    setState(VOICE_STATES.idle);
  }, []);

  const reset = useCallback(() => {
    resultRef.current = '';
    setInterimTranscript('');
    setFinalTranscript('');
    setError('');
    setState(VOICE_STATES.idle);
  }, []);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setSupported(false);
      setError('unsupported');
      setState(VOICE_STATES.error);
      return;
    }

    cancelledRef.current = false;
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    resultRef.current = '';
    setError('');
    setInterimTranscript('');
    setFinalTranscript('');
    setState(VOICE_STATES.listening);

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const piece = event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) finalText += piece;
        else interim += piece;
      }
      if (interim) setInterimTranscript(interim.trim());
      if (finalText) {
        resultRef.current = finalText.trim();
        setFinalTranscript(finalText.trim());
        setState(VOICE_STATES.processing);
      }
    };

    recognition.onerror = (event) => {
      const code = event.error;
      if (code === 'aborted' || cancelledRef.current) return;
      setError(code === 'not-allowed' || code === 'service-not-allowed' ? 'denied' : code === 'network' ? 'network' : 'no-speech');
      setState(VOICE_STATES.error);
    };

    recognition.onend = () => {
      if (cancelledRef.current) {
        setState(VOICE_STATES.idle);
        return;
      }
      if (resultRef.current) {
        setState(VOICE_STATES.success);
        return;
      }
      setState((current) => (current === VOICE_STATES.error ? current : VOICE_STATES.error));
      setError((current) => current || 'generic');
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError('generic');
      setState(VOICE_STATES.error);
    }
  }, [lang]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { state, interimTranscript, finalTranscript, error, supported, start, stop, reset };
}

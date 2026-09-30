import React, { useState, useRef, useEffect } from 'react';

// Optional Web Speech Synthesis for spoken confirmation
function speakFeedback(text) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  }
}

export default function AiVoiceMic({
  currentDate,
  currentView,
  labels,
  onNavigateView,
  onDateChange,
  onAddTask,
  onCompleteTask,
  onDeleteTask,
  onAddTarget,
  onPinTarget,
  onDeleteTarget,
  onAddEvent,
  onDeleteEvent,
  onAddLabel,
  onDeleteLabel,
  onUpdateSettings,
  onToggleSettingsModal,
  onSignOut,
}) {
  const [listening, setListening] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState('');

  const [useDirectAudio, setUseDirectAudio] = useState(false);
  const [manualCmd, setManualCmd] = useState('');

  // Auto-dismiss errors after 6 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const feedbackTimerRef = useRef(null);

  // Direct Audio Recorder using browser microphone (bypasses browser cloud speech network)
  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Pick best supported MIME type
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        if (audioChunksRef.current.length > 0) {
          executeVoiceCommand('', audioBlob);
        }
      };

      mediaRecorder.start();
      setListening(true);
      setError('');
      setUseDirectAudio(true);
    } catch (err) {
      console.error('Audio recorder error:', err);
      setError('Microphone permission required. Please allow microphone access or type command below.');
      setListening(false);
    }
  };

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && !useDirectAudio) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Indian English / general English fits JEE terminology

      recognition.onstart = () => {
        setListening(true);
        setError('');
        setFeedback(null);
      };

      recognition.onresult = (event) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        setTranscript(current);
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition notice:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('Microphone access blocked. Please allow mic permissions in browser.');
          setListening(false);
        } else if (event.error === 'network') {
          // Browser cloud speech recognition failed (e.g. firewall/network block).
          // Seamlessly auto-switch to direct local audio recording with Gemini AI!
          console.log('SpeechRecognition network issue detected. Seamlessly auto-switching to direct audio recording...');
          setUseDirectAudio(true);
          try {
            recognition.abort();
          } catch {}
          startMediaRecorder();
        } else if (event.error !== 'no-speech') {
          setError(`Mic notice: ${event.error}`);
          setListening(false);
        } else {
          setListening(false);
        }
      };

      recognition.onend = () => {
        // If not in mediaRecorder mode, reset listening
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
          setListening(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, [useDirectAudio]);

  // Process recognized command with Gemini AI
  const executeVoiceCommand = async (textToProcess, audioBlob = null) => {
    if (!textToProcess && !audioBlob) return;
    setAnalyzing(true);
    setError('');

    try {
      let payload = {
        currentDate: currentDate || new Date().toISOString().slice(0, 10),
        currentView: currentView || 'day',
        existingLabels: labels.map((l) => l.name),
      };

      if (audioBlob) {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result?.toString().split(',')[1] || '');
        });
        reader.readAsDataURL(audioBlob);
        payload.audioBase64 = await base64Promise;
        payload.mimeType = audioBlob.type || 'audio/webm';
      } else {
        payload.speechText = textToProcess;
      }

      const res = await fetch('/api/parse-voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to interpret voice command');
      }

      const { action, feedback: actionFeedback, payload: p } = resData.data;

      // Execute matched action across app features
      switch (action) {
        case 'navigate_view': {
          if (p.view === 'label' && p.labelName) {
            const matched = labels.find((l) => l.name.toLowerCase() === p.labelName.toLowerCase());
            if (matched && onNavigateView) onNavigateView('label:' + matched.id);
            else if (onNavigateView) onNavigateView('day');
          } else if (onNavigateView) {
            onNavigateView(p.view || 'day');
          }
          break;
        }

        case 'change_date': {
          if (p.relativeDays !== undefined && onDateChange) {
            const d = new Date((currentDate || new Date().toISOString().slice(0, 10)) + 'T00:00');
            d.setDate(d.getDate() + p.relativeDays);
            onDateChange(d.toISOString().slice(0, 10));
          } else if (p.date && onDateChange) {
            onDateChange(p.date);
          }
          if (onNavigateView && currentView !== 'day') {
            onNavigateView('day');
          }
          break;
        }

        case 'add_task': {
          if (onAddTask) {
            await onAddTask(
              p.section || 'lectures',
              p.text || textToProcess,
              p.type || 'task',
              p.date || currentDate,
              p.labelName || null
            );
          }
          break;
        }

        case 'complete_task': {
          if (onCompleteTask) {
            await onCompleteTask(p.targetQuery || textToProcess);
          }
          break;
        }

        case 'delete_task': {
          if (onDeleteTask) {
            await onDeleteTask(p.targetQuery || textToProcess);
          }
          break;
        }

        case 'add_target': {
          if (onAddTarget) {
            await onAddTarget(p.targetName, p.deadline, p.note);
          }
          break;
        }

        case 'pin_target': {
          if (onPinTarget) {
            await onPinTarget(p.targetQuery);
          }
          break;
        }

        case 'delete_target': {
          if (onDeleteTarget) {
            await onDeleteTarget(p.targetQuery);
          }
          break;
        }

        case 'add_event': {
          if (onAddEvent) {
            await onAddEvent(p.title, p.date, p.time, p.eventType);
          }
          break;
        }

        case 'delete_event': {
          if (onDeleteEvent) {
            await onDeleteEvent(p.eventQuery);
          }
          break;
        }

        case 'add_label': {
          if (onAddLabel && p.labelName) {
            await onAddLabel(p.labelName);
          }
          break;
        }

        case 'delete_label': {
          if (onDeleteLabel && p.labelName) {
            await onDeleteLabel(p.labelName);
          }
          break;
        }

        case 'update_settings': {
          if (onUpdateSettings) {
            const patch = {};
            if (p.wallpaper) patch.wall = p.wallpaper;
            if (p.layout) patch.layout = p.layout;
            if (p.collapsed !== undefined) patch.collapsed = p.collapsed;
            if (p.accent) patch.accent = p.accent;
            if (p.toggleSidebar) patch.collapsed = '__toggle__';
            onUpdateSettings(patch);
          }
          break;
        }

        case 'open_settings': {
          if (onToggleSettingsModal) onToggleSettingsModal(true);
          break;
        }

        case 'close_settings': {
          if (onToggleSettingsModal) onToggleSettingsModal(false);
          break;
        }

        case 'sign_out': {
          if (onSignOut) onSignOut();
          break;
        }

        default: {
          if (onAddTask) {
            await onAddTask('lectures', textToProcess, 'task', currentDate, null);
          }
          break;
        }
      }

      const msg = actionFeedback || 'Action executed!';
      setFeedback({ message: msg });
      speakFeedback(msg);

      // Auto dismiss feedback banner
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
      }, 4500);

      setTranscript('');
    } catch (err) {
      console.error('Voice command execution failed:', err);
      setError(err?.message || 'Could not understand command');
    } finally {
      setAnalyzing(false);
    }
  };

  // Toggle microphone recording
  const toggleListening = async () => {
    setError('');

    // If currently analyzing, do nothing
    if (analyzing) return;

    // If currently listening, stop and process
    if (listening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setListening(false);

      if (transcript.trim()) {
        executeVoiceCommand(transcript.trim());
      }
      return;
    }

    // Start listening
    setTranscript('');

    if (useDirectAudio) {
      return startMediaRecorder();
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition start failed, switching to MediaRecorder:', err);
        return startMediaRecorder();
      }
    }

    // Fallback: MediaRecorder
    return startMediaRecorder();
  };

  return (
    <div className="ai-voice-floating-container">
      {/* Floating Action / Result Banner popping up right above bottom-right button */}
      {listening && (
        <div className="ai-voice-live-hud">
          <div className="ai-listening-indicator">
            <span className="ai-dot-pulse" />
            <b>{useDirectAudio ? 'Recording audio for Gemini AI…' : 'Listening for command…'}</b>
          </div>
          <div className="ai-transcript-preview">
            {useDirectAudio
              ? '🎙️ Speaking... Click the mic button again when you finish speaking!'
              : (transcript || 'Say anything: "Go to Calendar", "Add Optics to Lectures", "Mark optics done", "Wallpaper dusk"…')}
          </div>
          <div className="ai-live-actions">
            <button
              type="button"
              className="pill"
              style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={() => {
                if (recognitionRef.current) {
                  try { recognitionRef.current.stop(); } catch {}
                }
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  mediaRecorderRef.current.stop();
                }
                setListening(false);
                if (transcript.trim()) executeVoiceCommand(transcript.trim());
              }}
            >
              Done & Run
            </button>
            <button
              type="button"
              className="muted"
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => {
                if (recognitionRef.current) {
                  try { recognitionRef.current.stop(); } catch {}
                }
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  mediaRecorderRef.current.stop();
                }
                setListening(false);
                setTranscript('');
              }}
            >
              Cancel
            </button>
          </div>

          {/* Quick text input option */}
          <form
            style={{ display: 'flex', gap: 6, marginTop: 4 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCmd.trim()) {
                if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  mediaRecorderRef.current.stop();
                }
                setListening(false);
                executeVoiceCommand(manualCmd.trim());
                setManualCmd('');
              }
            }}
          >
            <input
              value={manualCmd}
              onChange={(e) => setManualCmd(e.target.value)}
              placeholder="Or type command here…"
              style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
            />
            <button type="submit" className="pill" style={{ padding: '5px 10px', fontSize: 11 }}>
              Send
            </button>
          </form>
        </div>
      )}

      {/* Analyzing state banner */}
      {analyzing && (
        <div className="ai-voice-live-hud analyzing">
          <div className="ai-analyzing-content">
            <i className="ti ti-sparkles ai-spin" style={{ color: 'var(--accent)', fontSize: 20 }} />
            <span>Analyzing command with Gemini AI…</span>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div className="ai-voice-live-hud feedback">
          <div className="ai-feedback-header">
            <i className="ti ti-circle-check-filled" style={{ color: '#22c55e', fontSize: 20 }} />
            <span className="ai-feedback-text">{feedback.message}</span>
            <button
              type="button"
              className="x"
              style={{ marginLeft: 'auto', padding: 2 }}
              onClick={() => setFeedback(null)}
            >
              <i className="ti ti-x" />
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="ai-voice-live-hud error">
          <i className="ti ti-alert-triangle" style={{ fontSize: 18 }} />
          <span>{error}</span>
          <button type="button" className="x" style={{ marginLeft: 'auto' }} onClick={() => setError('')}>
            <i className="ti ti-x" />
          </button>
        </div>
      )}

      {/* SUITABLY ENLARGED FLOATING MIC TOGGLE (NO TEXT) IN BOTTOM RIGHT */}
      <button
        type="button"
        id="ai-voice-fab"
        className={`ai-fab-mic-btn ${listening ? 'listening' : ''} ${analyzing ? 'analyzing' : ''}`}
        title={listening ? 'Click to finish speaking' : analyzing ? 'AI is processing command…' : 'Toggle Voice Controller (Control the entire website with your voice)'}
        onClick={toggleListening}
        disabled={analyzing}
        aria-label="Voice Controller"
      >
        <div className="ai-fab-icon-wrap">
          {analyzing ? (
            <i className="ti ti-sparkles ai-spin" />
          ) : (
            <i className={listening ? 'ti ti-microphone' : 'ti ti-microphone'} />
          )}
        </div>

        {listening && (
          <span className="ai-fab-ripples">
            <span className="ai-ripple-1" />
            <span className="ai-ripple-2" />
          </span>
        )}
      </button>
    </div>
  );
}

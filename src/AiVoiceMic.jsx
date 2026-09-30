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

// Client-side rule-based command engine (guaranteed zero-downtime fallback)
function clientParseVoiceCommand(speechText, currentDate, labels = []) {
  const textLower = speechText.toLowerCase().trim();
  const today = currentDate || new Date().toISOString().slice(0, 10);
  const labelNames = labels.map((l) => (typeof l === 'string' ? l : l.name));

  // 1. Navigation
  if (textLower.includes('calendar') || textLower.includes('month view')) {
    return { action: 'navigate_view', feedback: 'Switched to Calendar view', payload: { view: 'cal' } };
  }
  if (textLower.includes('analysis') || textLower.includes('analytics') || textLower.includes('progress') || textLower.includes('stats')) {
    return { action: 'navigate_view', feedback: 'Switched to Analysis view', payload: { view: 'analysis' } };
  }
  if (textLower.includes('target') || textLower.includes('countdown') || textLower.includes('goals')) {
    if (!textLower.startsWith('add ') && !textLower.startsWith('new ') && !textLower.startsWith('pin ') && !textLower.startsWith('delete ') && !textLower.startsWith('remove ')) {
      return { action: 'navigate_view', feedback: 'Switched to Targets view', payload: { view: 'targets' } };
    }
  }
  if (textLower.includes('day view') || textLower.includes('daily view') || textLower.includes('today view') || textLower.includes('show today') || textLower.includes('go to today') || textLower === 'today') {
    return { action: 'navigate_view', feedback: 'Switched to Day view', payload: { view: 'day' } };
  }

  // Label navigation
  for (const lName of labelNames) {
    if (textLower === lName.toLowerCase() || textLower === `show ${lName.toLowerCase()}` || textLower === `go to ${lName.toLowerCase()}` || textLower === `${lName.toLowerCase()} label`) {
      return { action: 'navigate_view', feedback: `Showing label ${lName}`, payload: { view: 'label', labelName: lName } };
    }
  }

  // 2. Date Navigation
  if (textLower.includes('tomorrow') && !textLower.startsWith('add') && !textLower.startsWith('new')) {
    return { action: 'change_date', feedback: 'Navigated to Tomorrow', payload: { relativeDays: 1 } };
  }
  if (textLower.includes('yesterday') && !textLower.startsWith('add')) {
    return { action: 'change_date', feedback: 'Navigated to Yesterday', payload: { relativeDays: -1 } };
  }
  if (textLower.includes('next day')) {
    return { action: 'change_date', feedback: 'Navigated to Next Day', payload: { relativeDays: 1 } };
  }
  if (textLower.includes('previous day')) {
    return { action: 'change_date', feedback: 'Navigated to Previous Day', payload: { relativeDays: -1 } };
  }

  // 3. Settings / Appearance
  if (textLower.includes('wallpaper') || textLower.includes('theme') || textLower.includes('background')) {
    for (const w of ['aurora', 'dusk', 'grid', 'dots', 'plain', 'default']) {
      if (textLower.includes(w)) {
        return { action: 'update_settings', feedback: `Wallpaper updated to ${w}`, payload: { wallpaper: w } };
      }
    }
  }
  if (textLower.includes('stack layout') || textLower.includes('layout stack') || textLower.includes('switch to stack')) {
    return { action: 'update_settings', feedback: 'Layout set to Stack', payload: { layout: 'stack' } };
  }
  if (textLower.includes('column layout') || textLower.includes('layout columns') || textLower.includes('switch to columns') || textLower.includes('grid layout')) {
    return { action: 'update_settings', feedback: 'Layout set to Columns', payload: { layout: 'columns' } };
  }
  if (textLower.includes('sidebar') || textLower.includes('toggle sidebar')) {
    return { action: 'update_settings', feedback: 'Sidebar toggled', payload: { toggleSidebar: true } };
  }
  if (textLower.includes('open settings') || textLower.includes('show settings')) {
    return { action: 'open_settings', feedback: 'Opened Settings', payload: {} };
  }
  if (textLower.includes('close settings')) {
    return { action: 'close_settings', feedback: 'Closed Settings', payload: {} };
  }

  // 4. Label Removal
  if (textLower.startsWith('delete label ') || textLower.startsWith('remove label ')) {
    const lName = speechText.replace(/^(delete|remove)\s+label\s+/i, '').trim();
    if (lName) {
      return { action: 'delete_label', feedback: `Removed label "${lName}"`, payload: { labelName: lName } };
    }
  }

  // 5. Target Management
  if (textLower.startsWith('add target ') || textLower.startsWith('new target ')) {
    const targetBody = speechText.replace(/^(add|new)\s+target\s+/i, '').trim();
    let name = targetBody;
    let deadline = today;
    const deadlineMatch = targetBody.match(/(?:by|deadline|on)\s+([A-Za-z0-9\s,-]+)$/i);
    if (deadlineMatch) {
      name = targetBody.slice(0, deadlineMatch.index).trim();
      const rawDate = deadlineMatch[1].trim();
      if (rawDate.toLowerCase().includes('tomorrow')) {
        const d = new Date(today + 'T00:00');
        d.setDate(d.getDate() + 1);
        deadline = d.toISOString().slice(0, 10);
      } else if (rawDate.toLowerCase().includes('next week')) {
        const d = new Date(today + 'T00:00');
        d.setDate(d.getDate() + 7);
        deadline = d.toISOString().slice(0, 10);
      } else {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          deadline = parsed.toISOString().slice(0, 10);
        }
      }
    }
    return { action: 'add_target', feedback: `Added target "${name}" with deadline ${deadline}`, payload: { targetName: name, deadline, note: '' } };
  }
  if (textLower.startsWith('pin target ')) {
    const query = speechText.replace(/^pin\s+target\s+/i, '').trim();
    return { action: 'pin_target', feedback: `Pinned target "${query}"`, payload: { targetQuery: query } };
  }
  if (textLower.startsWith('delete target ') || textLower.startsWith('remove target ')) {
    const query = speechText.replace(/^(delete|remove)\s+target\s+/i, '').trim();
    return { action: 'delete_target', feedback: `Deleted target "${query}"`, payload: { targetQuery: query } };
  }

  // 6. Event Management
  if (textLower.startsWith('add event ') || textLower.startsWith('add test ') || textLower.startsWith('add revision ')) {
    let type = 'other';
    if (textLower.includes('test') || textLower.includes('exam')) type = 'test';
    else if (textLower.includes('revision') || textLower.includes('revise')) type = 'revision';
    else if (textLower.includes('deadline')) type = 'deadline';
    let title = speechText.replace(/^add\s+(event|test|revision)\s+/i, '').trim();
    let time = '';
    const timeMatch = title.match(/(?:at|@)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
      title = title.replace(timeMatch[0], '').trim();
    }
    return { action: 'add_event', feedback: `Added ${type} "${title}"`, payload: { title, date: today, time, eventType: type } };
  }
  if (textLower.startsWith('delete event ') || textLower.startsWith('remove event ')) {
    const query = speechText.replace(/^(delete|remove)\s+event\s+/i, '').trim();
    return { action: 'delete_event', feedback: `Deleted event "${query}"`, payload: { eventQuery: query } };
  }

  // 7. Task Complete & Delete
  if (textLower.startsWith('mark ') && (textLower.endsWith(' done') || textLower.endsWith(' completed') || textLower.includes(' as done'))) {
    const query = speechText.replace(/^mark\s+/i, '').replace(/\s+(as\s+)?(done|completed)$/i, '').trim();
    return { action: 'complete_task', feedback: `Marked "${query}" as done!`, payload: { targetQuery: query } };
  }
  if (textLower.startsWith('delete task ') || textLower.startsWith('remove task ')) {
    const query = speechText.replace(/^(delete|remove)\s+task\s+/i, '').trim();
    return { action: 'delete_task', feedback: `Deleted task "${query}"`, payload: { targetQuery: query } };
  }

  // 8. Default: Add Task
  let section = 'lectures';
  if (textLower.includes('hw') || textLower.includes('homework') || textLower.includes('dpp') || textLower.includes('sheet') || textLower.includes('questions') || textLower.includes('exercise')) {
    section = 'hw';
  } else if (textLower.includes('doubt') || textLower.includes('concept') || textLower.includes('problem')) {
    section = 'doubts';
  }
  let date = today;
  if (textLower.includes('tomorrow')) {
    const d = new Date(today + 'T00:00');
    d.setDate(d.getDate() + 1);
    date = d.toISOString().slice(0, 10);
  }
  let labelName = null;
  for (const l of labelNames) {
    if (textLower.includes(l.toLowerCase())) {
      labelName = l;
      break;
    }
  }
  let cleanedText = speechText
    .replace(/^add\s+(task\s+)?/i, '')
    .replace(/^(to\s+)?(lectures|lecture|hw|homework|dpp|doubts|doubt)\s*[:,-]?\s*/i, '')
    .replace(/\s+(to|in)\s+(lectures|lecture|hw|homework|dpp|doubts|doubt)$/i, '')
    .trim();
  if (!cleanedText) cleanedText = speechText;

  const sectionName = section === 'hw' ? 'HW' : section === 'doubts' ? 'Doubts' : 'Lectures';
  return {
    action: 'add_task',
    feedback: `Added "${cleanedText}" to ${sectionName}${labelName ? ' [' + labelName + ']' : ''}`,
    payload: { section, text: cleanedText, date, labelName, type: 'task' },
  };
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

  // Audio Device Selection
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    return localStorage.getItem('jee_selected_mic_id') || '';
  });

  // Real-time microphone audio & voice reception detection
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencies, setFrequencies] = useState([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const [hasReceivedSound, setHasReceivedSound] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [isTestingMic, setIsTestingMic] = useState(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const activeStreamRef = useRef(null);
  const silenceCounterRef = useRef(0);

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

  // Load and enumerate all available microphone devices
  const loadAudioDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      setAudioDevices(inputs);
    } catch (e) {
      console.warn('Could not enumerate audio devices:', e);
    }
  };

  useEffect(() => {
    loadAudioDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices);
      };
    }
  }, []);

  // Helper to obtain audio media stream using selected mic device
  const getAudioStream = async (deviceIdOverride) => {
    const targetDevId = deviceIdOverride !== undefined ? deviceIdOverride : selectedDeviceId;
    const constraints = {
      audio: targetDevId
        ? {
            deviceId: { exact: targetDevId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // Reload devices now that permission is active to reveal device labels
    loadAudioDevices();
    return stream;
  };

  // Change microphone input
  const handleDeviceChange = async (newDeviceId) => {
    setSelectedDeviceId(newDeviceId);
    localStorage.setItem('jee_selected_mic_id', newDeviceId);

    // If currently testing or recording, immediately switch audio stream to new mic
    if (isTestingMic || listening) {
      try {
        const stream = await getAudioStream(newDeviceId);
        startAudioVisualizer(stream);
      } catch (err) {
        console.warn('Switch mic error:', err);
      }
    }
  };

  // Real-time audio analyzer using Web Audio API
  const startAudioVisualizer = (stream) => {
    try {
      stopAudioVisualizer();
      activeStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      silenceCounterRef.current = 0;
      setSilenceDuration(0);
      setHasReceivedSound(false);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        const bars = [];
        const step = Math.max(1, Math.floor(bufferLength / 12));
        for (let i = 0; i < 12; i++) {
          const val = dataArray[i * step] || 0;
          bars.push(Math.round((val / 255) * 22) + 2);
          sum += val;
        }
        setFrequencies(bars);

        const avg = sum / bufferLength;
        const level = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(level);

        if (level > 4) {
          setVoiceDetected(true);
          setHasReceivedSound(true);
          silenceCounterRef.current = 0;
          setSilenceDuration(0);
        } else {
          setVoiceDetected(false);
          silenceCounterRef.current += 1;
          if (silenceCounterRef.current % 30 === 0) {
            setSilenceDuration((prev) => prev + 0.5);
          }
        }

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      animFrameRef.current = requestAnimationFrame(updateMeter);
    } catch (e) {
      console.warn('Audio visualizer error:', e);
    }
  };

  const stopAudioVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    setAudioLevel(0);
    setVoiceDetected(false);
    setFrequencies([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  };

  // Direct Audio Recorder using browser microphone
  const startMediaRecorder = async () => {
    try {
      const stream = await getAudioStream();
      audioChunksRef.current = [];
      startAudioVisualizer(stream);

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
        stopAudioVisualizer();
        setListening(false);
        if (audioChunksRef.current.length > 0) {
          executeVoiceCommand(manualCmd || transcript || '', audioBlob);
        }
      };

      mediaRecorder.start();
      setListening(true);
      setError('');
      setUseDirectAudio(true);
    } catch (err) {
      console.error('Audio recorder error:', err);
      stopAudioVisualizer();
      setError('Microphone permission required. Please allow microphone access or select mic.');
      setListening(false);
    }
  };

  // Dedicated Microphone Input Check / Test
  const toggleTestMic = async () => {
    if (isTestingMic) {
      stopAudioVisualizer();
      setIsTestingMic(false);
      return;
    }

    try {
      setError('');
      if (listening) {
        if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
        setListening(false);
      }
      const stream = await getAudioStream();
      startAudioVisualizer(stream);
      setIsTestingMic(true);
    } catch (err) {
      console.error('Test mic error:', err);
      setError('Could not access selected mic: ' + (err.message || 'Permission denied'));
    }
  };

  // Setup Web Speech Recognition with continuous active transcription
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && !useDirectAudio) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; // Indian English / general English fits JEE terminology

      recognition.onstart = () => {
        setListening(true);
        setError('');
        setFeedback(null);
        getAudioStream()
          .then((stream) => startAudioVisualizer(stream))
          .catch(() => {});
      };

      recognition.onresult = (event) => {
        let full = '';
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript + ' ';
        }
        const text = full.trim();
        setTranscript(text);
        setManualCmd(text); // ACTIVELY write into the command input in real-time as spoken!
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition notice:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('Microphone access blocked. Please allow mic permissions in browser.');
          setListening(false);
          stopAudioVisualizer();
        } else if (event.error === 'network') {
          console.log('SpeechRecognition network issue detected. Seamlessly auto-switching to direct audio recording...');
          setUseDirectAudio(true);
          try {
            recognition.abort();
          } catch {}
          startMediaRecorder();
        } else if (event.error !== 'no-speech') {
          setError(`Mic notice: ${event.error}`);
          setListening(false);
          stopAudioVisualizer();
        } else {
          setListening(false);
          stopAudioVisualizer();
        }
      };

      recognition.onend = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
          setListening(false);
          stopAudioVisualizer();
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      stopAudioVisualizer();
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, [useDirectAudio, selectedDeviceId]);

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

      let commandData = null;

      // 1. Try server-side Gemini AI parser first
      try {
        const res = await fetch('/api/parse-voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const resData = await res.json();
          if (resData && resData.success && resData.data) {
            commandData = resData.data;
          }
        } else {
          console.warn('Backend responded with non-JSON content:', res.status, contentType);
        }
      } catch (fetchErr) {
        console.warn('Network call to /api/parse-voice-command failed, using client fallback:', fetchErr);
      }

      // 2. If server didn't return data and we have text, run instant client-side parser
      if (!commandData && textToProcess) {
        commandData = clientParseVoiceCommand(textToProcess, currentDate, labels);
      }

      if (!commandData) {
        throw new Error('Could not recognize voice command. Please speak again or type your command below.');
      }

      const { action, feedback: actionFeedback, payload: p } = commandData;

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
          {/* Microphone Device Selection */}
          <div className="ai-mic-select-container">
            <span className="ai-mic-select-label">
              <i className="ti ti-microphone" /> Mic Input:
            </span>
            <select
              className="ai-mic-dropdown"
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              title="Select which microphone to record from"
            >
              <option value="">Default Microphone</option>
              {audioDevices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Microphone ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Live Mic Reception Checker & Voice Indicator */}
          <div className="ai-mic-reception-card">
            <div className="ai-mic-status-row">
              <span
                className={`ai-mic-badge ${
                  voiceDetected
                    ? 'active'
                    : hasReceivedSound
                    ? 'active'
                    : silenceDuration > 2.5
                    ? 'silent'
                    : 'waiting'
                }`}
              >
                <i
                  className={`ti ${
                    voiceDetected
                      ? 'ti-microphone'
                      : silenceDuration > 2.5
                      ? 'ti-microphone-off'
                      : 'ti-waveform'
                  }`}
                />
                {voiceDetected
                  ? 'Voice Detected & Receiving'
                  : hasReceivedSound
                  ? 'Voice Audio Received'
                  : silenceDuration > 2.5
                  ? 'No Sound (Mic Muted/Silent)'
                  : 'Listening (speak now)…'}
              </span>
              <span className="ai-mic-vol-label">{audioLevel}% level</span>
            </div>

            {/* Dynamic visualizer bars jumping to real frequencies */}
            <div
              className="ai-waveform-container"
              title={`Live microphone input: ${audioLevel}%`}
            >
              {frequencies.map((h, idx) => (
                <div
                  key={idx}
                  className={`ai-wave-bar ${
                    voiceDetected ? 'speaking' : h > 4 ? '' : 'silent'
                  }`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>

            {/* Live Volume VU bar */}
            <div
              className="ai-vu-bar-bg"
              title={`Live input volume: ${audioLevel}%`}
            >
              <div
                className="ai-vu-bar-fill"
                style={{
                  width: `${Math.max(audioLevel > 0 ? 6 : 0, audioLevel)}%`,
                }}
              />
            </div>

            {/* Helpful warning if mic volume stays 0% */}
            {silenceDuration > 3 && !hasReceivedSound && (
              <div className="ai-mic-silent-warning">
                ⚠️ <b>Mic is silent (0% input).</b> Check if your physical microphone is muted or switch mic above.
              </div>
            )}
          </div>

          {/* Real-Time Actively Written Transcription Box */}
          <div className="ai-active-transcription-card recording">
            <div className="ai-active-header">
              <span>
                <span className="ai-active-live-dot" />
                Actively Writing What Is Recorded
              </span>
              <span style={{ color: voiceDetected ? '#4ade80' : 'var(--muted)', fontWeight: 600 }}>
                {voiceDetected ? '🟢 Receiving Voice' : '🎙️ Speak Now'}
              </span>
            </div>
            <div className={`ai-active-text ${!transcript && !manualCmd ? 'placeholder' : ''}`}>
              {transcript || manualCmd || 'Say anything: "Go to Calendar", "Add Optics to Lectures", "Mark optics done", "Wallpaper dusk"…'}
              <span className="ai-blinking-cursor">|</span>
            </div>
          </div>

          <div className="ai-live-actions">
            <button
              type="button"
              className="pill primary"
              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600 }}
              onClick={() => {
                if (recognitionRef.current) {
                  try { recognitionRef.current.stop(); } catch {}
                }
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  mediaRecorderRef.current.stop();
                }
                stopAudioVisualizer();
                setListening(false);
                const cmd = (transcript || manualCmd).trim();
                if (cmd) executeVoiceCommand(cmd);
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
                stopAudioVisualizer();
                setListening(false);
                setTranscript('');
                setManualCmd('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="muted"
              style={{ fontSize: 11, padding: '4px 8px', marginLeft: 'auto' }}
              onClick={toggleTestMic}
              title="Test microphone input level"
            >
              <i className="ti ti-tool" style={{ marginRight: 3 }} /> Test Mic
            </button>
          </div>

          {/* Real-time editable command form */}
          <form
            style={{ display: 'flex', gap: 6, marginTop: 2 }}
            onSubmit={(e) => {
              e.preventDefault();
              const cmd = (manualCmd || transcript).trim();
              if (cmd) {
                if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  mediaRecorderRef.current.stop();
                }
                stopAudioVisualizer();
                setListening(false);
                executeVoiceCommand(cmd);
                setManualCmd('');
                setTranscript('');
              }
            }}
          >
            <input
              value={manualCmd || transcript}
              onChange={(e) => {
                setManualCmd(e.target.value);
                setTranscript(e.target.value);
              }}
              placeholder="Actively written words appear here (or type to edit)…"
              style={{ flex: 1, padding: '6px 9px', fontSize: 12, borderRadius: 8, background: '#1c1c20', color: '#fff', border: '1px solid #3f3f46' }}
            />
            <button type="submit" className="pill" style={{ padding: '6px 12px', fontSize: 11 }}>
              Execute
            </button>
          </form>
        </div>
      )}

      {/* Dedicated Mic Tester HUD */}
      {isTestingMic && !listening && (
        <div className="ai-voice-live-hud">
          <div className="ai-listening-indicator">
            <span
              className="ai-dot-pulse"
              style={{ background: voiceDetected ? '#22c55e' : '#eab308' }}
            />
            <b>Microphone Input Test & Device Selector</b>
          </div>

          {/* Microphone Selector Dropdown in Tester */}
          <div className="ai-mic-select-container">
            <span className="ai-mic-select-label">
              <i className="ti ti-microphone" /> Switch Mic:
            </span>
            <select
              className="ai-mic-dropdown"
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              title="Select which microphone to test"
            >
              <option value="">Default Microphone</option>
              {audioDevices.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Microphone ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div className="ai-mic-reception-card">
            <div className="ai-mic-status-row">
              <span
                className={`ai-mic-badge ${
                  voiceDetected
                    ? 'active'
                    : hasReceivedSound
                    ? 'active'
                    : silenceDuration > 2.5
                    ? 'silent'
                    : 'waiting'
                }`}
              >
                <i
                  className={`ti ${
                    voiceDetected
                      ? 'ti-microphone'
                      : silenceDuration > 2.5
                      ? 'ti-microphone-off'
                      : 'ti-waveform'
                  }`}
                />
                {voiceDetected
                  ? 'Voice Detected & Receiving'
                  : hasReceivedSound
                  ? 'Voice Audio Received'
                  : silenceDuration > 2.5
                  ? 'No Sound (Mic Muted/Silent)'
                  : 'Speak to test mic…'}
              </span>
              <span className="ai-mic-vol-label">{audioLevel}% level</span>
            </div>

            <div className="ai-waveform-container" title={`Live level: ${audioLevel}%`}>
              {frequencies.map((h, idx) => (
                <div
                  key={idx}
                  className={`ai-wave-bar ${
                    voiceDetected ? 'speaking' : h > 4 ? '' : 'silent'
                  }`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>

            <div className="ai-vu-bar-bg" title={`Live input volume: ${audioLevel}%`}>
              <div
                className="ai-vu-bar-fill"
                style={{
                  width: `${Math.max(audioLevel > 0 ? 6 : 0, audioLevel)}%`,
                }}
              />
            </div>

            {silenceDuration > 3 && !hasReceivedSound && (
              <div className="ai-mic-silent-warning">
                ⚠️ <b>Mic is silent (0% input).</b> Check if your physical microphone is muted or switch to another mic above.
              </div>
            )}
          </div>

          <div className="ai-live-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: voiceDetected ? '#4ade80' : 'var(--muted)' }}>
              {voiceDetected ? '🟢 Receiving voice input!' : 'Speak into mic to test reception'}
            </span>
            <button
              type="button"
              className="pill"
              style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={toggleTestMic}
            >
              Close Test
            </button>
          </div>
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

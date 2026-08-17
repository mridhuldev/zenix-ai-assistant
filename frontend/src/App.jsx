import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  // =========================================================
  // STATE
  // =========================================================

  const [status, setStatus] = useState("IDLE");
  const [isAwake, setIsAwake] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAttentive, setIsAttentive] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // =========================================================
  // ZENIX MEMORY
  // =========================================================

  const [memories, setMemories] = useState(() => {
    try {
      const saved = localStorage.getItem("zenix_memories");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [memoryPrompt, setMemoryPrompt] = useState(null);

  // =========================================================
  // SPEECH / AUDIO REFS
  // =========================================================

  const recognitionRef = useRef(null);
  const recognitionModeRef = useRef(null);

  const wakeRecognitionRef = useRef(null);
  const wakeRecognitionRunningRef = useRef(false);

  const speechCommandRecognitionRef = useRef(null);
  const speechCommandRunningRef = useRef(false);

  // =========================================================
  // AUDIO / CLAP REFS
  // =========================================================

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const streamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const clapAnimationRef = useRef(null);

  const clapTimesRef = useRef([]);
  const lastClapRef = useRef(0);
  const clapArmedRef = useRef(true);

  // =========================================================
  // TIMER REFS
  // =========================================================

  const attentiveTimerRef = useRef(null);
  const listeningTimerRef = useRef(null);
  const wakeRestartTimerRef = useRef(null);
  const speechCommandRestartTimerRef = useRef(null);

  // =========================================================
  // STATE REFS
  // =========================================================

  const isAwakeRef = useRef(false);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isAttentiveRef = useRef(false);

  // =========================================================
  // FUNCTION REFS
  //
  // These prevent circular function-order problems.
  // =========================================================

  const startListeningRef = useRef(null);
  const stopListeningRef = useRef(null);

  const wakeZenixRef = useRef(null);
  const shutdownZenixRef = useRef(null);

  const startWakeWordRef = useRef(null);
  const stopWakeWordRef = useRef(null);

  const startAttentiveRef = useRef(null);
  const startPermanentAttentionRef = useRef(null);

  const speakTextRef = useRef(null);
  const stopSpeakingRef = useRef(null);

  const startClapDetectionRef = useRef(null);

  const sendToZenixRef = useRef(null);

  // =========================================================
  // SYNC STATE → REFS
  // =========================================================

  useEffect(() => {
    isAwakeRef.current = isAwake;
  }, [isAwake]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isAttentiveRef.current = isAttentive;
  }, [isAttentive]);

  // =========================================================
  // SPEECH RECOGNITION SUPPORT
  // =========================================================

  const getSpeechRecognition = () => {
    return (
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null
    );
  };

  // =========================================================
  // CLEAN COMMAND
  // =========================================================

  const normalizeCommand = (text) => {
    return String(text || "")
      .toLowerCase()
      .replace(/[.,!?;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  // =========================================================
  // ZENIX MEMORY SYSTEM
  // =========================================================

  const saveMemoriesToStorage = (items) => {
    try {
      localStorage.setItem(
        "zenix_memories",
        JSON.stringify(items)
      );
    } catch (error) {
      console.warn("Could not save Zenix memories:", error);
    }
  };

  const containsSensitiveInformation = (text) => {
    const value = String(text || "").toLowerCase();

    const sensitivePatterns = [
      "password",
      "passcode",
      "api key",
      "api token",
      "secret key",
      "credit card",
      "debit card",
      "cvv",
      "otp",
      "one time password",
      "bank account",
      "bank password",
      "private key",
      "seed phrase",
      "recovery phrase",
    ];

    return sensitivePatterns.some((item) =>
      value.includes(item)
    );
  };

  const looksLikeMemory = (text) => {
    const value = normalizeCommand(text);

    if (!value || containsSensitiveInformation(value)) {
      return false;
    }

    const questionWords = [
      "what is",
      "what are",
      "who is",
      "where is",
      "when is",
      "why is",
      "why are",
      "how do",
      "how can",
      "can you",
      "could you",
      "tell me",
      "explain",
      "what does",
      "calculate",
      "write",
      "make",
      "create",
      "show me",
    ];

    if (
      questionWords.some((word) =>
        value.startsWith(word)
      )
    ) {
      return false;
    }

    const memoryPatterns = [
      "my name is",
      "call me",
      "i am",
      "i'm",
      "i live in",
      "i study",
      "i work",
      "my college",
      "my university",
      "my course",
      "my degree",
      "my goal is",
      "my dream is",
      "i want to",
      "i want",
      "i like",
      "i love",
      "i prefer",
      "i hate",
      "i don't like",
      "i dont like",
      "i usually",
      "i normally",
      "my favorite",
      "my favourite",
      "remember that",
      "keep this in mind",
      "save this",
      "you should remember",
      "for me",
    ];

    const importantPatterns = [
      "important",
      "this is important",
      "this matters",
      "don't forget",
      "dont forget",
    ];

    return (
      memoryPatterns.some((pattern) =>
        value.includes(pattern)
      ) ||
      importantPatterns.some((pattern) =>
        value.includes(pattern)
      )
    );
  };

  const isDuplicateMemory = (text) => {
    const normalized = normalizeCommand(text);

    return memories.some(
      (memory) =>
        normalizeCommand(memory.text) === normalized
    );
  };

  const askToSaveMemory = (text) => {
    if (!text || !text.trim()) {
      return;
    }

    if (
      containsSensitiveInformation(text) ||
      isDuplicateMemory(text)
    ) {
      return;
    }

    setMemoryPrompt({
      text: text.trim(),
      createdAt: Date.now(),
    });
  };

  const confirmSaveMemory = () => {
    if (!memoryPrompt?.text) {
      return;
    }

    const newMemory = {
      id: Date.now(),
      text: memoryPrompt.text,
      createdAt: new Date().toISOString(),
    };

    const updated = [...memories, newMemory];

    setMemories(updated);
    saveMemoriesToStorage(updated);
    setMemoryPrompt(null);

    console.log(
      "ZENIX MEMORY SAVED:",
      newMemory.text
    );

    speakTextRef.current?.(
      "Got it. I'll remember that."
    );
  };

  const rejectMemory = () => {
    console.log(
      "ZENIX MEMORY REJECTED:",
      memoryPrompt?.text
    );

    setMemoryPrompt(null);
  };

  const clearZenixMemory = () => {
    setMemories([]);
    localStorage.removeItem("zenix_memories");
    setMemoryPrompt(null);

    console.log("ZENIX MEMORY CLEARED");
  };

  const getMemoryContext = () => {
    if (!memories.length) {
      return "";
    }

    return memories
      .map(
        (memory, index) =>
          `${index + 1}. ${memory.text}`
      )
      .join("\n");
  };

  // =========================================================
  // CAMERA COMMANDS
  // =========================================================

  const isOpenCameraCommand = (text) => {
    const command = normalizeCommand(text);
    return command === "open camera" || command === "camera" ||
      command.includes("open the camera") || command.includes("turn on camera") ||
      command.includes("start camera") || command.includes("launch camera");
  };

  const isTakePictureCommand = (text) => {
    const command = normalizeCommand(text);
    return command === "take picture" || command === "take a picture" ||
      command === "take photo" || command === "take a photo" ||
      command.includes("capture picture") || command.includes("capture photo") ||
      command.includes("click a picture") || command.includes("click photo");
  };

  const closeCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setIsCameraOpen(false);
  };

  const openCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        speakTextRef.current?.("Camera access is not supported in this browser.");
        return;
      }
      if (cameraStreamRef.current) { setIsCameraOpen(true); return; }
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      cameraStreamRef.current = cameraStream;
      setCapturedPhoto(null);
      setIsCameraOpen(true);
      requestAnimationFrame(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = cameraStream;
          cameraVideoRef.current.play().catch(() => {});
        }
      });
      console.log("ZENIX CAMERA OPEN");
      speakTextRef.current?.("Camera is ready.");
    } catch (error) {
      console.error("ZENIX CAMERA ERROR:", error);
      if (error?.name === "NotAllowedError") {
        speakTextRef.current?.("Camera permission was denied. Please allow camera access in your browser.");
      } else {
        speakTextRef.current?.("I could not open the camera.");
      }
    }
  };

  const takePicture = () => {
    if (!cameraStreamRef.current || !cameraVideoRef.current) {
      speakTextRef.current?.("The camera is not open yet. Say open camera first.");
      return;
    }
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!canvas || video.readyState < 2 || !video.videoWidth) {
      speakTextRef.current?.("The camera is still starting. Please try again in a moment.");
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/png");
    setCapturedPhoto(image);
    console.log("ZENIX PHOTO CAPTURED");
    speakTextRef.current?.("Picture captured.");
  };

  // =========================================================
  // IS STOP COMMAND?
  // =========================================================

  const isStopCommand = (text) => {
    const command = normalizeCommand(text);

    return (
      command === "stop" ||
      command === "stop zenix" ||
      command === "zenix stop" ||
      command.includes("stop talking") ||
      command.includes("stop speaking") ||
      command.includes("stop talking zenix") ||
      command.includes("be quiet") ||
      command.includes("quiet zenix") ||
      command.includes("shut up")
    );
  };

  // =========================================================
  // IS SHUTDOWN COMMAND?
  // =========================================================

  const isShutdownCommand = (text) => {
    const command = normalizeCommand(text);

    return (
      command === "shutdown" ||
      command === "shut down" ||
      command === "shutdown zenix" ||
      command === "shut down zenix" ||
      command === "zenix shutdown" ||
      command === "zenix shut down" ||
      command.includes("turn off zenix") ||
      command.includes("go to sleep zenix") ||
      command.includes("go to sleep")
    );
  };

  // =========================================================
  // STOP NORMAL LISTENING
  // =========================================================

  const stopListening = (restartAfter = false) => {
    clearTimeout(listeningTimerRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;

        recognitionRef.current.abort();
      } catch {
        // already stopped
      }

      recognitionRef.current = null;
    }

    recognitionModeRef.current = null;

    setIsListening(false);
    isListeningRef.current = false;

    if (
      restartAfter &&
      isAwakeRef.current &&
      !isSpeakingRef.current
    ) {
      listeningTimerRef.current = setTimeout(() => {
        startListeningRef.current?.();
      }, 180);
    }
  };

  // =========================================================
  // STOP SPEECH COMMAND LISTENER
  //
  // THIS IS THE IMPORTANT FIX.
  //
  // While Zenix speaks, this listener remains active and only
  // looks for STOP / SHUTDOWN.
  // =========================================================

  const stopSpeechCommandListener = () => {
    clearTimeout(speechCommandRestartTimerRef.current);

    speechCommandRunningRef.current = false;

    if (speechCommandRecognitionRef.current) {
      try {
        speechCommandRecognitionRef.current.onstart = null;
        speechCommandRecognitionRef.current.onresult = null;
        speechCommandRecognitionRef.current.onerror = null;
        speechCommandRecognitionRef.current.onend = null;

        speechCommandRecognitionRef.current.abort();
      } catch {
        // already stopped
      }

      speechCommandRecognitionRef.current = null;
    }
  };

  // =========================================================
  // START SPEECH COMMAND LISTENER
  //
  // Runs while TTS is speaking.
  // =========================================================

  const startSpeechCommandListener = () => {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      console.warn(
        "Speech Recognition is not supported in this browser."
      );
      return;
    }

    if (!isSpeakingRef.current) {
      return;
    }

    if (speechCommandRunningRef.current) {
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    speechCommandRecognitionRef.current = recognition;
    speechCommandRunningRef.current = true;

    recognition.onstart = () => {
      console.log(
        "ZENIX SPEECH COMMAND LISTENER ONLINE"
      );
    };

    recognition.onresult = (event) => {
      if (!isSpeakingRef.current) {
        return;
      }

      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        transcript +=
          event.results[i][0]?.transcript || "";
      }

      transcript = transcript.trim();

      if (!transcript) {
        return;
      }

      console.log(
        "ZENIX SPEAKING COMMAND HEARD:",
        transcript
      );

      // =====================================================
      // STOP
      // =====================================================

      if (isStopCommand(transcript)) {
        console.log(
          "ZENIX STOP COMMAND DETECTED WHILE SPEAKING"
        );

        stopSpeakingRef.current?.();
        return;
      }

      // =====================================================
      // SHUTDOWN
      // =====================================================

      if (isShutdownCommand(transcript)) {
        console.log(
          "ZENIX SHUTDOWN COMMAND DETECTED WHILE SPEAKING"
        );

        shutdownZenixRef.current?.();
      }
    };

    recognition.onerror = (event) => {
      console.warn(
        "Speech command recognition:",
        event.error
      );

      speechCommandRunningRef.current = false;
      speechCommandRecognitionRef.current = null;

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        console.warn(
          "Microphone permission is required."
        );
        return;
      }

      if (isSpeakingRef.current) {
        clearTimeout(
          speechCommandRestartTimerRef.current
        );

        speechCommandRestartTimerRef.current =
          setTimeout(() => {
            if (
              isSpeakingRef.current &&
              !speechCommandRunningRef.current
            ) {
              startSpeechCommandListener();
            }
          }, 250);
      }
    };

    recognition.onend = () => {
      speechCommandRunningRef.current = false;
      speechCommandRecognitionRef.current = null;

      if (isSpeakingRef.current) {
        clearTimeout(
          speechCommandRestartTimerRef.current
        );

        speechCommandRestartTimerRef.current =
          setTimeout(() => {
            if (
              isSpeakingRef.current &&
              !speechCommandRunningRef.current
            ) {
              startSpeechCommandListener();
            }
          }, 150);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.warn(
        "Speech command listener failed:",
        error
      );

      speechCommandRunningRef.current = false;
      speechCommandRecognitionRef.current = null;
    }
  };

  // =========================================================
  // STOP SPEAKING
  // =========================================================

  const stopSpeaking = () => {
    console.log("ZENIX STOP SPEAKING");

    stopSpeechCommandListener();

    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.pause();
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    setIsSpeaking(false);
    isSpeakingRef.current = false;

    setStatus(
      isAwakeRef.current
        ? "LISTENING"
        : "IDLE"
    );

    if (isAwakeRef.current) {
      clearTimeout(listeningTimerRef.current);

      listeningTimerRef.current = setTimeout(() => {
        if (
          isAwakeRef.current &&
          !isSpeakingRef.current
        ) {
          startListeningRef.current?.();
        }
      }, 180);
    }
  };

  // =========================================================
  // SPEAK
  // =========================================================

  const speakText = (text) => {
    if (!("speechSynthesis" in window)) {
      console.warn(
        "Speech synthesis is not supported."
      );
      return;
    }

    if (!text) {
      return;
    }

    // Stop normal command listening.
    stopListening(false);

    // Stop an older speech-command listener.
    stopSpeechCommandListener();

    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }

    const cleanText = String(text)
      .replace(/```[\s\S]*?```/g, "Code omitted.")
      .replace(/[#*_>`~]/g, "")
      .replace(/\n+/g, " ")
      .trim();

    if (!cleanText) {
      return;
    }

    const utterance =
      new SpeechSynthesisUtterance(cleanText);

    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      console.log("ZENIX STARTED SPEAKING");

      setIsSpeaking(true);
      isSpeakingRef.current = true;

      setIsListening(false);
      isListeningRef.current = false;

      setStatus("SPEAKING");

      // =====================================================
      // IMPORTANT:
      // LISTEN FOR STOP / SHUTDOWN WHILE SPEAKING
      // =====================================================

      setTimeout(() => {
        if (isSpeakingRef.current) {
          startSpeechCommandListener();
        }
      }, 80);
    };

    utterance.onend = () => {
      console.log("ZENIX FINISHED SPEAKING");

      stopSpeechCommandListener();

      setIsSpeaking(false);
      isSpeakingRef.current = false;

      if (isAwakeRef.current) {
        startAttentiveRef.current?.();
      } else {
        setStatus("IDLE");
      }
    };

    utterance.onerror = (event) => {
      console.warn(
        "Speech synthesis error:",
        event.error
      );

      stopSpeechCommandListener();

      setIsSpeaking(false);
      isSpeakingRef.current = false;

      if (isAwakeRef.current) {
        startAttentiveRef.current?.();
      } else {
        setStatus("IDLE");
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // =========================================================
  // SEND TO BACKEND
  // =========================================================

  const sendToZenix = async (userText) => {
    if (!userText || !userText.trim()) {
      return;
    }

    const text = userText.trim();

    // =====================================================
    // MEMORY DETECTION
    // =====================================================

    if (looksLikeMemory(text)) {
      setTimeout(() => {
        askToSaveMemory(text);
      }, 500);
    }

    const lowerText =
      normalizeCommand(text);

    console.log(
      "ZENIX COMMAND:",
      text
    );

    // =====================================================
    // STOP
    // =====================================================

    if (isStopCommand(lowerText)) {
      stopSpeakingRef.current?.();
      return;
    }

    // =====================================================
    // SHUTDOWN
    // =====================================================

    if (isShutdownCommand(lowerText)) {
      shutdownZenixRef.current?.();
      return;
    }

    // =====================================================
    // PERMANENT ATTENTION
    // =====================================================

    if (
      lowerText.includes("be attentive") ||
      lowerText.includes("stay attentive") ||
      lowerText.includes("keep listening") ||
      lowerText.includes("always listen")
    ) {
      startPermanentAttentionRef.current?.();

      speakTextRef.current?.(
        "I will stay attentive."
      );

      return;
    }

    // =====================================================
    // CAMERA COMMANDS
    // =====================================================

    if (isOpenCameraCommand(lowerText)) {
      await openCamera();
      return;
    }

    if (isTakePictureCommand(lowerText)) {
      takePicture();
      return;
    }

    // =====================================================
    // NORMAL AI REQUEST
    // =====================================================

    setStatus("THINKING");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: getMemoryContext()
              ? `You have access to the user's approved personal memories.

IMPORTANT:
- Use these memories only when relevant.
- Do not claim to know information that isn't listed.
- Do not expose the memory system unless the user asks about it.
- Treat these memories as user-provided information.

APPROVED ZENIX MEMORIES:
${getMemoryContext()}

USER'S CURRENT MESSAGE:
${text}`
              : text,
          }),
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const backendError =
          data?.detail?.message ||
          data?.detail ||
          data?.message ||
          `Backend error: ${response.status}`;

        throw new Error(
          String(backendError)
        );
      }

      const reply =
        data?.reply ||
        data?.response ||
        data?.message ||
        "I couldn't generate a response.";

      speakTextRef.current?.(reply);
    } catch (error) {
      console.error(
        "ZENIX BACKEND ERROR:",
        error
      );

      speakTextRef.current?.(
        "Sorry, I am having trouble connecting to my core."
      );
    }
  };

  // =========================================================
  // START NORMAL LISTENING
  // =========================================================

  const startListening = () => {
    const SpeechRecognition =
      getSpeechRecognition();

    if (!SpeechRecognition) {
      console.warn(
        "Speech Recognition is not supported."
      );

      setStatus("IDLE");
      return;
    }

    if (!isAwakeRef.current) {
      return;
    }

    if (isSpeakingRef.current) {
      return;
    }

    if (isListeningRef.current) {
      return;
    }

    stopSpeechCommandListener();

    const recognition =
      new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognitionRef.current = recognition;
    recognitionModeRef.current = "normal";

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;

      setStatus("LISTENING");

      console.log(
        "ZENIX LISTENING"
      );
    };

    recognition.onresult = (event) => {
      if (!event.results?.length) {
        return;
      }

      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        transcript +=
          event.results[i][0]?.transcript || "";
      }

      transcript = transcript.trim();

      console.log(
        "ZENIX HEARD:",
        transcript
      );

      setIsListening(false);
      isListeningRef.current = false;

      if (transcript) {
        sendToZenixRef.current?.(
          transcript
        );
      }
    };

    recognition.onerror = (event) => {
      console.warn(
        "Speech recognition:",
        event.error
      );

      setIsListening(false);
      isListeningRef.current = false;

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setStatus("IDLE");

        console.warn(
          "Microphone permission denied."
        );

        return;
      }

      if (
        event.error === "network" ||
        event.error === "audio-capture"
      ) {
        if (isAwakeRef.current) {
          setStatus("READY");
        } else {
          setStatus("IDLE");
        }

        return;
      }

      if (
        event.error === "no-speech" ||
        event.error === "aborted"
      ) {
        return;
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;

      recognitionRef.current = null;
      recognitionModeRef.current = null;

      if (
        isAwakeRef.current &&
        !isSpeakingRef.current &&
        isAttentiveRef.current
      ) {
        clearTimeout(
          listeningTimerRef.current
        );

        listeningTimerRef.current =
          setTimeout(() => {
            if (
              isAwakeRef.current &&
              !isSpeakingRef.current
            ) {
              startListeningRef.current?.();
            }
          }, 180);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.warn(
        "Recognition start failed:",
        error
      );

      setIsListening(false);
      isListeningRef.current = false;

      recognitionRef.current = null;
      recognitionModeRef.current = null;
    }
  };

  // =========================================================
  // WAKE WORD STOP
  // =========================================================

  const stopWakeWordDetection = () => {
    clearTimeout(
      wakeRestartTimerRef.current
    );

    wakeRecognitionRunningRef.current =
      false;

    if (wakeRecognitionRef.current) {
      try {
        wakeRecognitionRef.current.onstart =
          null;

        wakeRecognitionRef.current.onresult =
          null;

        wakeRecognitionRef.current.onerror =
          null;

        wakeRecognitionRef.current.onend =
          null;

        wakeRecognitionRef.current.abort();
      } catch {
        // already stopped
      }

      wakeRecognitionRef.current = null;
    }
  };

  // =========================================================
  // WAKE WORD START
  // =========================================================

  const startWakeWordDetection = () => {
    const SpeechRecognition =
      getSpeechRecognition();

    if (!SpeechRecognition) {
      return;
    }

    if (isAwakeRef.current) {
      return;
    }

    if (isSpeakingRef.current) {
      return;
    }

    if (wakeRecognitionRunningRef.current) {
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    wakeRecognitionRef.current =
      recognition;

    wakeRecognitionRunningRef.current =
      true;

    recognition.onstart = () => {
      console.log(
        "ZENIX WAKE SYSTEM ONLINE"
      );
    };

    recognition.onresult = (event) => {
      if (
        isAwakeRef.current ||
        isSpeakingRef.current
      ) {
        return;
      }

      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        transcript +=
          event.results[i][0]?.transcript || "";
      }

      transcript =
        transcript.toLowerCase().trim();

      if (!transcript) {
        return;
      }

      console.log(
        "WAKE WORD HEARD:",
        transcript
      );

      const wakeDetected =
        transcript.includes("zenix") ||
        transcript.includes("zenex") ||
        transcript.includes("zeniks") ||
        transcript.includes("zenix");

      if (wakeDetected) {
        console.log(
          "ZENIX WAKE WORD DETECTED"
        );

        stopWakeWordDetection();

        wakeZenixRef.current?.();
      }
    };

    recognition.onerror = (event) => {
      console.warn(
        "Wake word recognition:",
        event.error
      );

      wakeRecognitionRunningRef.current =
        false;

      wakeRecognitionRef.current = null;

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        console.warn(
          "Microphone permission required for wake word."
        );

        return;
      }

      clearTimeout(
        wakeRestartTimerRef.current
      );

      wakeRestartTimerRef.current =
        setTimeout(() => {
          if (
            !isAwakeRef.current &&
            !isSpeakingRef.current &&
            !wakeRecognitionRunningRef.current
          ) {
            startWakeWordDetection();
          }
        }, 700);
    };

    recognition.onend = () => {
      wakeRecognitionRunningRef.current =
        false;

      wakeRecognitionRef.current = null;

      if (
        !isAwakeRef.current &&
        !isSpeakingRef.current
      ) {
        clearTimeout(
          wakeRestartTimerRef.current
        );

        wakeRestartTimerRef.current =
          setTimeout(() => {
            if (
              !isAwakeRef.current &&
              !isSpeakingRef.current &&
              !wakeRecognitionRunningRef.current
            ) {
              startWakeWordDetection();
            }
          }, 300);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.warn(
        "Wake word start failed:",
        error
      );

      wakeRecognitionRunningRef.current =
        false;

      wakeRecognitionRef.current = null;
    }
  };

  // =========================================================
  // WAKE ZENIX
  // =========================================================

  const wakeZenix = () => {
    console.log(
      "ZENIX ACTIVATION"
    );

    stopWakeWordDetection();

    if (isAwakeRef.current) {
      return;
    }

    if (isSpeakingRef.current) {
      return;
    }

    clearTimeout(
      attentiveTimerRef.current
    );

    setIsAwake(true);
    isAwakeRef.current = true;

    setIsAttentive(true);
    isAttentiveRef.current = true;

    setStatus("AWAKENING");

    console.log(
      "ZENIX AWAKE"
    );

    // =====================================================
    // ACTIVATION GREETING
    // =====================================================

    setTimeout(() => {
      if (
        isAwakeRef.current &&
        !isSpeakingRef.current
      ) {
        speakTextRef.current?.(
          "Zenix is at your service. What can I help you with today?"
        );
      }
    }, 250);
  };

  // =========================================================
  // ATTENTIVE MODE
  // =========================================================

  const startAttentiveMode = () => {
    clearTimeout(
      attentiveTimerRef.current
    );

    if (!isAwakeRef.current) {
      return;
    }

    setIsAttentive(true);
    isAttentiveRef.current = true;

    setStatus("ATTENTIVE");

    clearTimeout(
      listeningTimerRef.current
    );

    listeningTimerRef.current =
      setTimeout(() => {
        if (
          isAwakeRef.current &&
          !isSpeakingRef.current
        ) {
          startListeningRef.current?.();
        }
      }, 180);

    // =====================================================
    // AUTO SHUTDOWN AFTER 10 SEC OF NO ACTIVITY
    // =====================================================

    attentiveTimerRef.current =
      setTimeout(() => {
        if (
          isAwakeRef.current &&
          isAttentiveRef.current &&
          !isSpeakingRef.current &&
          !isListeningRef.current
        ) {
          console.log(
            "ZENIX ATTENTION TIMEOUT"
          );

          shutdownZenixRef.current?.();
        }
      }, 10000);
  };

  // =========================================================
  // PERMANENT ATTENTION
  // =========================================================

  const startPermanentAttention =
    () => {
      clearTimeout(
        attentiveTimerRef.current
      );

      setIsAwake(true);
      isAwakeRef.current = true;

      setIsAttentive(true);
      isAttentiveRef.current = true;

      setStatus("ATTENTIVE");

      clearTimeout(
        listeningTimerRef.current
      );

      listeningTimerRef.current =
        setTimeout(() => {
          if (
            isAwakeRef.current &&
            !isSpeakingRef.current
          ) {
            startListeningRef.current?.();
          }
        }, 180);
    };

  // =========================================================
  // SHUTDOWN ZENIX
  // =========================================================

  const shutdownZenix = () => {
    console.log(
      "ZENIX SHUTDOWN"
    );

    stopWakeWordDetection();
    stopSpeechCommandListener();

    clearTimeout(
      attentiveTimerRef.current
    );

    clearTimeout(
      listeningTimerRef.current
    );

    // =====================================================
    // STOP SPEECH FIRST
    // =====================================================

    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.pause();
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    // =====================================================
    // STOP NORMAL RECOGNITION
    // =====================================================

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart =
          null;

        recognitionRef.current.onresult =
          null;

        recognitionRef.current.onerror =
          null;

        recognitionRef.current.onend =
          null;

        recognitionRef.current.abort();
      } catch {
        // ignore
      }

      recognitionRef.current = null;
    }

    recognitionModeRef.current = null;

    setIsListening(false);
    isListeningRef.current = false;

    setIsSpeaking(false);
    isSpeakingRef.current = false;

    setIsAttentive(false);
    isAttentiveRef.current = false;

    setIsAwake(false);
    isAwakeRef.current = false;

    setStatus("IDLE");

    // =====================================================
    // RESTART WAKE WORD
    // =====================================================

    clearTimeout(
      wakeRestartTimerRef.current
    );

    wakeRestartTimerRef.current =
      setTimeout(() => {
        if (
          !isAwakeRef.current &&
          !isSpeakingRef.current
        ) {
          startWakeWordDetection();
        }
      }, 500);
  };

  // =========================================================
  // DOUBLE CLAP DETECTION
  // =========================================================

  const startClapDetection =
    async () => {
      try {
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          console.warn(
            "Microphone API unavailable."
          );

          return;
        }

        // Avoid creating multiple microphone streams.
        if (streamRef.current) {
          return;
        }

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: {
                echoCancellation: true,
                noiseSuppression: false,
                autoGainControl: false,
              },
            }
          );

        streamRef.current =
          stream;

        const AudioContext =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioContext) {
          console.warn(
            "AudioContext unavailable."
          );

          return;
        }

        const audioContext =
          new AudioContext();

        if (
          audioContext.state ===
          "suspended"
        ) {
          try {
            await audioContext.resume();
          } catch {
            console.warn(
              "Could not resume AudioContext."
            );
          }
        }

        const analyser =
          audioContext.createAnalyser();

        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant =
          0.08;

        const microphone =
          audioContext.createMediaStreamSource(
            stream
          );

        microphone.connect(
          analyser
        );

        audioContextRef.current =
          audioContext;

        analyserRef.current =
          analyser;

        microphoneRef.current =
          microphone;

        const data =
          new Uint8Array(
            analyser.fftSize
          );

        clapTimesRef.current = [];
        lastClapRef.current = 0;
        clapArmedRef.current = true;

        let previousRms = 0;
        let previousPeak = 0;

        const detect = () => {
          if (
            !analyserRef.current
          ) {
            return;
          }

          analyser.getByteTimeDomainData(
            data
          );

          let sum = 0;
          let peak = 0;

          for (
            let i = 0;
            i < data.length;
            i++
          ) {
            const value =
              (data[i] - 128) /
              128;

            const absolute =
              Math.abs(value);

            if (
              absolute > peak
            ) {
              peak = absolute;
            }

            sum +=
              value * value;
          }

          const rms =
            Math.sqrt(
              sum / data.length
            );

          const now =
            Date.now();

          // =================================================
          // CLAP DETECTION
          //
          // A clap needs BOTH:
          // 1. A loud peak
          // 2. A sudden increase
          //
          // This makes normal talking less likely to count.
          // =================================================

          const suddenSpike =
            rms > 0.14 &&
            peak > 0.55 &&
            rms >
              previousRms * 1.45;

          const strongClap =
            rms > 0.20 &&
            peak > 0.70 &&
            rms >
              previousRms * 1.20;

          const possibleClap =
            suddenSpike ||
            strongClap;

          // =================================================
          // RE-ARM AFTER SOUND FALLS
          // =================================================

          if (
            rms < 0.08 &&
            peak < 0.30
          ) {
            clapArmedRef.current =
              true;
          }

          // =================================================
          // REGISTER CLAP
          // =================================================

          if (
            possibleClap &&
            clapArmedRef.current &&
            now -
              lastClapRef.current >
              280
          ) {
            clapArmedRef.current =
              false;

            lastClapRef.current =
              now;

            clapTimesRef.current.push(
              now
            );

            clapTimesRef.current =
              clapTimesRef.current.filter(
                (time) =>
                  now - time <
                  1100
              );

            console.log(
              "ZENIX CLAP:",
              clapTimesRef.current.length
            );

            // =================================================
            // TWO CLAPS ONLY
            // =================================================

            if (
              clapTimesRef.current
                .length >= 2
            ) {
              console.log(
                "ZENIX DOUBLE CLAP DETECTED"
              );

              clapTimesRef.current =
                [];

              if (
                !isAwakeRef.current
              ) {
                wakeZenixRef.current?.();
              }
            }
          }

          previousRms =
            rms;

          previousPeak =
            peak;

          clapAnimationRef.current =
            requestAnimationFrame(
              detect
            );
        };

        detect();

        console.log(
          "ZENIX CLAP SYSTEM ONLINE"
        );
      } catch (error) {
        console.error(
          "ZENIX MICROPHONE ERROR:",
          error
        );

        setStatus("IDLE");
      }
    };

  // =========================================================
  // UPDATE FUNCTION REFS
  // =========================================================

  startListeningRef.current =
    startListening;

  stopListeningRef.current =
    stopListening;

  wakeZenixRef.current =
    wakeZenix;

  shutdownZenixRef.current =
    shutdownZenix;

  startWakeWordRef.current =
    startWakeWordDetection;

  stopWakeWordRef.current =
    stopWakeWordDetection;

  startAttentiveRef.current =
    startAttentiveMode;

  startPermanentAttentionRef.current =
    startPermanentAttention;

  speakTextRef.current =
    speakText;

  stopSpeakingRef.current =
    stopSpeaking;

  startClapDetectionRef.current =
    startClapDetection;

  sendToZenixRef.current =
    sendToZenix;

  // =========================================================
  // INITIALIZATION
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await startClapDetectionRef.current?.();

        if (
          mounted &&
          !isAwakeRef.current
        ) {
          startWakeWordRef.current?.();
        }
      } catch (error) {
        console.error(
          "ZENIX INITIALIZATION ERROR:",
          error
        );
      }
    };

    initialize();

    return () => {
      mounted = false;

      clearTimeout(
        attentiveTimerRef.current
      );

      clearTimeout(
        listeningTimerRef.current
      );

      clearTimeout(
        wakeRestartTimerRef.current
      );

      clearTimeout(
        speechCommandRestartTimerRef.current
      );

      stopWakeWordDetection();
      stopSpeechCommandListener();

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }

        recognitionRef.current =
          null;
      }

      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }

      if (
        clapAnimationRef.current
      ) {
        cancelAnimationFrame(
          clapAnimationRef.current
        );

        clapAnimationRef.current =
          null;
      }

      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

        streamRef.current =
          null;
      }

      if (
        audioContextRef.current
      ) {
        try {
          audioContextRef.current.close();
        } catch {
          // ignore
        }

        audioContextRef.current =
          null;
      }

      analyserRef.current =
        null;

      microphoneRef.current =
        null;
    };
  }, []);

  // =========================================================
  // MANUAL CORE CLICK
  // =========================================================

  const handleCoreClick = () => {
    if (isSpeakingRef.current) {
      stopSpeakingRef.current?.();
      return;
    }

    if (isAwakeRef.current) {
      shutdownZenixRef.current?.();
      return;
    }

    wakeZenixRef.current?.();
  };

  // =========================================================
  // UI
  // =========================================================

  const memoryStyles = `
    .zenix-memory-overlay {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      background: radial-gradient(circle at center, rgba(0,220,255,.09), rgba(0,0,0,.82));
      backdrop-filter: blur(14px);
      animation: zenixMemoryOverlayIn .22s ease-out;
    }
    .zenix-memory-panel {
      position: relative;
      width: min(460px, calc(100vw - 40px));
      padding: 34px;
      border: 1px solid rgba(0,220,255,.45);
      border-radius: 24px;
      background: linear-gradient(145deg, rgba(10,20,30,.97), rgba(3,8,15,.99));
      box-shadow: 0 0 35px rgba(0,220,255,.15), inset 0 0 30px rgba(0,220,255,.035);
      text-align: center; overflow: hidden;
      animation: zenixMemoryPanelIn .35s cubic-bezier(.16,1,.3,1);
    }
    .memory-glow {
      position: absolute; width: 220px; height: 220px; top: -120px; left: 50%;
      transform: translateX(-50%); background: rgba(0,220,255,.18);
      filter: blur(70px); pointer-events: none;
    }
    .memory-icon {
      position: relative; width: 68px; height: 68px; margin: 0 auto 18px;
      display: flex; align-items: center; justify-content: center; border-radius: 50%;
      background: radial-gradient(circle, rgba(0,220,255,.2), rgba(0,80,120,.08));
      border: 1px solid rgba(0,220,255,.4); box-shadow: 0 0 25px rgba(0,220,255,.2);
      font-size: 28px; animation: zenixMemoryPulse 2s ease-in-out infinite;
    }
    .memory-label {
      position: relative; color: rgba(0,220,255,.8); font-size: 11px;
      font-weight: 700; letter-spacing: 3px; margin-bottom: 8px;
    }
    .zenix-memory-panel h2 {
      position: relative; margin: 0 0 10px; color: white;
      font-size: 26px; font-weight: 600;
    }
    .memory-description {
      position: relative; margin: 0 auto 20px; max-width: 350px;
      color: rgba(220,235,245,.65); font-size: 14px; line-height: 1.6;
    }
    .memory-content {
      position: relative; padding: 17px 18px; margin-bottom: 24px; border-radius: 14px;
      background: rgba(0,220,255,.055); border: 1px solid rgba(0,220,255,.16);
      color: rgba(240,250,255,.9); font-size: 15px; line-height: 1.55;
      text-align: left; word-break: break-word;
    }
    .memory-actions {
      position: relative; display: flex; gap: 12px; justify-content: center;
    }
    .memory-actions button {
      min-width: 130px; padding: 12px 20px; border-radius: 10px;
      font-size: 12px; font-weight: 700; letter-spacing: 1.5px; cursor: pointer;
      transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
    }
    .memory-save {
      border: 1px solid rgba(0,220,255,.65); color: #001015;
      background: rgba(0,220,255,.9); box-shadow: 0 0 20px rgba(0,220,255,.18);
    }
    .memory-save:hover {
      transform: translateY(-2px); background: rgba(80,235,255,1);
      box-shadow: 0 0 30px rgba(0,220,255,.35);
    }
    .memory-reject {
      border: 1px solid rgba(255,255,255,.15); color: rgba(255,255,255,.7);
      background: rgba(255,255,255,.04);
    }
    .memory-reject:hover {
      transform: translateY(-2px); background: rgba(255,255,255,.08); color: white;
    }
    .memory-footer {
      position: relative; margin-top: 20px; color: rgba(255,255,255,.32);
      font-size: 11px; letter-spacing: .5px;
    }
    @keyframes zenixMemoryOverlayIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes zenixMemoryPanelIn {
      from { opacity: 0; transform: translateY(20px) scale(.94); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes zenixMemoryPulse {
      0%,100% { transform: scale(1); box-shadow: 0 0 20px rgba(0,220,255,.15); }
      50% { transform: scale(1.05); box-shadow: 0 0 32px rgba(0,220,255,.32); }
    }
    @media (max-width: 520px) {
      .zenix-memory-panel { padding: 26px 20px; }
      .memory-actions { flex-direction: column; }
      .memory-actions button { width: 100%; }
    }
  `;

  return (
    <>
      <style>{memoryStyles}</style>
      <div className="zenix-app">

      {/* ===================================================
          TOP BAR
      =================================================== */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-orb">
            Z
          </div>

          <div>
            <h1>ZENIX</h1>

            <span>
              VOICE INTELLIGENCE
            </span>
          </div>

        </div>

        <div className="system-status">

          <button
            type="button"
            className="zenix-memory-button"
            style={{
              marginRight: "12px",
              padding: "6px 10px",
              borderRadius: "10px",
              border: "1px solid rgba(0,220,255,0.35)",
              background: "rgba(0,220,255,0.06)",
              color: "rgba(220,250,255,0.9)",
              cursor: "pointer",
              fontSize: "12px",
            }}
            onClick={() => {
              if (memories.length > 0) {
                const shouldClear = window.confirm(
                  `Clear all ${memories.length} saved Zenix memories?`
                );

                if (shouldClear) {
                  clearZenixMemory();
                }
              } else {
                window.alert(
                  "Zenix has no saved memories yet."
                );
              }
            }}
            title="Manage Zenix memory"
          >
            🧠 {memories.length}
          </button>

          <span className="status-light"></span>

          <span>
            CORE ONLINE
          </span>

        </div>

      </header>

      {/* ===================================================
          MAIN
      =================================================== */}

      <main className="zenix-main">

        <div className="environment">

          {/* AMBIENT LIGHTS */}

          <div className="ambient ambient-one"></div>
          <div className="ambient ambient-two"></div>
          <div className="ambient ambient-three"></div>

          {/* HUD */}

          <div className="hud hud-one"></div>
          <div className="hud hud-two"></div>
          <div className="hud hud-three"></div>

          {/* =================================================
              ZENIX CORE
          ================================================= */}

          <button
            type="button"
            className={`zenix-core
              ${isListening ? "listening" : ""}
              ${isSpeaking ? "speaking" : ""}
              ${isAwake ? "awake" : ""}
              ${isAttentive ? "attentive" : ""}
            `}
            onClick={handleCoreClick}
            aria-label="Zenix Core"
          >

            <div className="core-ring ring-1"></div>
            <div className="core-ring ring-2"></div>
            <div className="core-ring ring-3"></div>
            <div className="core-ring ring-4"></div>

            <div className="core-energy"></div>

            <div className="core-center">
              <span>
                Z
              </span>
            </div>

          </button>

          {/* =================================================
              STATUS
          ================================================= */}

          <div
            className={`core-status ${status.toLowerCase()}`}
          >

            <span className="status-dot"></span>

            {status}

          </div>

          {/* =================================================
              COMMAND AREA
          ================================================= */}

          <div className="command-area">

            {status === "IDLE" && (
              <>
                <h2>
                  Say "Zenix" or double clap
                </h2>

                <p>
                  or click the core
                </p>
              </>
            )}

            {status === "AWAKENING" && (
              <>
                <h2>
                  Zenix awakening
                </h2>

                <p>
                  Preparing voice interface
                </p>
              </>
            )}

            {status === "LISTENING" && (
              <>
                <h2>
                  I'm listening
                </h2>

                <p>
                  Speak naturally
                </p>
              </>
            )}

            {status === "READY" && (
              <>
                <h2>
                  Ready
                </h2>

                <p>
                  Speak when you're ready
                </p>
              </>
            )}

            {status === "THINKING" && (
              <>
                <h2>
                  Processing
                </h2>

                <p>
                  Zenix is thinking
                </p>
              </>
            )}

            {status === "SPEAKING" && (
              <>
                <h2>
                  Zenix speaking
                </h2>

                <p>
                  Say "stop" to interrupt
                </p>
              </>
            )}

            {status === "ATTENTIVE" && (
              <>
                <h2>
                  I'm still here
                </h2>

                <p>
                  You have my attention
                </p>
              </>
            )}

          </div>

        </div>

        {/* =================================================
            ZENIX MEMORY PROMPT
        ================================================= */}

        {memoryPrompt && (
          <div className="zenix-memory-overlay">
            <div className="zenix-memory-panel">

              <div className="memory-glow"></div>

              <div className="memory-icon">
                🧠
              </div>

              <div className="memory-label">
                ZENIX MEMORY
              </div>

              <h2>
                Remember this?
              </h2>

              <p className="memory-description">
                This sounds like information about you
                or something important.
              </p>

              <div className="memory-content">
                "{memoryPrompt.text}"
              </div>

              <div className="memory-actions">

                <button
                  type="button"
                  className="memory-save"
                  onClick={confirmSaveMemory}
                >
                  SAVE
                </button>

                <button
                  type="button"
                  className="memory-reject"
                  onClick={rejectMemory}
                >
                  DON'T SAVE
                </button>

              </div>

              <div className="memory-footer">
                You control what Zenix remembers.
              </div>

            </div>
          </div>
        )}

        {isCameraOpen && (
          <div className="zenix-camera-overlay">
            <div className="zenix-camera-panel">
              <div className="zenix-camera-header">
                <div><strong>ZENIX CAMERA</strong><span>LIVE OPTICAL FEED</span></div>
                <button type="button" onClick={closeCamera}>CLOSE</button>
              </div>
              <video ref={cameraVideoRef} className="zenix-camera-video" autoPlay playsInline muted />
              <canvas ref={cameraCanvasRef} className="zenix-camera-canvas" />
              {capturedPhoto && (
                <div className="zenix-captured-photo">
                  <span>CAPTURED</span>
                  <img src={capturedPhoto} alt="Zenix captured" />
                </div>
              )}
              <div className="zenix-camera-controls">
                <button type="button" onClick={takePicture}>TAKE PICTURE</button>
                <button type="button" onClick={closeCamera}>CLOSE CAMERA</button>
              </div>
              <p>Say “take picture” to capture a photo.</p>
            </div>
          </div>
        )}

      </main>

      {/* ===================================================
          BOTTOM HUD
      =================================================== */}

      <footer className="bottom-hud">

        <div className="hud-item">

          <span className="hud-icon">
            ◉
          </span>

          <div>

            <strong>
              VOICE CORE
            </strong>

            <small>
              {isListening
                ? "Listening"
                : isSpeaking
                ? "Output active"
                : "Standby"}
            </small>

          </div>

        </div>

        <div className="hud-center">

          <span></span>

          ZENIX

          <span></span>

        </div>

        <div className="hud-item right">

          <div>

            <strong>
              WAKE SYSTEM
            </strong>

            <small>
              Say “Zenix” or double clap
            </small>

          </div>

          <span className="hud-icon">
            ≋
          </span>

        </div>

      </footer>

      </div>
    </>
  );
}

export default App;
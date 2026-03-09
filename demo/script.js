/* ═══════════════════════════════════════════════════════════════════════════════
   VaidyaVaani Demo — Browser Voice Call + Live CloudWatch Dashboard
   ═══════════════════════════════════════════════════════════════════════════════
   Flow:
     1. User clicks "Call VaidyaVaani"
     2. IVR greeting plays via TTS in Hindi
     3. Mic activates → user speaks (plays the patient role)
     4. After user stops speaking → next scripted IVR response plays via TTS
     5. Repeat until conversation ends
     6. CloudWatch logs + transcript update in real-time
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Generated IDs (realistic) ───────────────────────────────────────────────
const CALL_SID = 'CA' + crypto.randomUUID().replace(/-/g, '').slice(0, 32);
const REQUEST_ID = crypto.randomUUID();
const CALL_ID = 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 CALLER'S SCRIPT — Yeh aapko bolna hai mic mein (Hindi mein):
//
//   TURN 1: "Namaste, mere pitaji ke seene mein bahut tez dard ho raha hai! 
//            Yeh heart attack lag raha hai, jaldi kuch kijiye!"
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─── IVR Responses (Hindi TTS + English transcript) ──────────────────────────
// Emergency Script: Heart Attack (Cardiac Event)
const IVR_RESPONSES = [
    {
        hindi: "Namaste! VaidyaVaani mein aapka swaagat hai. Main aapki AI swasthya sahayak hoon. Kripya apni samasya bataayein.",
        english: "Welcome to VaidyaVaani! I'm your AI health assistant. Please describe your health concern.",
        isGreeting: true,
        logsToFire: 'greeting',
    },
    {
        hindi: "Yeh ek medical emergency lag rahi hai! Kripya ghabrayein nahi. Main turant 108 Ambulance ko aapki location par bhej rahi hoon. Jab tak ambulance aaye, mareez ko seedha bithayein aur kapde dheele kar dein. Ambulance raste mein hai, kripya phone line chalu rakhein.",
        english: "This sounds like a medical emergency! Please do not panic. I am dispatching a 108 Ambulance to your location immediately. While waiting, make the patient sit upright and loosen any tight clothing. The ambulance is on the way, please stay on the line.",
        logsToFire: 'emergency_dispatch',
    }
];

// ─── CloudWatch Log Batches (keyed by conversation phase) ────────────────────
function buildLogBatches() {
    return {
        greeting: [
            { level: 'start', text: `START RequestId: ${REQUEST_ID}  Version: $LATEST` },
            { level: 'info', text: `[callHandler] Lambda cold start — runtime: nodejs20.x, memory: 512MB, region: ap-south-1` },
            { level: 'info', text: `[callHandler] Incoming webhook received`, data: { source: 'Twilio', callSid: CALL_SID, from: '+91-98XXXXXX10', to: '+1-800-VAIDYA1' } },
            { level: 'info', text: `[callHandler] Call session created`, data: { callId: CALL_ID, language: 'hindi', callSourceType: 'direct_call' } },
            { level: 'info', text: `[callHandler] IVR greeting delivered via Amazon Polly — voice: "Kajal", engine: neural, lang: hi-IN` },
        ],

        emergency_dispatch: [
            { level: 'info', text: `[callHandler] Caller utterance received (Interim / Final) — transcribing via Amazon Transcribe (hi-IN)` },
            { level: 'warn', text: `[IntentRouterService] Stage 1: Keyword scan — EMERGENCY KEYWORDS DETECTED`, data: { matches: ['heart attack', 'seene', 'dard'] } },
            { level: 'error', text: `[IntentRouterService] EMERGENCY PATH TRIGGERED — bypassing standard LLM triage for zero-latency response` },
            { level: 'info', text: `[EmergencyKBService] Querying Emergency Scripts static local database (Zero Latency)` },
            { level: 'success', text: `[EmergencyKBService] Retrieved script: "Cardiac Arrest / AMI"` },
            { level: 'info', text: `[EmergencyDispatcher] Simulating 108 Ambulance dispatch API call`, data: { location: 'Caller STD code mapped region (Hyderabad)', severity: 'CRITICAL_L1' } },
            { level: 'success', text: `[EmergencyDispatcher] Ambulance dispatched successfully!`, data: { vehicleId: 'AMB-108-AP-01', ETA: '8 mins' } },
            { level: 'info', text: `[EmergencyDispatcher] Notifying nearest District Hospital casualty ward via AWS SNS` },
            { level: 'info', text: `[CallLoggerService] Logging critical emergency event to DynamoDB (Priority Queue)` },
            { level: 'info', text: `[SMSService] Sending emergency alert SMS to caller` },
            { level: 'success', text: `[DiseaseSurveillance] Registered critical cardiovascular event for regional mapping` }
        ],

        end: [
            { level: 'info', text: `[callHandler] Call suspended in active monitoring mode`, data: { status: 'waiting_for_ambulance' } },
            { level: 'start', text: `END RequestId: ${REQUEST_ID}` },
            { level: 'start', text: `REPORT RequestId: ${REQUEST_ID}  Duration: 845.12 ms  Billed Duration: 846 ms  Memory Size: 512 MB  Max Memory Used: 129 MB  Init Duration: 310.15 ms` },
        ],
    };
}

// ─── State ───────────────────────────────────────────────────────────────────
let callActive = false;
let timerInterval = null;
let timerSeconds = 0;
let bedrockCalls = 0;
let recognition = null;
let isSpeaking = false;
let logBatches = null;

// ─── DOM Refs ────────────────────────────────────────────────────────────────
const chatContainer = document.getElementById('chatContainer');
const cwLogs = document.getElementById('cwLogs');
const callTimer = document.getElementById('callTimer');
const callStatusBadge = document.getElementById('callStatusBadge');
const cwLiveIndicator = document.getElementById('cwLiveIndicator');
const liveStream = document.getElementById('liveStreamIndicator');
const btnCall = document.getElementById('btnCall');
const smsCard = document.getElementById('smsCard');
const micPrompt = document.getElementById('micPrompt');
const micPromptText = document.getElementById('micPromptText');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(sec) {
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}
function nowTimestamp() {
    return new Date().toISOString().slice(11, 23);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function formatData(obj) {
    if (!obj) return '';
    const parts = Object.entries(obj).map(([k, v]) => {
        let valStr;
        if (typeof v === 'string') valStr = `<span class="log-str">"${v}"</span>`;
        else if (typeof v === 'number') valStr = `<span class="log-num">${v}</span>`;
        else if (typeof v === 'boolean') valStr = `<span class="log-bool">${v}</span>`;
        else if (Array.isArray(v)) valStr = `<span class="log-str">[${v.map(i => `"${i}"`).join(', ')}]</span>`;
        else valStr = `<span class="log-str">${JSON.stringify(v)}</span>`;
        return `<span class="log-key">${k}</span>: ${valStr}`;
    });
    return `<span class="log-data"> { ${parts.join(', ')} }</span>`;
}

// ─── Chat Messages ───────────────────────────────────────────────────────────
function addChatMessage(speaker, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${speaker}`;
    msg.innerHTML = `<span class="speaker-label">${speaker === 'ivr' ? '🤖 VaidyaVaani AI' : '👤 Caller'}</span>`;
    const textSpan = document.createElement('span');
    textSpan.className = 'msg-text';
    msg.appendChild(textSpan);
    chatContainer.appendChild(msg);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    // For caller messages, show instantly
    if (speaker === 'caller') {
        textSpan.textContent = text;
        return Promise.resolve();
    }
    // For IVR, typewriter word-by-word
    return typewriterEffect(textSpan, text);
}

async function typewriterEffect(element, text) {
    const words = text.split(' ');
    element.textContent = '';
    element.classList.add('typing-cursor');
    for (let i = 0; i < words.length; i++) {
        element.textContent += (i === 0 ? '' : ' ') + words[i];
        chatContainer.scrollTop = chatContainer.scrollHeight;
        await sleep(60 + Math.random() * 40); // 60-100ms per word
    }
    element.classList.remove('typing-cursor');
}

// ─── CloudWatch Log Entry ────────────────────────────────────────────────────
function addLogEntry(level, text, data) {
    const levelLabels = { info: 'INFO', success: 'INFO', warn: 'WARN', error: 'ERROR', start: 'PLATFORM' };
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.innerHTML = `
    <span class="log-time">${nowTimestamp()}</span>
    <span class="log-level">${levelLabels[level] || 'INFO'}</span>
    <span class="log-content">${text}${formatData(data)}</span>
  `;
    cwLogs.appendChild(entry);
    cwLogs.scrollTop = cwLogs.scrollHeight;

    if (text.includes('Nova Lite') || text.includes('Nova Pro') || text.includes('Knowledge Base')) {
        bedrockCalls++;
        document.getElementById('metricBedrock').textContent = bedrockCalls;
    }
}

async function fireLogBatch(batchName) {
    const batch = logBatches[batchName];
    if (!batch) return;
    for (const log of batch) {
        addLogEntry(log.level, log.text, log.data);
        await sleep(150 + Math.random() * 300);
    }
}

// ─── Waveform ────────────────────────────────────────────────────────────────
function setWaveformActive(active) {
    document.querySelectorAll('.waveform-bar').forEach(bar => bar.classList.toggle('active', active));
}

// ─── Timer ───────────────────────────────────────────────────────────────────
function startTimer() {
    timerSeconds = 0;
    timerInterval = setInterval(() => { timerSeconds++; callTimer.textContent = formatTime(timerSeconds); }, 1000);
}
function stopTimer() { clearInterval(timerInterval); }

// ─── TTS (Hindi via Web Speech Synthesis) ────────────────────────────────────
function getHindiVoice() {
    const voices = speechSynthesis.getVoices();
    let v = voices.find(v => v.lang === 'hi-IN' && v.name.toLowerCase().includes('female'));
    if (!v) v = voices.find(v => v.lang === 'hi-IN');
    if (!v) v = voices.find(v => v.lang.startsWith('hi'));
    if (!v) v = voices.find(v => v.lang === 'en-IN');
    if (!v) v = voices[0];
    return v;
}

function speakHindi(text) {
    return new Promise((resolve) => {
        const utter = new SpeechSynthesisUtterance(text);
        const voice = getHindiVoice();
        if (voice) utter.voice = voice;
        utter.lang = 'hi-IN';
        utter.rate = 0.92;
        utter.pitch = 1.0;
        utter.volume = 1.0;

        isSpeaking = true;
        micPrompt.style.display = 'flex';
        micPrompt.classList.add('speaking');
        micPromptText.textContent = '🔊 VaidyaVaani is speaking...';

        utter.onend = () => { isSpeaking = false; resolve(); };
        utter.onerror = () => { isSpeaking = false; resolve(); };
        speechSynthesis.speak(utter);
    });
}

// ─── Speech Recognition (Caller's mic) ──────────────────────────────────────
// Uses a smart silence timer based on which turn we are on.
// Turn 1 & 2 (explaining symptoms): 4.5 seconds of silence allowed.
// Turn 3 (saying thank you): 2.5 seconds of silence allowed.
// Max absolute limit of 15 seconds per turn.
function listenForCaller(currentTurn) {
    return new Promise((resolve) => {
        micPrompt.style.display = 'flex';
        micPrompt.classList.remove('speaking');
        micPromptText.textContent = '🎙️ Your turn — speak now';

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setTimeout(() => {
                addChatMessage('caller', '(Speech API unavailable — simulated input)');
                micPrompt.style.display = 'none';
                resolve('simulated');
            }, 5000);
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'hi-IN';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.continuous = true;

        let finalTranscript = '';
        let liveMsgEl = null;
        let stopped = false;
        let silenceTimer = null;

        const silenceRequired = (currentTurn === 3) ? 2500 : 4500; // ms

        // Hard stop after 15 seconds no matter what
        const hardStop = setTimeout(() => {
            stopped = true;
            try { recognition.stop(); } catch (e) { }
        }, 15000);

        function resetSilenceTimer() {
            if (silenceTimer) clearTimeout(silenceTimer);
            silenceTimer = setTimeout(() => {
                stopped = true;
                try { recognition.stop(); } catch (e) { }
            }, silenceRequired);
        }

        // If Chrome kills recognition early, restart it (unless we stopped it)
        recognition.onend = () => {
            if (!stopped) {
                // Chrome killed it early — restart to keep listening
                try { recognition.start(); } catch (e) { }
                return;
            }
            // We intentionally stopped — finalize
            clearTimeout(hardStop);
            if (silenceTimer) clearTimeout(silenceTimer);

            const text = finalTranscript.trim();
            if (liveMsgEl) {
                const msgText = liveMsgEl.querySelector('.msg-text');
                msgText.textContent = text || '(Audio captured)';
                msgText.classList.remove('typing-cursor');
            } else if (!text) {
                addChatMessage('caller', '(Audio captured)');
            }
            micPrompt.style.display = 'none';
            resolve(text || 'audio captured');
        };

        recognition.onresult = (event) => {
            let interim = '';
            finalTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            const liveText = (finalTranscript + interim).trim();
            if (liveText && !liveMsgEl) {
                liveMsgEl = document.createElement('div');
                liveMsgEl.className = 'chat-msg caller';
                liveMsgEl.innerHTML = '<span class="speaker-label">👤 Caller</span><span class="msg-text typing-cursor"></span>';
                chatContainer.appendChild(liveMsgEl);
            }
            if (liveMsgEl) {
                liveMsgEl.querySelector('.msg-text').textContent = liveText;
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            // 🚨 INSTANT EMERGENCY KEYWORD INTERCEPT 🚨
            const lower = liveText.toLowerCase();
            if (lower.includes('heart') || lower.includes('attack') || lower.includes('chest') || lower.includes('pain') || lower.includes('seene') || lower.includes('dard')) {
                stopped = true;
                clearTimeout(hardStop);
                if (silenceTimer) clearTimeout(silenceTimer);
                try { recognition.stop(); } catch (e) { } // instantly triggers onend
                return;
            }

            resetSilenceTimer();
        };

        recognition.onerror = (event) => {
            console.log('Speech recognition error:', event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-available') {
                stopped = true;
                clearTimeout(hardStop);
                if (silenceTimer) clearTimeout(silenceTimer);
                if (!liveMsgEl) addChatMessage('caller', '(Audio captured)');
                micPrompt.style.display = 'none';
                resolve('audio captured');
            }
        };

        recognition.start();
        resetSilenceTimer(); // Start initial 4.5s/2.5s timer
    });
}

// ─── Main Call Flow ──────────────────────────────────────────────────────────
async function startCall() {
    if (callActive) return;
    callActive = true;
    bedrockCalls = 0;
    logBatches = buildLogBatches();

    // Reset UI
    chatContainer.innerHTML = '';
    cwLogs.innerHTML = '';
    smsCard.classList.remove('show');

    // Activate
    btnCall.textContent = '🔴 Call Active...';
    btnCall.disabled = true;
    btnCall.classList.remove('start');
    btnCall.classList.add('end');
    callStatusBadge.textContent = 'Active';
    callStatusBadge.className = 'call-status-badge active';
    cwLiveIndicator.textContent = 'Streaming';
    cwLiveIndicator.className = 'call-status-badge active';
    liveStream.style.display = 'flex';
    document.getElementById('metricInvocations').textContent = '1';
    document.getElementById('metricStatus').textContent = 'In Progress';
    document.getElementById('metricStatus').className = 'metric-value warn';

    setWaveformActive(true);
    startTimer();

    // Ensure voices loaded
    if (speechSynthesis.getVoices().length === 0) {
        await new Promise(r => { speechSynthesis.onvoiceschanged = r; setTimeout(r, 1500); });
    }

    // ── Turn 0: IVR Greeting ──
    const greeting = IVR_RESPONSES[0];
    const greetType = addChatMessage('ivr', greeting.english);
    fireLogBatch(greeting.logsToFire);
    await speakHindi(greeting.hindi);
    await sleep(500);

    // ── Turn 1: Caller speaks → Emergency Intercepts ──
    // In this scenario, we only have one caller turn. As soon as they mention
    // "heart attack", the mic drops instantly and triggers the emergency bot.
    await listenForCaller(1);

    // Emergency bot kicks in instantly (no processing pause!)
    const response = IVR_RESPONSES[1];

    // Customize SMS card for Emergency 
    smsCard.innerHTML = `
        <h4 style="color:#ef4444; font-weight:bold;">🚨 108 AMBULANCE DISPATCHED</h4>
        <div class="sms-field"><span class="sms-label">Emergency:</span> Suspected Heart Attack (Cardiac Event)</div>
        <div class="sms-field"><span class="sms-label">Location:</span> Caller's GPS / Tower Location</div>
        <div class="sms-field"><span class="sms-label">ETA:</span> 8 minutes</div>
        <p style="margin-top:8px;">
        <strong>Instructions:</strong> Make patient sit upright. Loosen tight clothing. 
        Paramedics have been dispatched. Nearest District Hospital casualty ward alerted.
        </p>
    `;
    smsCard.className = 'sms-card show';
    smsCard.style.borderLeftColor = '#ef4444'; // Red border for emergency

    const typePromise = addChatMessage('ivr', response.english);
    fireLogBatch(response.logsToFire);
    await Promise.all([typePromise, speakHindi(response.hindi)]);

    // ── Wrap up ──
    micPrompt.style.display = 'none';
    await sleep(1500);
    await fireLogBatch('end');
    endCall();
}

function endCall() {
    callActive = false;
    setWaveformActive(false);
    stopTimer();
    speechSynthesis.cancel();
    if (recognition) { try { recognition.stop(); } catch (e) { } }

    callStatusBadge.textContent = 'Ended';
    callStatusBadge.className = 'call-status-badge ended';
    cwLiveIndicator.textContent = 'Complete';
    cwLiveIndicator.className = 'call-status-badge ended';
    liveStream.style.display = 'none';
    micPrompt.style.display = 'none';

    document.getElementById('metricDuration').textContent = '1847 ms';
    document.getElementById('metricMemory').textContent = '127 MB';
    document.getElementById('metricStatus').textContent = '200 OK';
    document.getElementById('metricStatus').className = 'metric-value';

    btnCall.textContent = '🔄 Call Again';
    btnCall.disabled = false;
    btnCall.classList.remove('end');
    btnCall.classList.add('start');
}

// Pre-load voices
speechSynthesis.getVoices();

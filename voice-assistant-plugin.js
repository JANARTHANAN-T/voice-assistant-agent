class VoiceAssistantPlugin {
    constructor(options = {}) {
        this.options = {
            websocketUrl: options.websocketUrl || 'ws://127.0.0.1:3000/api/v1/voice/call',
            silenceTimeout: options.silenceTimeout || 60000,
            buttonPosition: options.buttonPosition || 'bottom-right',
            agentId: options.agentId || '',
            theme: {
                primaryColor: '#2A59F1',
                secondaryColor: '#FFF',
                backgroundColor: '#EDF1FF',
                textColor: '#1F2937',
                ...options.theme
            },
            ...options
        };

        this.state = 'initial';
        this.websocket = null;
        this.silenceTimer = null;
        this.recognition = null;
        this.currentAudio = null;

        this.init();
    }

    init() {
        this.createUI();
        this.injectStyles();
    }

    createUI() {
        // Floating button only
        this.voiceAssistantButton = document.createElement('div');
        this.voiceAssistantButton.id = 'voice-assistant-button';
        this.voiceAssistantButton.className = 'voice-assistant-button';
        this.voiceAssistantButton.innerHTML = `<img src="./phone.png" class="icon" /> <span>Let's Talk</span>`;
        this.voiceAssistantButton.addEventListener('click', () => this.handleButtonClick());
        document.body.appendChild(this.voiceAssistantButton);

        // Container (initially hidden)
        this.container = document.createElement('div');
        this.container.id = 'voice-assistant-container';
        this.container.className = 'voice-assistant-container';
        this.container.style.display = 'none';

        this.avatar = document.createElement('img');
        this.avatar.src = './image.png';
        this.avatar.className = 'voice-assistant-avatar';
        this.container.appendChild(this.avatar);

        this.messageBox = document.createElement('div');
        this.messageBox.className = 'voice-assistant-message';
        this.container.appendChild(this.messageBox);

        document.body.appendChild(this.container);
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
      .voice-assistant-container {
        position: fixed;
        ${this.options.buttonPosition == 'bottom-right' ? `bottom: 20px; right: 20px;` : this.options.buttonPosition == 'top-right' ? `top: 20px; right: 20px;` : `bottom: 20px ; right: 20px;`}
        background: ${this.options.theme.backgroundColor};
        border-radius: 24px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.23);
        padding: 20px;
        width: 160px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        font-family: sans-serif;
        z-index: 9999;
      }

      .voice-assistant-button {
        position: fixed;
        ${this.options.buttonPosition == 'bottom-right' ? `bottom: 20px; right: 20px;` : this.options.buttonPosition == 'top-right' ? `top: 20px; right: 20px;` : `bottom: 20px ; right: 20px;`}
        background: ${this.options.theme.backgroundColor};
        border-radius: 28px;
        padding: 16px 8px 16px 16px;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.23);
        z-index: 9999;
        display: flex;
        align-items: center;
        column-gap: 8px;
      }

      .voice-assistant-button span {
        max-width: 0;
        opacity: 0;
        padding-right: 0;
        overflow: hidden;
        white-space: nowrap;
        transition: all 0.6s ease;
      }

      .voice-assistant-button:hover span {
        max-width: 120px; 
        padding-right: 8px;
        opacity: 1;
      }

      .voice-assistant-avatar {
        height: 80px;
        margin-bottom: 12px;
      }

      .voice-assistant-message {
        font-size: 14px;
        color: #111827;
        text-align: center;
      }

      .pill {
        padding: 6px 16px;
        border-radius: 9999px;
        font-size: 16px;
        border: none;
        font-weight: 500;
        display: flex;
        align-items: center;
        column-gap: 8px;
      }

      .pill.red {
        background-color: ${this.options.theme.secondaryColor};
        color: #D83C3C;
      }

      .pill.white {
        background-color: ${this.options.theme.secondaryColor};
      }

      .pill.primary {
        background-color: ${this.options.theme.primaryColor};
        color: #FFF;
      }

      .icon {
        height: 24px;
      }

      .cursor-pointer {
        cursor: pointer;
      }

      .message-box-wrapper {
        display: flex;
        align-item: center;
        column-gap: 8px
      }
    `;
        document.head.appendChild(style);
    }

    setState(newState) {
        this.state = newState;

        // Show/hide container
        if (this.container) {
            this.container.style.display = newState === 'initial' ? 'none' : 'flex';
            this.voiceAssistantButton.style.display = newState === 'initial' ? 'flex' : 'none';
        }

        this.updateButtonState();
    }

    updateButtonState() {
        this.messageBox.innerHTML = '';

        switch (this.state) {
            case 'initial':
                break;
            case 'connecting':
                this.messageBox.innerHTML = `<button class="pill primary">Connecting...</button>`;
                break;
            case 'listening':
                this.messageBox.innerHTML = `
                <div class="message-box-wrapper">
                    <button class="pill primary">Listening...</button>
                    <button class="pill red cursor-pointer" id="disconnect-button">
                        <img src="./circle-stop.png" class="icon" />
                    </button>
                </div>`;
                break;
            case 'generating':
                this.messageBox.innerHTML = `
                <div class="message-box-wrapper">
                    <button class="pill white">Thinking...</button>
                    <button class="pill red cursor-pointer" id="disconnect-button">
                        <img src="./circle-stop.png" class="icon" />
                    </button>
                </div>`;
                break;
            case 'speaking':
                this.messageBox.innerHTML = `
                    <button class="pill red cursor-pointer" id="disconnect-button">
                        <img src="./circle-stop.png" class="icon" /> Stop me
                    </button>`;
                break;
        }

        const stopButton = this.messageBox.querySelector('#disconnect-button');
        if (stopButton) stopButton.addEventListener('click', () => this.handleButtonClick());
    }

    handleButtonClick() {
        switch (this.state) {
            case 'initial':
                this.connect();
                break;
            default:
                this.disconnect();
                break;
        }
    }

    async connect() {
        try {
            this.setState('connecting');
            await this.setupWebSocket();
            this.setupSpeechRecognition();
        } catch (error) {
            console.error('Failed to connect:', error);
            this.handleError(error);
        }
    }

    setupWebSocket() {
        return new Promise((resolve, reject) => {
            this.websocket = new WebSocket(this.options.websocketUrl);

            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.websocket.send(JSON.stringify({
                    type: 'metadata',
                    data: {
                        agent_id:  this.options.agentId, 
                        language: "en" 
                    }
                }));
                resolve();
            };

            this.websocket.onmessage = (event) => this.handleWebSocketMessage(event);
            this.websocket.onclose = () => this.handleDisconnection();
            this.websocket.onerror = (error) => reject(error);

            setTimeout(() => {
                if (this.websocket.readyState !== WebSocket.OPEN) {
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 10000);
        });
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error('SpeechRecognition is not supported in this browser.');
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.setState('listening');
            this.resetSilenceTimer();
        };

        this.recognition.onresult = (event) => {
            this.resetSilenceTimer();
            const lastResult = event.results[event.resultIndex];
            const transcript = lastResult[0].transcript.trim();

            if (transcript && this.websocket?.readyState === WebSocket.OPEN && this.state === 'listening') {
                this.websocket.send(transcript.trim());
                this.dispatchEvent('transcript', { content: transcript });
            }
        };

        this.recognition.onerror = (event) => {
            if (event.error === 'aborted') return;
            this.handleError(event.error || 'Speech recognition error');
        };

        this.recognition.onend = () => {
            if (this.state === 'listening' && this.recognition) {
                try {
                    this.recognition.start();
                } catch (err) {
                    console.warn('Restart recognition failed:', err);
                }
            }
        };

        this.recognition.start();
    }

    resetSilenceTimer() {
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
            if (this.recognition && this.state === 'listening') {
                this.recognition.stop();
                this.setState('initial');
            }
        }, this.options.silenceTimeout);
    }

    handleWebSocketMessage(event) {
        try {
            if (event.data instanceof Blob) {
                this.playAudioResponse(event.data);
                return;
            }

            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'state':
                    this.handleStateMessage(data);
                    break;
                case 'response':
                    this.dispatchEvent('response', { content: data.content });
                    break;
            }
        } catch (error) {
            console.error('Invalid message:', error);
        }
    }

    handleStateMessage(data) {
        switch (data.call_state) {
            case 'connecting': this.setState('connecting'); break;
            case 'connected': this.setState('listening'); break;
            case 'agent_generating': this.setState('generating'); break;
            case 'agent_speaking': this.setState('speaking'); break;
        }
    }

    async playAudioResponse(data) {
        const audioUrl = URL.createObjectURL(data);
        const audio = new Audio(audioUrl);
        this.setState('speaking');
        this.currentAudio = audio;

        audio.onended = () => {
            this.setState('listening');
            this.setupSpeechRecognition();
        };

        audio.onerror = () => {
            this.setState('listening');
            this.setupSpeechRecognition();
        };

        audio.play().catch(() => {
            this.setState('listening');
            this.setupSpeechRecognition();
        });
    }

    disconnect() {
        this.cleanup();
        this.setState('initial');
    }

    cleanup() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }

        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }

        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }

    handleError(error) {
        console.error('Voice Assistant Error:', error);
        this.setState('initial');
        this.dispatchEvent('error', { error });
    }

    handleDisconnection() {
        this.setState('initial');
    }

    dispatchEvent(eventName, data) {
        const event = new CustomEvent(`voiceassistant:${eventName}`, { detail: data });
        document.dispatchEvent(event);
    }

    on(eventName, callback) {
        document.addEventListener(`voiceassistant:${eventName}`, callback);
    }

    off(eventName, callback) {
        document.removeEventListener(`voiceassistant:${eventName}`, callback);
    }

    destroy() {
        this.cleanup();
        if (this.container?.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        if (this.voiceAssistantButton?.parentElement) {
            this.voiceAssistantButton.parentElement.removeChild(this.voiceAssistantButton);
        }
    }

    getState() {
        return this.state;
    }

    isConnected() {
        return this.websocket?.readyState === WebSocket.OPEN;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceAssistantPlugin;
} else {
    window.VoiceAssistantPlugin = VoiceAssistantPlugin;
}
(() => {
  const CDN_PATH_PREFIX = 'https://cdn.jsdelivr.net/gh/JANARTHANAN-T/voice-assistant-agent@main';
  
  class ConvAIAgent {
    constructor(options = {}) {
      const defaultTheme = {
        primaryColor: '#2A59F1',
        secondaryColor: '#FFF',
        backgroundColor: '#EDF1FF',
        textColor: '#1F2937'
      };
    
      this.options = {
        websocketUrl: options.websocketUrl ?? 'ws://127.0.0.1:3000/api/v1/voice/call',
        silenceTimeout: options.silenceTimeout ?? 60000,
        buttonPosition: options.buttonPosition ?? 'bottom-right',
        agentId: options.agentId ?? '',
        theme: {
          ...defaultTheme,
          ...(options.theme || {})
        }
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
      this.voiceAssistantButton = document.createElement('div');
      this.voiceAssistantButton.id = 'voice-assistant-button';
      this.voiceAssistantButton.className = 'conv-ai-voice-assistant-button';
      this.voiceAssistantButton.innerHTML = `<img src="${CDN_PATH_PREFIX}/phone.png" class="conv-ai-icon" /> <span>Let's Talk</span>`;
      this.voiceAssistantButton.addEventListener('click', () => this.handleButtonClick());
      document.body.appendChild(this.voiceAssistantButton);
  
      this.container = document.createElement('div');
      this.container.id = 'voice-assistant-container';
      this.container.className = 'conv-ai-voice-assistant-container';
      this.container.style.display = 'none';
  
      this.avatar = document.createElement('img');
      this.avatar.src = `${CDN_PATH_PREFIX}/image.png`;
      this.avatar.className = 'conv-ai-voice-assistant-avatar';
      this.container.appendChild(this.avatar);
  
      this.messageBox = document.createElement('div');
      this.messageBox.className = 'conv-ai-voice-assistant-message';
      this.container.appendChild(this.messageBox);
  
      document.body.appendChild(this.container);
    }
  
    injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .conv-ai-voice-assistant-container {
          position: fixed;
          ${this._getPositionStyles()}
          background: ${this.options.theme.backgroundColor};
          border-radius: 24px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.23);
          padding: 20px;
          width: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          font-family: sans-serif;
          z-index: 9999;
        }
  
        .conv-ai-voice-assistant-button {
          position: fixed;
          ${this._getPositionStyles()}
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
  
        .conv-ai-voice-assistant-button span {
          max-width: 0;
          opacity: 0;
          padding-right: 0;
          overflow: hidden;
          white-space: nowrap;
          transition: all 0.6s ease;
        }
  
        .conv-ai-voice-assistant-button:hover span {
          max-width: 120px; 
          padding-right: 8px;
          opacity: 1;
        }
  
        .conv-ai-voice-assistant-avatar {
          height: 80px;
          margin-bottom: 12px;
        }
  
        .conv-ai-voice-assistant-message {
          font-size: 14px;
          color: #111827;
          text-align: center;
        }
  
        .conv-ai-pill {
          padding: 6px 16px;
          border-radius: 9999px;
          font-size: 16px;
          border: none;
          font-weight: 500;
          display: flex;
          align-items: center;
          column-gap: 8px;
        }
  
        .conv-ai-pill.conv-ai-red {
          background-color: ${this.options.theme.secondaryColor};
          color: #D83C3C;
        }
  
        .conv-ai-pill.conv-ai-white {
          background-color: ${this.options.theme.secondaryColor};
        }
  
        .conv-ai-pill.conv-ai-primary {
          background-color: ${this.options.theme.primaryColor};
          color: #FFF;
        }
  
        .conv-ai-icon {
          height: 24px;
        }
  
        .conv-ai-cursor-pointer {
          cursor: pointer;
        }
  
        .conv-ai-message-box-wrapper {
          display: flex;
          align-items: center;
          column-gap: 8px;
        }
      `;
      document.head.appendChild(style);
    }
  
    _getPositionStyles() {
      switch (this.options.buttonPosition) {
        case 'top-right': return 'top: 20px; right: 20px;';
        case 'bottom-right':
        default: return 'bottom: 20px; right: 20px;';
      }
    }
  
    setState(newState) {
      this.state = newState;
      this.container.style.display = newState === 'initial' ? 'none' : 'flex';
      this.voiceAssistantButton.style.display = newState === 'initial' ? 'flex' : 'none';
      this.updateButtonState();
    }
  
    updateButtonState() {
      this.messageBox.innerHTML = '';
      const iconUrl = `${CDN_PATH_PREFIX}/circle-stop.png`;
      const stopBtn = `<button class="conv-ai-pill conv-ai-red conv-ai-cursor-pointer" id="disconnect-button"><img src="${iconUrl}" class="conv-ai-icon" /></button>`;
  
      const states = {
        connecting: '<button class="conv-ai-pill conv-ai-primary">Connecting...</button>',
        listening: `<div class="conv-ai-message-box-wrapper"><button class="conv-ai-pill conv-ai-primary">Listening...</button>${stopBtn}</div>`,
        generating: `<div class="conv-ai-message-box-wrapper"><button class="conv-ai-pill conv-ai-white">Thinking...</button>${stopBtn}</div>`,
        speaking: `<button class="conv-ai-pill conv-ai-red conv-ai-cursor-pointer" id="disconnect-button"><img src="${iconUrl}" class="conv-ai-icon" /> Stop me</button>`
      };
  
      if (this.state in states) {
        this.messageBox.innerHTML = states[this.state];
      }
  
      const stopButton = this.messageBox.querySelector('#disconnect-button');
      if (stopButton) stopButton.addEventListener('click', () => this.handleButtonClick());
    }
  
    handleButtonClick() {
      if (this.state === 'initial') this.connect();
      else this.disconnect();
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
          this.websocket.send(JSON.stringify({
            type: 'metadata',
            data: { agent_id: this.options.agentId, language: 'en' }
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
      if (!SpeechRecognition) throw new Error('SpeechRecognition not supported in this browser.');
  
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
        const transcript = event.results[event.resultIndex][0].transcript.trim();
        if (transcript && this.websocket?.readyState === WebSocket.OPEN && this.state === 'listening') {
          this.websocket.send(transcript);
          this.dispatchEvent('transcript', { content: transcript });
        }
      };
  
      this.recognition.onerror = (event) => {
        if (event.error !== 'aborted') this.handleError(event.error || 'Speech recognition error');
      };
  
      this.recognition.onend = () => {
        if (this.state === 'listening') {
          try { this.recognition.start(); } catch (err) {}
        }
      };
  
      this.recognition.start();
    }
  
    resetSilenceTimer() {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = setTimeout(() => {
        if (this.recognition && this.state === 'listening') {
          this.recognition.stop();
          this.setState('initial');
        }
      }, this.options.silenceTimeout);
    }
  
    handleWebSocketMessage(event) {
      try {
        if (event.data instanceof Blob) return this.playAudioResponse(event.data);
  
        const data = JSON.parse(event.data);
        if (data.type === 'state') this.handleStateMessage(data);
        else if (data.type === 'response') this.dispatchEvent('response', { content: data.content });
      } catch (error) {
        console.error('Invalid message:', error);
      }
    }
  
    handleStateMessage(data) {
      const stateMap = {
        connecting: 'connecting',
        connected: 'listening',
        agent_generating: 'generating',
        agent_speaking: 'speaking'
      };
      if (data.call_state in stateMap) this.setState(stateMap[data.call_state]);
    }
  
    async playAudioResponse(data) {
      const audioUrl = URL.createObjectURL(data);
      const audio = new Audio(audioUrl);
      this.setState('speaking');
      this.currentAudio = audio;
  
      const resumeListening = () => {
        this.setState('listening');
        this.setupSpeechRecognition();
      };
  
      audio.onended = resumeListening;
      audio.onerror = resumeListening;
  
      try { await audio.play(); } catch { resumeListening(); }
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
  
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  
    handleError(error) {
      console.error('Conv AI Agent Error:', error);
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
      this.container?.remove();
      this.voiceAssistantButton?.remove();
    }
  
    getState() {
      return this.state;
    }
  
    isConnected() {
      return this.websocket?.readyState === WebSocket.OPEN;
    }
  }
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConvAIAgent;
  } else {
    window.ConvAIAgent = ConvAIAgent;
  }

})();

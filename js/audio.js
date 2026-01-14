export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.3; // Low volume
        this.enabled = false;
    }

    enable() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.enabled = true;
    }

    playTone(freq, type, duration, slide = 0) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slide) {
            osc.frequency.linearRampToValueAtTime(freq + slide, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // SFX Presets
    playJump() {
        this.playTone(150, 'square', 0.1, 100);
    }

    playCut() {
        this.playTone(800, 'square', 0.1, -200);
        setTimeout(() => this.playTone(400, 'sawtooth', 0.2, -300), 50);
    }

    playDie() {
        this.playTone(200, 'sawtooth', 0.5, -150);
        this.playTone(150, 'square', 0.5, -100);
    }

    playStart() {
        this.playTone(300, 'square', 0.1, 200);
        setTimeout(() => this.playTone(500, 'square', 0.2, 200), 100);
    }

    playWin() {
        // Simple Victory Fanfare
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            // Basic Arpeggio
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.value = 0.2;
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.5);
        });
    }
}

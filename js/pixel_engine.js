export class PixelEngine {
    constructor(canvasId, width = 320, height = 180) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimize

        // Logical Resolution (Game Boy Advance-ish)
        this.width = width;
        this.height = height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.layers = {
            sky: [],
            farCity: [],
            midCity: [],
            action: [], // Kites, Birds
            foreground: [], // Rooftops
            particles: []
        };

        // Global Simulation State
        this.wind = { x: 0.5, y: -0.2 }; // Base wind
        this.time = 0;
        this.camera = { x: 0, y: 0, shake: 0 };

        this.init();
    }

    init() {
        this.startLoop();
    }

    startLoop() {
        requestAnimationFrame((t) => this.loop(t));
    }

    // Entity Management
    addEntity(layerName, entity) {
        if (this.layers[layerName]) {
            this.layers[layerName].push(entity);
        }
    }

    // The Main Game Loop
    loop(timestamp) {
        // 1. Update Global State
        this.time += 0.05;

        // Dynamic Wind (Gusts)
        this.wind.x = 0.5 + Math.sin(this.time * 0.1) * 0.3; // Gentle sine wave wind

        // Camera Shake Decay
        if (this.camera.shake > 0) {
            this.camera.x = (Math.random() - 0.5) * this.camera.shake;
            this.camera.y = (Math.random() - 0.5) * this.camera.shake;
            this.camera.shake *= 0.9; // Decay
            if (this.camera.shake < 0.5) { this.camera.shake = 0; this.camera.x = 0; this.camera.y = 0; }
        }

        // 2. Clear Screen
        this.ctx.fillStyle = "#639bff"; // Fallback Sky Color
        this.ctx.fillRect(0, 0, this.width, this.height);

        // 3. Render Layers in Order
        this.ctx.save();
        this.ctx.translate(Math.floor(this.camera.x), Math.floor(this.camera.y)); // Integer snap for crisp pixels

        this.renderLayer('sky');
        this.renderLayer('farCity');
        this.renderLayer('midCity');
        this.renderLayer('foreground');
        this.renderLayer('action');
        this.renderLayer('particles');

        this.ctx.restore();

        requestAnimationFrame((t) => this.loop(t));
    }

    renderLayer(name) {
        const layer = this.layers[name];
        // Filter out dead entities
        this.layers[name] = layer.filter(e => !e.dead);

        this.layers[name].forEach(entity => {
            entity.update(this);
            entity.draw(this.ctx);
        });
    }

    triggerShake(amount) {
        this.camera.shake = amount;
    }
}

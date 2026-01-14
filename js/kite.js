export class Kite {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.targetY = -100; // Fly off screen eventually
        this.color = color;
        this.size = 30; // Base size
        this.speedY = 0.5 + Math.random() * 1.5; // Upward drift
        this.sway = Math.random() * Math.PI * 2; // Initial sway angle
        this.swaySpeed = 0.02 + Math.random() * 0.03;
        this.swayAmplitude = 20 + Math.random() * 30;
        this.opacity = 0; // Fade in on spawn
        this.state = 'spawning'; // spawning, flying, gone
    }

    update() {
        if (this.state === 'spawning') {
            this.opacity += 0.02;
            if (this.opacity >= 1) {
                this.opacity = 1;
                this.state = 'flying';
            }
        }

        // Upward movement
        this.y -= this.speedY;

        // Horizontal sway
        this.sway += this.swaySpeed;
        this.offsetX = Math.sin(this.sway) * this.swayAmplitude;

        // Check if off screen
        if (this.y < -100) {
            this.state = 'gone';
        }
    }

    draw(ctx) {
        if (this.state === 'gone') return;

        ctx.save();
        ctx.translate(this.x + this.offsetX, this.y);

        // Rotate slightly based on sway
        ctx.rotate(Math.cos(this.sway) * 0.1);

        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;

        // Draw Diamond Shape (Kite)
        ctx.beginPath();
        ctx.moveTo(0, -this.size); // Top point
        ctx.lineTo(this.size * 0.8, 0); // Right point
        ctx.lineTo(0, this.size); // Bottom point
        ctx.lineTo(-this.size * 0.8, 0); // Left point
        ctx.closePath();
        ctx.fill();

        // Cross spars (Subtle detail)
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(0, this.size);
        ctx.moveTo(-this.size * 0.8, 0);
        ctx.lineTo(this.size * 0.8, 0);
        ctx.stroke();

        // Tail (Simple line or small curve)
        ctx.beginPath();
        ctx.moveTo(0, this.size);
        ctx.quadraticCurveTo(10, this.size + 20, 0, this.size + 40);
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = this.opacity * 0.6;
        ctx.stroke();

        ctx.restore();
    }
}

export class KiteManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.kites = [];
    }

    spawnKite(x, y, color) {
        this.kites.push(new Kite(x, y, color));
    }

    updateAndDraw() {
        // Filter out gone kites
        this.kites = this.kites.filter(k => k.state !== 'gone');

        this.kites.forEach(kite => {
            kite.update();
            kite.draw(this.ctx);
        });
    }
}

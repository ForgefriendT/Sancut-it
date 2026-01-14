export class ParticleSystem {
    constructor() { }

    static spawnExplosion(engine, x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            engine.addEntity('particles', new Particle(x, y, color));
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
    }

    update(engine) {
        this.x += this.vx;
        this.y += this.vy;

        this.vx *= 0.9; // Friction
        this.vy *= 0.9;
        this.vy += 0.05; // Gravity

        this.life -= this.decay;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), 1, 1); // 1px particle
        ctx.globalAlpha = 1.0;
    }
}

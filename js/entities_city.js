export class Skyline {
    constructor(color, heightMod) {
        this.color = color;
        this.buildings = [];
        this.generate(heightMod);
    }

    generate(heightMod) {
        let x = 0;
        while (x < 350) { // Slight overscan
            const width = 10 + Math.random() * 20;
            const height = 20 + Math.random() * 40 * heightMod;
            this.buildings.push({ x, w: width, h: height });
            x += width - 2; // Overlap slightly
        }
    }

    update(engine) {
        // Static for now, could parallax
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        this.buildings.forEach(b => {
            const groundY = 180; // Bottom of screen
            ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
        });
    }
}

export class Rooftop {
    constructor(x, width) {
        this.x = x;
        this.width = width;
        this.y = 180;
        this.height = 40 + Math.random() * 20; // Foreground height

        // Roof Props
        this.props = [];
        this.generateProps();
        this.people = [];
        this.generatePeople();
    }

    generateProps() {
        // Water Tank
        if (Math.random() > 0.5) {
            this.props.push({ type: 'tank', x: Math.random() * (this.width - 10), w: 10, h: 12 });
        }
        // Antenna
        if (Math.random() > 0.3) {
            this.props.push({ type: 'antenna', x: Math.random() * (this.width - 2), h: 15 });
        }
    }

    generatePeople() {
        // Add 1-2 tiny people flying kites
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            this.people.push({
                x: 5 + Math.random() * (this.width - 10),
                color: Math.random() > 0.5 ? '#d41c6c' : '#ffffff', // Pink or White shirt
                frame: 0
            });
        }
    }

    update(engine) {
        // Animate people (bobbing)
        if (Math.floor(engine.time) % 10 === 0) {
            this.people.forEach(p => p.frame = (p.frame + 1) % 2);
        }
    }

    draw(ctx) {
        const topY = this.y - this.height;
        ctx.fillStyle = '#4a2c2a'; // Dark terracotta brick
        ctx.fillRect(this.x, topY, this.width, this.height);

        // Draw Props
        ctx.fillStyle = '#000000'; // Silhouettes for some contrast? Or dark concrete
        this.props.forEach(p => {
            if (p.type === 'tank') {
                ctx.fillStyle = '#222';
                ctx.fillRect(this.x + p.x, topY - p.h, p.w, p.h);
            } else if (p.type === 'antenna') {
                ctx.beginPath();
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 1;
                ctx.moveTo(this.x + p.x, topY);
                ctx.lineTo(this.x + p.x, topY - p.h);
                ctx.stroke();
            }
        });

        // Draw Tiny People (5x3 pixels)
        this.people.forEach(p => {
            const py = topY - 6 + (p.frame === 1 ? 1 : 0); // Bob up/down
            ctx.fillStyle = p.color;
            ctx.fillRect(this.x + p.x, py, 3, 5); // Body
            ctx.fillStyle = '#332211'; // Head
            ctx.fillRect(this.x + p.x, py - 2, 3, 2);

            // Thin string line going up?
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 0.5;
            ctx.moveTo(this.x + p.x + 1, py);
            ctx.lineTo(this.x + p.x + (Math.random() * 10 - 5), py - 20); // Random string direction
            ctx.stroke();
        });
    }
}

export class PixelCloud {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 20 + Math.random() * 30;
        this.h = 10 + Math.random() * 10;
        this.speed = 0.2 + Math.random() * 0.3;
        this.opacity = 0.3 + Math.random() * 0.3;
    }

    update(engine) {
        this.x += this.speed;
        if (this.x > engine.width) {
            this.x = -this.w;
            this.y = 10 + Math.random() * (engine.height / 2); // Random height
        }
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        // Detail for fluffiness (simple blocks)
        ctx.fillRect(this.x + 5, this.y - 5, this.w - 10, 5);
        ctx.fillRect(this.x + 10, this.y - 8, this.w - 20, 3);
    }
}

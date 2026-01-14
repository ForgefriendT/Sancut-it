export class Sky {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Configuration
        this.timeOfDay = 'morning'; // morning, noon, evening
        this.clouds = [];
        this.lastTime = 0;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initClouds();
        this.startLoop();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initClouds() {
        // Create 5-7 soft clouds
        const cloudCount = 6;
        for (let i = 0; i < cloudCount; i++) {
            this.clouds.push({
                x: Math.random() * this.width,
                y: Math.random() * (this.height * 0.6), // Upper 60% only
                radius: 60 + Math.random() * 100,
                speed: 0.05 + Math.random() * 0.1,
                opacity: 0.1 + Math.random() * 0.2
            });
        }
    }

    getGradientColors() {
        const styles = getComputedStyle(document.documentElement);
        
        // Simple time-based logic (could be expanded)
        // For now, let's stick to morning as default based on CSS fallback
        // but we can pull from CSS variables if we want dynamic changes
        return {
            top: styles.getPropertyValue('--sky-morning-top').trim(),
            bottom: styles.getPropertyValue('--sky-morning-bottom').trim()
        };
    }

    drawGradient() {
        // Safety check for colors
        let colors = this.getGradientColors();
        if (!colors.top) colors = { top: '#CFE6F3', bottom: '#EAF6FF' };

        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, colors.top);
        gradient.addColorStop(1, colors.bottom);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawClouds() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; // Soft white clouds
        
        this.clouds.forEach(cloud => {
            this.ctx.beginPath();
            // Simple circle for now, can be made complex with multiple overlapping circles
            this.ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
            
            // Soft blurry edges for clouds
            this.ctx.shadowBlur = 40;
            this.ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
            
            this.ctx.globalAlpha = cloud.opacity;
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
            this.ctx.shadowBlur = 0; // Reset
            
            // Move cloud
            cloud.x += cloud.speed;
            
            // Wrap around
            if (cloud.x - cloud.radius > this.width) {
                cloud.x = -cloud.radius;
            }
        });
    }

    animate(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        // const deltaTime = timestamp - this.lastTime;
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.drawGradient();
        this.drawClouds();

        this.lastTime = timestamp;
        requestAnimationFrame((t) => this.animate(t));
    }

    startLoop() {
        requestAnimationFrame((t) => this.animate(t));
    }
}

// Matrix Rain Effect for Darkweb Hacker Theme
class MatrixRain {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.drops = [];
        this.fontSize = 14;
        this.columns = 0;
        this.matrix = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789₿♦♠♣♥∏∑∆√∞∂∫≈≠≤≥±×÷←→↑↓⚡⚠☠☢☣⚗⚖⚔⚡";
        
        this.init();
    }
    
    init() {
        this.createCanvas();
        this.setupCanvas();
        this.startRain();
        this.handleResize();
    }
    
    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: -2;
            opacity: 0.1;
        `;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
    }
    
    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.columns = Math.floor(this.canvas.width / this.fontSize);
        
        // Initialize drops
        this.drops = [];
        for (let i = 0; i < this.columns; i++) {
            this.drops[i] = Math.random() * this.canvas.height;
        }
    }
    
    drawMatrix() {
        // Semi-transparent black background to create trailing effect
        this.ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Green text
        this.ctx.fillStyle = '#00ff41';
        this.ctx.font = `${this.fontSize}px 'JetBrains Mono', monospace`;
        
        // Draw matrix characters
        for (let i = 0; i < this.drops.length; i++) {
            // Random character from matrix string
            const char = this.matrix.charAt(Math.floor(Math.random() * this.matrix.length));
            
            // Draw character
            this.ctx.fillText(char, i * this.fontSize, this.drops[i]);
            
            // Move drop down
            this.drops[i] += this.fontSize;
            
            // Reset drop to top randomly or when it goes off screen
            if (this.drops[i] > this.canvas.height && Math.random() > 0.975) {
                this.drops[i] = 0;
            }
        }
    }
    
    startRain() {
        const animate = () => {
            this.drawMatrix();
            requestAnimationFrame(animate);
        };
        animate();
    }
    
    handleResize() {
        window.addEventListener('resize', () => {
            this.setupCanvas();
        });
    }
}

// Glitch Effect for Text Elements
class GlitchEffect {
    constructor() {
        this.glitchElements = [];
        this.init();
    }
    
    init() {
        // Find all elements with glitch class
        this.glitchElements = document.querySelectorAll('.glitch');
        this.startGlitchEffect();
    }
    
    startGlitchEffect() {
        setInterval(() => {
            this.glitchElements.forEach(element => {
                if (Math.random() > 0.95) {
                    this.triggerGlitch(element);
                }
            });
        }, 100);
    }
    
    triggerGlitch(element) {
        element.style.animation = 'none';
        element.offsetHeight; // Trigger reflow
        element.style.animation = 'glitch 0.3s linear';
        
        setTimeout(() => {
            element.style.animation = 'glitch 2s linear infinite';
        }, 300);
    }
}

// Terminal Typing Effect
class TerminalTyping {
    constructor() {
        this.terminals = [];
        this.init();
    }
    
    init() {
        // Find all terminal cursor elements
        const terminalElements = document.querySelectorAll('.terminal-cursor');
        terminalElements.forEach(element => {
            this.addTypingEffect(element);
        });
    }
    
    addTypingEffect(element) {
        const originalText = element.textContent;
        element.textContent = '';
        
        let i = 0;
        const typeWriter = () => {
            if (i < originalText.length) {
                element.textContent += originalText.charAt(i);
                i++;
                setTimeout(typeWriter, Math.random() * 100 + 50);
            }
        };
        
        // Start typing effect after a delay
        setTimeout(typeWriter, Math.random() * 2000 + 1000);
    }
}

// Particle System for Interactive Elements
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.canvas = null;
        this.ctx = null;
        this.mouse = { x: 0, y: 0 };
        this.init();
    }
    
    init() {
        this.createCanvas();
        this.setupEventListeners();
        this.animate();
    }
    
    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: -1;
        `;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }
    
    setupEventListeners() {
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            
            // Create particles on mouse move
            if (Math.random() > 0.8) {
                this.createParticle(this.mouse.x, this.mouse.y);
            }
        });
        
        // Create particles on button hover
        const buttons = document.querySelectorAll('.btn, .card');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', (e) => {
                const rect = e.target.getBoundingClientRect();
                for (let i = 0; i < 5; i++) {
                    this.createParticle(
                        rect.left + Math.random() * rect.width,
                        rect.top + Math.random() * rect.height
                    );
                }
            });
        });
    }
    
    createParticle(x, y) {
        this.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 1,
            decay: Math.random() * 0.02 + 0.01,
            size: Math.random() * 3 + 1,
            color: `hsl(${120 + Math.random() * 60}, 100%, 50%)`
        });
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    drawParticles() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = particle.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = particle.color;
            
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }
    
    animate() {
        this.updateParticles();
        this.drawParticles();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize all effects when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all elements are rendered
    setTimeout(() => {
        new MatrixRain();
        new GlitchEffect();
        new TerminalTyping();
        new ParticleSystem();
        
        // Add some console messages for hacker effect
        console.log('%c🔓 SYSTEM ACCESS GRANTED', 'color: #00ff41; font-size: 16px; font-weight: bold;');
        console.log('%c⚡ Bitcoin RBF Manager v2.0.0', 'color: #00d4ff; font-size: 12px;');
        console.log('%c⚠️  MAINNET ENVIRONMENT DETECTED', 'color: #ff3333; font-size: 12px;');
        console.log('%c🎯 Anonymous session initialized...', 'color: #8b00ff; font-size: 10px;');
    }, 500);
});
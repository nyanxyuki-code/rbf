// Terminal Matrix Rain Effect
class TerminalMatrix {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.drops = [];
        this.fontSize = 12;
        this.columns = 0;
        this.matrix = "01₿⚡⚠☠♦♠♣♥∞∑∆√∂∫≈≠≤≥±×÷←→↑↓abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
        
        this.init();
    }
    
    init() {
        this.createCanvas();
        this.setupCanvas();
        this.startRain();
        this.handleResize();
        this.addTerminalEffects();
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
            z-index: -10;
            opacity: 0.03;
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
        // Semi-transparent black background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Terminal green text
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = `${this.fontSize}px 'JetBrains Mono', monospace`;
        
        // Draw matrix characters
        for (let i = 0; i < this.drops.length; i++) {
            const char = this.matrix.charAt(Math.floor(Math.random() * this.matrix.length));
            this.ctx.fillText(char, i * this.fontSize, this.drops[i]);
            this.drops[i] += this.fontSize;
            
            if (this.drops[i] > this.canvas.height && Math.random() > 0.95) {
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
    
    addTerminalEffects() {
        // Add terminal boot sequence
        this.addBootSequence();
        
        // Add typing sound effects (visual)
        this.addTypingEffects();
        
        // Add console messages
        this.addConsoleMessages();
    }
    
    addBootSequence() {
        setTimeout(() => {
            console.log('%c[SYSTEM]', 'color: #00ff00; font-weight: bold;', 'Bitcoin RBF Terminal v2.0.0 initialized');
            console.log('%c[NETWORK]', 'color: #00ff00; font-weight: bold;', 'Connected to Bitcoin mainnet');
            console.log('%c[SECURITY]', 'color: #ffb000; font-weight: bold;', 'Private key operations enabled');
            console.log('%c[RBF]', 'color: #00ff00; font-weight: bold;', 'Replace-By-Fee module loaded');
            console.log('%c[WARNING]', 'color: #ff0040; font-weight: bold;', 'MAINNET ENVIRONMENT - REAL BITCOIN');
        }, 1000);
    }
    
    addTypingEffects() {
        // Add typewriter effect to terminal lines
        const terminalLines = document.querySelectorAll('.terminal-line');
        terminalLines.forEach((line, index) => {
            setTimeout(() => {
                line.classList.add('visible');
            }, index * 200);
        });
    }
    
    addConsoleMessages() {
        // Add random terminal messages
        const messages = [
            'Establishing secure connection...',
            'Loading Bitcoin node data...',
            'Initializing RBF protocol...',
            'Checking UTXO availability...',
            'Validating network consensus...',
            'Ready for operations.'
        ];
        
        messages.forEach((msg, index) => {
            setTimeout(() => {
                console.log(`%c[${Date.now()}]`, 'color: #808080;', msg);
            }, index * 1000 + 2000);
        });
    }
}

// Terminal Typewriter Effect
class TerminalTypewriter {
    constructor() {
        this.init();
    }
    
    init() {
        this.typeElements();
        this.addCursorAnimation();
    }
    
    typeElements() {
        const elements = document.querySelectorAll('[data-type]');
        elements.forEach((element, index) => {
            setTimeout(() => {
                this.typeText(element, element.textContent);
            }, index * 1000);
        });
    }
    
    typeText(element, text) {
        element.textContent = '';
        element.style.borderRight = '2px solid #00ff00';
        
        let i = 0;
        const typeInterval = setInterval(() => {
            element.textContent += text.charAt(i);
            i++;
            
            if (i >= text.length) {
                clearInterval(typeInterval);
                element.style.borderRight = 'none';
            }
        }, Math.random() * 50 + 25);
    }
    
    addCursorAnimation() {
        // Animate the main cursor
        const cursor = document.querySelector('.cursor');
        if (cursor) {
            setInterval(() => {
                cursor.style.opacity = cursor.style.opacity === '0' ? '1' : '0';
            }, 500);
        }
    }
}

// Terminal Command Simulator
class TerminalCommandSimulator {
    constructor() {
        this.commands = [
            'checking system integrity...',
            'loading bitcoin protocol...',
            'establishing secure connection...',
            'initializing wallet subsystem...',
            'rbf module status: active',
            'ready for user input.'
        ];
        this.init();
    }
    
    init() {
        this.simulateBootup();
    }
    
    simulateBootup() {
        const prompt = document.querySelector('.terminal-prompt');
        if (!prompt) return;
        
        // Hide the prompt initially
        prompt.style.display = 'none';
        
        this.commands.forEach((command, index) => {
            setTimeout(() => {
                this.addCommandLine(command);
                
                // Show prompt after last command
                if (index === this.commands.length - 1) {
                    setTimeout(() => {
                        prompt.style.display = 'block';
                    }, 1000);
                }
            }, index * 800);
        });
    }
    
    addCommandLine(command) {
        const content = document.querySelector('.terminal-content');
        const line = document.createElement('div');
        line.className = 'terminal-line info';
        line.innerHTML = `<span class="prompt-symbol">[SYS]</span> ${command}`;
        
        // Insert before the prompt
        const prompt = document.querySelector('.terminal-prompt');
        content.insertBefore(line, prompt);
        
        // Auto scroll to bottom
        content.scrollTop = content.scrollHeight;
    }
}

// ASCII Art Animation
class ASCIIAnimation {
    constructor() {
        this.init();
    }
    
    init() {
        this.animateASCII();
    }
    
    animateASCII() {
        const asciiElements = document.querySelectorAll('.ascii-art');
        
        asciiElements.forEach((element, index) => {
            // Add glow effect
            element.style.textShadow = '0 0 10px #00ff00';
            
            // Animate on hover
            element.addEventListener('mouseenter', () => {
                element.style.textShadow = '0 0 20px #00ff00, 0 0 30px #00ff41, 0 0 40px #00ff00';
                element.style.transform = 'scale(1.02)';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.textShadow = '0 0 10px #00ff00';
                element.style.transform = 'scale(1)';
            });
        });
    }
}

// Terminal Button Effects
class TerminalButtons {
    constructor() {
        this.init();
    }
    
    init() {
        this.addButtonEffects();
        this.addHoverSounds();
    }
    
    addButtonEffects() {
        const buttons = document.querySelectorAll('.terminal-option');
        
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.boxShadow = '0 0 20px #00ff00';
                button.style.textShadow = '0 0 5px #000000';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.boxShadow = 'none';
                button.style.textShadow = 'none';
            });
            
            button.addEventListener('click', () => {
                // Add click animation
                button.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 100);
                
                // Add command feedback
                this.addCommandFeedback(button.textContent);
            });
        });
    }
    
    addCommandFeedback(command) {
        const content = document.querySelector('.terminal-content');
        const line = document.createElement('div');
        line.className = 'terminal-line success';
        line.innerHTML = `<span class="prompt-symbol">$</span> ${command}`;
        
        const prompt = document.querySelector('.terminal-prompt');
        content.insertBefore(line, prompt);
        content.scrollTop = content.scrollHeight;
    }
    
    addHoverSounds() {
        // Visual representation of sound
        const buttons = document.querySelectorAll('.terminal-option');
        
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                // Create a small visual "beep"
                const beep = document.createElement('span');
                beep.textContent = '♦';
                beep.style.cssText = `
                    position: absolute;
                    color: #00ff00;
                    font-size: 8px;
                    animation: fadeOut 0.3s ease-out forwards;
                    pointer-events: none;
                `;
                
                button.style.position = 'relative';
                button.appendChild(beep);
                
                setTimeout(() => {
                    if (beep.parentNode) {
                        beep.parentNode.removeChild(beep);
                    }
                }, 300);
            });
        });
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Loading Animation
class TerminalLoading {
    constructor() {
        this.frames = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
        this.frameIndex = 0;
        this.init();
    }
    
    init() {
        this.animateSpinner();
    }
    
    animateSpinner() {
        const spinner = document.querySelector('.loading-spinner');
        if (!spinner) return;
        
        setInterval(() => {
            spinner.textContent = this.frames[this.frameIndex];
            this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        }, 100);
    }
}

// Initialize all terminal effects
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
        new TerminalMatrix();
        new TerminalTypewriter();
        new TerminalCommandSimulator();
        new ASCIIAnimation();
        new TerminalButtons();
        new TerminalLoading();
        
        // Add terminal startup sound (visual)
        console.log('%c████████████████████████████████████████', 'color: #00ff00;');
        console.log('%c█ BITCOIN RBF TERMINAL INTERFACE v2.0 █', 'color: #00ff00; font-weight: bold;');
        console.log('%c████████████████████████████████████████', 'color: #00ff00;');
        console.log('%c[INIT] Loading terminal interface...', 'color: #00ff41;');
        console.log('%c[OK] All systems operational', 'color: #00ff00;');
        console.log('%c[WARNING] MAINNET mode active', 'color: #ff0040; font-weight: bold;');
        
    }, 100);
});
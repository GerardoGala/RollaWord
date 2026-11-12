/**
 * RollaWord Kids Mode Celebration Engine
 */
const KidsCelebration = {
    BALLOON_COUNT: 25,
    HANDS_COUNT: 6,
    CELEBRATION_DURATION: 4500, 
    BALLOON_COLORS: ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3', '#33FFF0', '#FFA500'],

    _injectStyles() {
        if (document.getElementById('celebration-styles')) return;
        const style = document.createElement('style');
        style.id = 'celebration-styles';
        style.textContent = `
            @keyframes floatUp {
                0% { transform: translateY(105vh) translateX(0) rotate(0deg); opacity: 1; }
                100% { transform: translateY(-20vh) translateX(var(--drift)) rotate(var(--spin)); opacity: 0; }
            }
            @keyframes clapLeft {
                0%, 100% { transform: scale(1) translate(-50%, -50%) rotate(-15deg); }
                50% { transform: scale(1.15) translate(-40%, -50%) rotate(5deg); }
            }
            @keyframes clapRight {
                0%, 100% { transform: scale(1) translate(-50%, -50%) rotate(15deg); }
                50% { transform: scale(1.15) translate(-60%, -50%) rotate(-5deg); }
            }
            .celebration-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                pointer-events: none; z-index: 9999; overflow: hidden;
            }
            .kid-balloon {
                position: absolute;
                width: 50px; height: 65px;
                border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
                animation: floatUp var(--duration) ease-in forwards;
            }
            .kid-balloon::after {
                content: "🎈"; position: absolute; bottom: -12px; left: 50%;
                transform: translateX(-50%); font-size: 16px;
            }
            .clapping-hand { position: absolute; font-size: 70px; user-select: none; opacity: 0.9; }
        `;
        document.head.appendChild(style);
    },

    trigger() {
        this._injectStyles();
        const overlay = document.createElement('div');
        overlay.className = 'celebration-overlay';
        document.body.appendChild(overlay);

        for (let i = 0; i < this.BALLOON_COUNT; i++) {
            setTimeout(() => {
                const balloon = document.createElement('div');
                balloon.className = 'kid-balloon';
                const sizeWidth = Math.floor(Math.random() * 25) + 40; 
                balloon.style.width = `${sizeWidth}px`;
                balloon.style.height = `${sizeWidth * 1.3}px`;
                balloon.style.backgroundColor = this.BALLOON_COLORS[Math.floor(Math.random() * this.BALLOON_COLORS.length)];
                balloon.style.left = `${Math.random() * 90 + 5}%`;
                balloon.style.setProperty('--duration', `${Math.random() * 2 + 2.5}s`);
                balloon.style.setProperty('--drift', `${Math.random() * 120 - 60}px`);
                balloon.style.setProperty('--spin', `${Math.random() * 90 - 45}deg`);
                overlay.appendChild(balloon);
            }, i * 120);
        }

        for (let i = 0; i < this.HANDS_COUNT; i++) {
            const hand = document.createElement('div');
            hand.className = 'clapping-hand';
            hand.innerHTML = '👏';
            const isLeft = i % 2 === 0;
            hand.style.left = isLeft ? `${Math.random() * 15 + 5}%` : `${Math.random() * 15 + 80}%`;
            hand.style.top = `${Math.random() * 60 + 20}%`;
            hand.style.animation = `${isLeft ? 'clapLeft' : 'clapRight'} 0.4s ease-in-out infinite`;
            overlay.appendChild(hand);
        }

        setTimeout(() => {
            overlay.style.transition = 'opacity 0.5s ease';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 500);
        }, this.CELEBRATION_DURATION);
    }
};

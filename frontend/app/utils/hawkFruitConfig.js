
// Physics configuration
export const PHYSICS_CONFIG = {
	board: {
		width: 320,
		height: 400,
		thickness: 10,
	},

	engine: {
		gravity: {
			x: 0,
			y: 0.8,
			scale: 0.001
		},
		velocityIterations: 4,
		positionIterations: 4,
		enableSleeping: true,
		broadphase: {
			bucketWidth: 100,
			bucketHeight: 100
		},
		timing: {
			timeScale: 1,
			isFixed: true,
			delta: 16.666
		}
	},

	fruit: {
		restitution: 0.3,
		friction: 0.05,
		frictionAir: 0.005,
		density: 0.001,
		sleepThreshold: 60,

		collisionFilter: {
			group: 0,
			category: 0x0001,
			mask: 0xFFFF
		}
	},

	walls: {
		restitution: 0.3,
		friction: 0.8,
		frictionStatic: 1.0,
		color: '#333'
	},

	dropCooldown: 600,
	dropPosition: {
		x: 0.5,
		y: 0.1
	},

	sparkleDelay: 2000,

	// Pop Effect Configuration
	popEffect: {
		upwardForce: -1,
		horizontalVariation: 1.5,
		delay: 50,
		spawnOffset: 6
	},

	// Game Over
	gameOverHeight: 340,
	fruitsInDanger: 3,
	gameOverCheckInterval: 1000,

	stopPhysicsDelay: 200,
	showCompletionDelay: 1000,
}

// Fruit Configuration System
export const FRUIT_TYPES = {
	BLUEBERRY: {
		index: 1,
		type: 'BLUEBERRY',
		emoji: '🫐',
		radius: 20,
		nextType: 'STRAWBERRY',
		color: '#4c6ef5',
		scoreValue: 10,
    cost: {
      diamonds: 1
    },
		sparkleColor: '#9C27B0',
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="blueberryGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#BA68C8"/>
            <stop offset="100%" style="stop-color:#9C27B0"/>
        </radialGradient>
        <radialGradient id="mouthGrad" cx="0.5" cy="0.3">
            <stop offset="0%" style="stop-color:#2E2E2E"/>
            <stop offset="100%" style="stop-color:#000000"/>
        </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#blueberryGrad)" stroke="#6A1B9A" stroke-width="2"/>
    <circle cx="20" cy="20" r="1.5" fill="#7B1FA2" opacity="0.6"/>
    <circle cx="44" cy="18" r="1.5" fill="#7B1FA2" opacity="0.6"/>
    <circle cx="18" cy="40" r="1.5" fill="#7B1FA2" opacity="0.6"/>
    <circle cx="46" cy="42" r="1.5" fill="#7B1FA2" opacity="0.6"/>
    <circle cx="32" cy="48" r="1.5" fill="#7B1FA2" opacity="0.6"/>
    <g id="openEyes">
        <ellipse cx="24" cy="26" rx="6" ry="6" fill="white"/>
        <ellipse cx="40" cy="26" rx="6" ry="6" fill="white"/>
        <circle cx="24" cy="26" r="2.5" fill="black"/>
        <circle cx="40" cy="26" r="2.5" fill="black"/>
        <circle cx="25" cy="25" r="1" fill="white"/>
        <circle cx="41" cy="25" r="1" fill="white"/>
        <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="10s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="closedEyes">
        <ellipse cx="24" cy="26" rx="7" ry="7" fill="white"/>
        <ellipse cx="40" cy="26" rx="7" ry="7" fill="white"/>
        <circle cx="24" cy="26" r="2.5" fill="black"/>
        <circle cx="40" cy="26" r="2.5" fill="black"/>
        <circle cx="25" cy="25" r="1" fill="white"/>
        <circle cx="41" cy="25" r="1" fill="white"/>
        <ellipse cx="32" cy="42" rx="10" ry="8" fill="url(#mouthGrad)" stroke="#000" stroke-width="1.5"/>
        <ellipse cx="32" cy="45" rx="6" ry="4" fill="#FF6B9D" opacity="0.8"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="10s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <ellipse cx="16" cy="32" rx="3" ry="2" fill="#8E24AA" opacity="0.4"/>
    <ellipse cx="48" cy="32" rx="3" ry="2" fill="#8E24AA" opacity="0.4"/>
</svg>`
	},
	STRAWBERRY: {
		index: 2,
		type: 'STRAWBERRY',
		emoji: '🍓',
		radius: 24,
		nextType: 'LEMON',
		color: '#ff8787',
		scoreValue: 25,
    cost: {
      diamonds: 1
    },
		sparkleColor: '#E91E63',
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="strawberryGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#F06292"/>
            <stop offset="100%" style="stop-color:#E91E63"/>
        </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#strawberryGrad)" stroke="#C2185B" stroke-width="2"/>
    <circle cx="22" cy="22" r="1" fill="#FFEB3B" opacity="0.8"/>
    <circle cx="40" cy="20" r="1" fill="#FFEB3B" opacity="0.8"/>
    <circle cx="20" cy="38" r="1" fill="#FFEB3B" opacity="0.8"/>
    <circle cx="44" cy="40" r="1" fill="#FFEB3B" opacity="0.8"/>
    <circle cx="32" cy="46" r="1" fill="#FFEB3B" opacity="0.8"/>
    <circle cx="28" cy="16" r="1" fill="#FFEB3B" opacity="0.8"/>
    <circle cx="36" cy="48" r="1" fill="#FFEB3B" opacity="0.8"/>
    <g id="openEyes">
        <ellipse cx="24" cy="26" rx="6" ry="6" fill="white"/>
        <ellipse cx="40" cy="26" rx="6" ry="6" fill="white"/>
        <circle cx="24" cy="26" r="2.5" fill="black"/>
        <circle cx="40" cy="26" r="2.5" fill="black"/>
        <circle cx="25" cy="25" r="1" fill="white"/>
        <circle cx="41" cy="25" r="1" fill="white"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="10s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="closedEyes">
        <ellipse cx="24" cy="26" rx="9" ry="9" fill="white" stroke="#ddd" stroke-width="1"/>
        <ellipse cx="40" cy="26" rx="9" ry="9" fill="white" stroke="#ddd" stroke-width="1"/>
        <circle cx="24" cy="26" r="3" fill="black"/>
        <circle cx="40" cy="26" r="3" fill="black"/>
        <circle cx="25.5" cy="24.5" r="1.5" fill="white"/>
        <circle cx="41.5" cy="24.5" r="1.5" fill="white"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="10s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="16" cy="32" rx="3" ry="2" fill="#F8BBD9" opacity="0.6"/>
    <ellipse cx="48" cy="32" rx="3" ry="2" fill="#F8BBD9" opacity="0.6"/>
    <path d="M30,8 L34,8 L36,12 L28,12 Z" fill="#4CAF50"/>
</svg>`
	},
	LEMON: {
		index: 3,
		type: 'LEMON',
		emoji: '🍋',
		radius: 28,
		nextType: 'ORANGE',
		color: '#fdd835',
		scoreValue: 50,
    cost: {
      diamonds: 2
    },
		sparkleColor: '#FFEB3B',
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="lemonGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#FFF176"/>
            <stop offset="100%" style="stop-color:#FFEB3B"/>
        </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#lemonGrad)" stroke="#F57F17" stroke-width="2"/>
    <ellipse cx="22" cy="20" rx="2" ry="1" fill="#F9A825" opacity="0.5"/>
    <ellipse cx="42" cy="18" rx="2" ry="1" fill="#F9A825" opacity="0.5"/>
    <ellipse cx="18" cy="40" rx="2" ry="1" fill="#F9A825" opacity="0.5"/>
    <ellipse cx="46" cy="42" rx="2" ry="1" fill="#F9A825" opacity="0.5"/>
    <ellipse cx="32" cy="48" rx="2" ry="1" fill="#F9A825" opacity="0.5"/>
    <g id="openEyes">
        <ellipse cx="24" cy="26" rx="4" ry="5" fill="white"/>
        <ellipse cx="40" cy="26" rx="4" ry="5" fill="white"/>
        <circle cx="24" cy="26" r="2.5" fill="black"/>
        <circle cx="40" cy="26" r="2.5" fill="black"/>
        <circle cx="25" cy="25" r="1" fill="white"/>
        <circle cx="41" cy="25" r="1" fill="white"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="3s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="closedEyes">
        <line x1="20" y1="26" x2="28" y2="26" stroke="black" stroke-width="2" stroke-linecap="round"/>
        <line x1="36" y1="26" x2="44" y2="26" stroke="black" stroke-width="2" stroke-linecap="round"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="3s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="16" cy="32" rx="3" ry="2" fill="#FFC107" opacity="0.4"/>
    <ellipse cx="48" cy="32" rx="3" ry="2" fill="#FFC107" opacity="0.4"/>
</svg>`
	},
	ORANGE: {
		index: 4,
		type: 'ORANGE',
		emoji: '🍊',
		radius: 34,
		nextType: 'APPLE',
		color: '#ffa726',
		scoreValue: 100,
    cost: {
      diamonds: 2
    },
		sparkleColor: '#FF9800',
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="orangeGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#FFB74D"/>
            <stop offset="100%" style="stop-color:#FF9800"/>
        </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#orangeGrad)" stroke="#E65100" stroke-width="2"/>
    <circle cx="20" cy="20" r="1.5" fill="#FF7043" opacity="0.6"/>
    <circle cx="44" cy="18" r="1.5" fill="#FF7043" opacity="0.6"/>
    <circle cx="18" cy="40" r="1.5" fill="#FF7043" opacity="0.6"/>
    <circle cx="46" cy="42" r="1.5" fill="#FF7043" opacity="0.6"/>
    <circle cx="32" cy="48" r="1.5" fill="#FF7043" opacity="0.6"/>
    <g id="openEyes">
        <ellipse cx="24" cy="26" rx="5" ry="5" fill="white"/>
        <ellipse cx="40" cy="26" rx="5" ry="5" fill="white"/>
        <circle cx="24" cy="26" r="2.5" fill="black"/>
        <circle cx="40" cy="26" r="2.5" fill="black"/>
        <circle cx="25" cy="25" r="1" fill="white"/>
        <circle cx="41" cy="25" r="1" fill="white"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="6s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="closedEyes">
        <ellipse cx="24" cy="26" rx="4" ry="5" fill="white"/>
        <circle cx="24" cy="26" r="2.5" fill="black"/>
        <circle cx="25" cy="25" r="1" fill="white"/>
        <line x1="36" y1="26" x2="44" y2="26" stroke="black" stroke-width="2" stroke-linecap="round"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="6s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="16" cy="32" rx="3" ry="2" fill="#FF5722" opacity="0.4"/>
    <ellipse cx="48" cy="32" rx="3" ry="2" fill="#FF5722" opacity="0.4"/>
</svg>`
	},
	APPLE: {
		index: 5,
		type: 'APPLE',
		emoji: '🍎',
		radius: 40,
		nextType: 'GRAPEFRUIT',
		color: '#e53e3e',
		scoreValue: 200,
    cost: {
      diamonds: 2
    },
		sparkleColor: '#36c904',
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="appleGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color: #5fe865"/>
            <stop offset="100%" style="stop-color: #36c904"/>
        </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#appleGrad)" stroke="#4b9916" stroke-width="2"/>
    <circle cx="20" cy="20" r="1.5" fill="#689F38" opacity="0.6"/>
    <circle cx="44" cy="18" r="1.5" fill="#689F38" opacity="0.6"/>
    <circle cx="18" cy="40" r="1.5" fill="#689F38" opacity="0.6"/>
    <circle cx="46" cy="42" r="1.5" fill="#689F38" opacity="0.6"/>
    <circle cx="32" cy="48" r="1.5" fill="#689F38" opacity="0.6"/>
    <g id="openEyes">
        <ellipse cx="24" cy="26" rx="7" ry="7" fill="white"/>
        <ellipse cx="40" cy="26" rx="6" ry="6" fill="white"/>
        <circle cx="24" cy="26" r="2.5" fill="black"/>
        <circle cx="40" cy="26" r="2.5" fill="black"/>
        <circle cx="25" cy="25" r="1" fill="white"/>
        <circle cx="41" cy="25" r="1" fill="white"/>
        <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="16" cy="32" rx="3" ry="2" fill="#C8E6C9" opacity="0.6"/>
        <ellipse cx="48" cy="32" rx="3" ry="2" fill="#C8E6C9" opacity="0.6"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="10s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="closedEyes">
        <line x1="20" y1="25" x2="28" y2="26" stroke="black" stroke-width="2" stroke-linecap="round"/>
        <line x1="36" y1="26" x2="44" y2="25" stroke="black" stroke-width="2" stroke-linecap="round"/>
        <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="14" cy="32" rx="9" ry="8" fill="#FF0000" opacity="0.4"/>
        <ellipse cx="50" cy="32" rx="9" ry="8" fill="#FF0000" opacity="0.4"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="10s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <ellipse cx="30" cy="8" rx="4" ry="2" fill="#795548"/>
    <ellipse cx="34" cy="6" rx="2" ry="3" fill="#4CAF50"/>
</svg>`
	},
	GRAPEFRUIT: {
		index: 6,
		type: 'GRAPEFRUIT',
		emoji: '🍑',
		radius: 44,
		nextType: 'PINEAPPLE',
		color: '#ff7043',
		scoreValue: 400,
    cost: {
      diamonds: 3
    },
		sparkleColor: '#FFAB91',
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="grapeGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#FFCC80"/>
            <stop offset="100%" style="stop-color:#FFAB91"/>
        </radialGradient>
        <linearGradient id="linear_12" x1="22" y1="15" x2="22" y2="31" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FFD600"/>
            <stop offset="1" stop-color="#FFFD91"/>
        </linearGradient>
    </defs>

    <!-- Face -->
    <circle cx="32" cy="32" r="30" fill="url(#grapeGrad)" stroke="#FF8A65" stroke-width="2"/>

    <!-- Face texture lines -->
    <path d="M28,8 Q32,12 36,8" stroke="#FF7043" stroke-width="2" fill="none" opacity="0.6"/>
    <path d="M24,16 Q32,20 40,16" stroke="#FF7043" stroke-width="1.5" fill="none" opacity="0.5"/>
    <path d="M20,28 Q32,32 44,28" stroke="#FF7043" stroke-width="1.5" fill="none" opacity="0.4"/>
    <path d="M22,44 Q32,40 42,44" stroke="#FF7043" stroke-width="1.5" fill="none" opacity="0.4"/>

    <!-- Small decorative circles -->
    <circle cx="20" cy="20" r="1.5" fill="#FF8A65" opacity="0.6"/>
    <circle cx="44" cy="18" r="1.5" fill="#FF8A65" opacity="0.6"/>
    <circle cx="18" cy="40" r="1.5" fill="#FF8A65" opacity="0.6"/>
    <circle cx="46" cy="42" r="1.5" fill="#FF8A65" opacity="0.6"/>
    <circle cx="32" cy="48" r="1.5" fill="#FF8A65" opacity="0.6"/>

    <g id="openEyes">
        <ellipse cx="21" cy="23" rx="8" ry="8" fill="white"/>
        <ellipse cx="42" cy="23" rx="8" ry="8" fill="white"/>
        <circle cx="21" cy="23" r="3" fill="black"/>
        <circle cx="42" cy="23" r="3" fill="black"/>
        <circle cx="22" cy="22" r="1.2" fill="white"/>
        <circle cx="43" cy="22" r="1.2" fill="white"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="10s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="closedEyes">
        <path d="M22 15L24 21H30L25 25L27 31L22 27L17 31L19 25L14 21H20L22 15Z" stroke-width="1.2" fill="url(#linear_12)" stroke="#FF8A65"/>
        <path d="M42 15L44 21H50L45 25L47 31L42 27L37 31L39 25L34 21H40L42 15Z" stroke-width="1.2" fill="url(#linear_12)" stroke="#FF8A65"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="10s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`
	},
	PINEAPPLE: {
		index: 7,
		type: 'PINEAPPLE',
		emoji: '🍍',
		radius: 58,
		nextType: 'COCONUT',
		color: '#d69e2e',
		scoreValue: 800,
		sparkleColor: '#FDD835',
		svg: `
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#clip0_64_2)">
        <path d="M32 62C48.5685 62 62 48.5685 62 32C62 15.4315 48.5685 2 32 2C15.4315 2 2 15.4315 2 32C2 48.5685 15.4315 62 32 62Z" fill="url(#paint0_radial_64_2)" stroke="#E65100" stroke-width="2"/>
        <path d="M28 34C32.4183 34 36 28.6274 36 22C36 15.3726 32.4183 10 28 10C23.5817 10 20 15.3726 20 22C20 28.6274 23.5817 34 28 34Z" fill="url(#paint1_radial_64_2)"/>
        <g opacity="0.8">
            <path d="M12 24C25.3333 21.3333 38.6667 21.3333 52 24" stroke="#F57C00" stroke-width="2"/>
            <path d="M10 32C24.6667 29.3333 39.3333 29.3333 54 32" stroke="#F57C00" stroke-width="2"/>
            <path d="M12 40C25.3333 37.3333 38.6667 37.3333 52 40" stroke="#F57C00" stroke-width="2"/>
            <path d="M14 48C26 45.3333 38 45.3333 50 48" stroke="#F57C00" stroke-width="2"/>
            <path d="M18 20L22 24L26 20L30 24L34 20L38 24L42 20L46 24" stroke="#F57C00" stroke-width="2"/>
            <path d="M16 28L20 32L24 28L28 32L32 28L36 32L40 28L44 32L48 28" stroke="#F57C00" stroke-width="2"/>
            <path d="M18 36L22 40L26 36L30 40L34 36L38 40L42 36L46 40" stroke="#F57C00" stroke-width="2"/>
            <path d="M20 44L24 48L28 44L32 48L36 44L40 48L44 44" stroke="#F57C00" stroke-width="2"/>
        </g>
        <g opacity="0.6">
            <path d="M24 22L26 20L28 22L26 24L24 22Z" fill="#FFEE58"/>
            <path d="M36 22L38 20L40 22L38 24L36 22Z" fill="#FFEE58"/>
            <path d="M18 30L20 28L22 30L20 32L18 30Z" fill="#FFEE58"/>
            <path d="M30 30L32 28L34 30L32 32L30 30Z" fill="#FFEE58"/>
            <path d="M42 30L44 28L46 30L44 32L42 30Z" fill="#FFEE58"/>
            <path d="M24 38L26 36L28 38L26 40L24 38Z" fill="#FFEE58"/>
            <path d="M36 38L38 36L40 38L38 40L36 38Z" fill="#FFEE58"/>
            <path d="M30 46L32 44L34 46L32 48L30 46Z" fill="#FFEE58"/>
        </g>


        <g id="openEyes">
            <ellipse cx="25" cy="18" rx="5" ry="5" fill="white"/>
            <ellipse cx="38" cy="18" rx="5" ry="5" fill="white"/>
            <circle cx="25" cy="18" r="2.5" fill="black"/>
            <circle cx="38" cy="18" r="2.5" fill="black"/>
            <circle cx="26" cy="17" r="1" fill="white"/>
            <circle cx="39" cy="17" r="1" fill="white"/>
            <path d="M26 27C30 31 34 31 38 27" stroke="black" stroke-width="2.5" stroke-linecap="round"/><animate
                    attributeName="opacity"
                    values="1; 1; 0; 0"
                    dur="20s"
                    repeatCount="indefinite"
                    calcMode="discrete"/>
        </g>
        <g id="closedEyes">
            <ellipse cx="25" cy="21" rx="5" ry="5" fill="white"/>
            <ellipse cx="38" cy="21" rx="5" ry="5" fill="white"/>
            <circle cx="25" cy="21" r="2.5" fill="black"/>
            <circle cx="38" cy="21" r="2.5" fill="black"/>
            <circle cx="26" cy="20" r="1" fill="white"/>
            <circle cx="39" cy="20" r="1" fill="white"/>
            <path d="M26 30C30 34 34 34 38 30" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
            <animate
                    attributeName="opacity"
                    values="0; 0; 1; 1"
                    dur="20s"
                    repeatCount="indefinite"
                    calcMode="discrete"/>
        </g>
        <g opacity="0.9">
            <path d="M29 5L25.25 12L23.5 6L21.0833 10.25L19 5H29Z" fill="#66BB6A" stroke="#4CAF50" stroke-width="4"/>
            <path d="M28 11L30.2857 5L32 12.5L33.7143 6.2L36 14L28 11Z" fill="#66BB6A" stroke="#4CAF50" stroke-width="4"/>
            <path d="M33 9.625L40 4V11.8125L47 6.5V14L33 9.625Z" fill="#66BB6A" stroke="#4CAF50" stroke-width="4"/>
        </g>
        <g opacity="0.6">
            <path d="M15.4142 18.5858V21.4142H12.5858V18.5858H15.4142Z" fill="#FFD700"/>
            <path d="M51.4142 20.5858V23.4142H48.5858V20.5858H51.4142Z" fill="#FFD700"/>
        </g>
    </g>
    <defs>
        <radialGradient id="paint0_radial_64_2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(20 20) scale(30)">
            <stop stop-color="#FFF9C4"/>
            <stop offset="0.461538" stop-color="#FFF176"/>
            <stop offset="0.625" stop-color="#FFEB3B"/>
            <stop offset="1" stop-color="#FF962A"/>
        </radialGradient>
        <radialGradient id="paint1_radial_64_2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(26.4 14.8) scale(8 12)">
            <stop stop-color="#FFFDE7" stop-opacity="0.8"/>
            <stop offset="1" stop-color="#FFFDE7" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="clip0_64_2">
            <rect width="64" height="64" fill="white"/>
        </clipPath>
    </defs>
</svg>
`
	},
	COCONUT: {
		index: 8,
		type: 'COCONUT',
		emoji: '🥥',
		radius: 68,
		nextType: 'MELON',
		color: '#8b4513',
		scoreValue: 3200,
		sparkleColor: '#8D6E63',
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="coconutGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#D7CCC8"/>
            <stop offset="30%" style="stop-color:#A1887F"/>
            <stop offset="70%" style="stop-color:#8D6E63"/>
            <stop offset="100%" style="stop-color:#6D4C41"/>
        </radialGradient>
    </defs>

    <circle cx="32" cy="32" r="30" fill="url(#coconutGrad)" stroke="#5D4037" stroke-width="2"/>

    <path d="M12,20 Q16,32 12,44" stroke="#6D4C41" stroke-width="1.5" fill="none" opacity="0.4"/>
    <path d="M52,20 Q48,32 52,44" stroke="#6D4C41" stroke-width="1.5" fill="none" opacity="0.4"/>

    <g id="openEyes">
        <ellipse cx="24" cy="26" rx="6" ry="6" fill="white"/>
        <ellipse cx="40" cy="26" rx="6" ry="6" fill="white"/>
        <circle cx="24" cy="26" r="3" fill="black"/>
        <circle cx="40" cy="26" r="3" fill="black"/>
        <circle cx="25" cy="25" r="1.2" fill="white"/>
        <circle cx="41" cy="25" r="1.2" fill="white"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="5s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="closedEyes">
        <path d="M18,26 Q24,23 30,26" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M34,26 Q40,23 46,26" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="5s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="happyMouth">
        <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="8s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="neutralMouth">
        <ellipse cx="32" cy="40" rx="6" ry="4" fill="#000" stroke="black" stroke-width="2" opacity="0.8"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="8s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <ellipse cx="12" cy="32" rx="5" ry="4" fill="#D7CCC8" opacity="0.4"/>
    <ellipse cx="52" cy="32" rx="5" ry="4" fill="#D7CCC8" opacity="0.4"/>
    <circle cx="28" cy="10" r="2.5" fill="#3E2723" opacity="0.7"/>
    <circle cx="36" cy="10" r="2.5" fill="#3E2723" opacity="0.7"/>
    <circle cx="32" cy="15" r="2.5" fill="#3E2723" opacity="0.7"/>
</svg>`
	},
  MELON: {
    index: 9,
    type: 'MELON',
    emoji: '🍈',
    radius: 78,
    nextType: 'DRAGON_FRUIT',
    color: '#F0FF00',
    scoreValue: 1600,
    sparkleColor: '#F4FF81',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="honeydewGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#F0FF00"/>
            <stop offset="30%" style="stop-color:#E6FFE6"/>
            <stop offset="70%" style="stop-color:#F8FB98"/>
            <stop offset="100%" style="stop-color:#F28B22"/>
        </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#honeydewGrad)" stroke="#f0e400" stroke-width="2"/>
    <circle cx="32" cy="32" r="27" fill="#F5FFFA" opacity="0.6"/>
    <circle cx="32" cy="32" r="25" fill="#E0FFE0" opacity="0.4"/>
    <ellipse cx="16" cy="32" rx="4" ry="3" fill="#FFB6C1" opacity="0.5"/>
    <ellipse cx="48" cy="32" rx="4" ry="3" fill="#FFB6C1" opacity="0.5"/>
    <g fill="#E2B07A" opacity="0.8">
        <circle cx="28" cy="39" r="1"/>
        <circle cx="32" cy="34" r="1"/>
        <circle cx="36" cy="36" r="1"/>
        <circle cx="42" cy="38" r="1"/>
        <circle cx="34" cy="39" r="1"/>
        <circle cx="32" cy="38" r="1"/>
        <circle cx="20" cy="38" r="1"/>
        <circle cx="45" cy="39" r="1"/>
    </g>
    <g id="openEyes">
        <ellipse cx="24" cy="26" rx="9" ry="9" fill="#FFDDEE"/>
        <ellipse cx="40" cy="26" rx="9" ry="9" fill="#FFDDEE"/>
        <ellipse cx="24" cy="26" rx="8" ry="8" fill="white"/>
        <ellipse cx="40" cy="26" rx="8" ry="8" fill="white"/>
        <circle cx="24" cy="26" r="2.5" fill="black"/>
        <circle cx="40" cy="26" r="2.5" fill="black"/>
        <circle cx="25" cy="25" r="1" fill="white"/>
        <circle cx="41" cy="25" r="1" fill="white"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="8s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="closedEyes">
        <line x1="18" y1="26" x2="30" y2="25" stroke="#000" stroke-width="2" stroke-linecap="round"/>
        <line x1="34" y1="25" x2="46" y2="26" stroke="#000" stroke-width="2" stroke-linecap="round"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="8s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <path d="M26,44 Q32,50 38,44" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`
  },
	DRAGON_FRUIT: {
		index: 10,
		type: 'DRAGON_FRUIT',
		emoji: '🐉',
		radius: 88,
    nextType: 'WATERMELON',
		color: '#e91e63',
		scoreValue: 3200,
		sparkleColor: '#f8bbd9',
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="dragonGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#FFFFFF"/>
            <stop offset="40%" style="stop-color:#FFF0F5"/>
            <stop offset="70%" style="stop-color:#FFE4E1"/>
            <stop offset="100%" style="stop-color:#F8BBD0"/>
        </radialGradient>
    </defs>

    <ellipse cx="32" cy="32" rx="30" ry="30" fill="url(#dragonGrad)" stroke="#880E4F" stroke-width="2"/>
    <g fill="black" opacity="0.6">
        <circle cx="20" cy="12" r="1"/>
        <circle cx="30" cy="12" r="0.8"/>
        <circle cx="40" cy="8" r="0.8"/>
        <circle cx="34" cy="14" r="1"/>
        <circle cx="44" cy="13" r="1"/>
        <circle cx="11" cy="32" r="1"/>
        <circle cx="28" cy="7" r="1"/>
        <circle cx="11" cy="20" r="0.8"/>
        <circle cx="48" cy="39" r="1"/>
        <circle cx="20" cy="44" r="1"/>
        <circle cx="34" cy="56" r="1"/>
        <circle cx="44" cy="44" r="1"/>
        <circle cx="54" cy="26" r="1"/>
        <circle cx="53" cy="46" r="1.1"/>
        <circle cx="13" cy="48" r="1.1"/>
        <circle cx="30" cy="51" r="0.7"/>
        <circle cx="39" cy="50" r="0.7"/>
    </g>
    <g id="openEyes">
        <ellipse cx="24" cy="26" rx="8" ry="8" fill="#F8BBD0"/>
        <ellipse cx="40" cy="26" rx="8" ry="8" fill="#F8BBD0"/>
        <ellipse cx="24" cy="26" rx="7" ry="7" fill="white"/>
        <ellipse cx="40" cy="26" rx="7" ry="7" fill="white"/>
        <circle cx="24" cy="26" r="2.5" fill="black"/>
        <circle cx="40" cy="26" r="2.5" fill="black"/>
        <circle cx="25" cy="25" r="1" fill="white"/>
        <circle cx="41" cy="25" r="1" fill="white"/>
        <animate
                attributeName="opacity"
                values="1; 1; 0; 1; 1"
                dur="6s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <g id="closedEyes">
        <ellipse cx="24" cy="26" rx="8" ry="3" fill="#4A4A4A"/>
        <ellipse cx="40" cy="26" rx="8" ry="3" fill="#4A4A4A"/>
        <path d="M17,26 Q24,22 31,26" stroke="black" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M33,26 Q40,22 47,26" stroke="black" stroke-width="3" fill="none" stroke-linecap="round"/>
        <animate
                attributeName="opacity"
                values="0; 0; 1; 0; 0"
                dur="6s"
                repeatCount="indefinite"
                calcMode="discrete"/>
    </g>
    <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`
	},
  WATERMELON: {
    index: 11,
    type: 'WATERMELON',
    emoji: '🍉',
    radius: 100,
    nextType: 'PUMPKIN',
    color: '#228B22',
    scoreValue: 6400,
    sparkleColor: '#FF6B6B',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="watermelonGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#F8BBD0"/>
            <stop offset="100%" style="stop-color:#F48FB1"/>
        </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#watermelonGrad)" stroke="#008e00" stroke-width="2"/>
    <circle cx="32" cy="32" r="26" fill="#F06292" opacity="0.8"/>
    <circle cx="22" cy="22" r="2" fill="#1B5E20" opacity="0.9"/>
    <circle cx="42" cy="20" r="2" fill="#1B5E20" opacity="0.9"/>
    <circle cx="20" cy="42" r="2" fill="#1B5E20" opacity="0.9"/>
    <circle cx="44" cy="44" r="2" fill="#1B5E20" opacity="0.9"/>
    <circle cx="32" cy="18" r="1.5" fill="#1B5E20" opacity="0.9"/>
    <circle cx="18" cy="32" r="1.5" fill="#1B5E20" opacity="0.9"/>
    <circle cx="46" cy="32" r="1.5" fill="#1B5E20" opacity="0.9"/>
    <circle cx="32" cy="46" r="1.5" fill="#1B5E20" opacity="0.9"/>
    <circle cx="28" cy="36" r="1" fill="#1B5E20" opacity="0.8"/>
    <circle cx="36" cy="28" r="1" fill="#1B5E20" opacity="0.8"/>
    <ellipse cx="24" cy="26" rx="5" ry="5" fill="white"/>
    <ellipse cx="40" cy="26" rx="5" ry="5" fill="white"/>
    <circle cx="24" cy="26" r="2.5" fill="black"/>
    <circle cx="40" cy="26" r="2.5" fill="black"/>
    <circle cx="25" cy="25" r="1" fill="white"/>
    <circle cx="41" cy="25" r="1" fill="white"/>
    <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="12" cy="32" rx="3" ry="2" fill="#F8BBD0" opacity="0.6"/>
    <ellipse cx="52" cy="32" rx="3" ry="2" fill="#F8BBD0" opacity="0.6"/>
    <ellipse cx="48" cy="20" rx="2" ry="5" fill="#2196F3" opacity="0.8">
        <animate attributeName="cy" from="18" to="28" dur="12s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;0.8;0" keyTimes="0;0.7;1" dur="12s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="18" cy="18" rx="2" ry="5" fill="#2196F3" opacity="0.8">
        <animate attributeName="cy" from="18" to="28" dur="9s" begin="9s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;0.8;0" keyTimes="0;0.7;1" dur="9s" repeatCount="indefinite"/>
    </ellipse>
</svg>`
  },
	PUMPKIN: {
		index: 12,
		type: 'PUMPKIN',
		emoji: '🎃',
		radius: 115,
		nextType: null,
		color: '#ff8c00',
		scoreValue: 3200,
		sparkleColor: '#ffcc02',
		svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="pumpkinGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#FFB74D"/>
            <stop offset="100%" style="stop-color:#FF8C00"/>
        </radialGradient>
        <radialGradient id="stemGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#8BC34A"/>
            <stop offset="100%" style="stop-color:#4CAF50"/>
        </radialGradient>
    </defs>

    <!-- Pumpkin body with segments -->
    <circle cx="32" cy="32" r="30" fill="url(#pumpkinGrad)" stroke="#E65100" stroke-width="2"/>

    <!-- Pumpkin segments (vertical lines) -->
    <path d="M32,2 Q28,32 32,62" stroke="#E65100" stroke-width="1.5" fill="none" opacity="0.4"/>
    <path d="M20,8 Q18,32 20,56" stroke="#E65100" stroke-width="1.5" fill="none" opacity="0.4"/>
    <path d="M44,8 Q46,32 44,56" stroke="#E65100" stroke-width="1.5" fill="none" opacity="0.4"/>
    <path d="M12,18 Q10,32 12,46" stroke="#E65100" stroke-width="1.5" fill="none" opacity="0.4"/>
    <path d="M52,18 Q54,32 52,46" stroke="#E65100" stroke-width="1.5" fill="none" opacity="0.4"/>

    <!-- Pumpkin stem -->
    <rect x="30" y="2" width="4" height="8" rx="2" fill="url(#stemGrad)"/>
    <ellipse cx="32" cy="6" rx="3" ry="1.5" fill="#689F38"/>

    <!-- Pumpkin leaf -->
    <path d="M28,4 Q24,2 26,8 Q28,6 28,4" fill="#4CAF50" opacity="0.8"/>

    <!-- Linkes Auge -->
    <polygon points="20,22 28,22 24,30" fill="#2E1065"/>

    <!-- Rechtes Auge -->
    <polygon points="36,22 44,22 40,30" fill="#2E1065"/>

    <ellipse cx="24" cy="25" rx="2.2" ry="2" fill="red" opacity="0.8">
        <animate attributeName="fill" values="#FF0000;#2E1065;#FF0000" dur="9s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;1;0.8" dur="10s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="40" cy="25" rx="2.2" ry="2" fill="red" opacity="0.8">
        <animate attributeName="fill" values="#FF0000;#2E1065;#FF0000" dur="8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;1;0.8" dur="8s" repeatCount="indefinite"/>
    </ellipse>
    
    <!-- Nose -->
    <polygon points="30,32 34,32 32,38" fill="#2E1065"/>

    <!-- Mouth -->
    <path d="M20,42 L22,40 L26,42 L30,40 L34,42 L38,40 L42,42 L44,44 L42,46 L38,44 L34,46 L30,44 L26,46 L22,44 Z"
          fill="#2E1065"/>

    <!-- Teeth -->
    <rect x="25" y="43" width="2" height="3" fill="#FF8C00"/>
    <rect x="33" y="43" width="2" height="3" fill="#FF8C00"/>
    <rect x="37" y="40" width="2" height="2" fill="#FF8C00"/>

    <polyline points="8,26 10,30 12,28 14,32 16,30 18,34" stroke="#B71C1C" stroke-width="1.2" fill="none" opacity="0.8"/>
    <polyline points="56,26 54,30 52,28 50,32 48,30 46,34" stroke="#B71C1C" stroke-width="1.2" fill="none" opacity="0.8"/>

</svg>`
	},
  RAINBOW_FRUIT: {
    index: 97,
    type: 'RAINBOW_FRUIT',
    emoji: '🌈',
    radius: 32,
    nextType: null, // Can merge with any fruit
    color: 'rainbow',
    scoreValue: 0, // Bonus based on merge
    cost: {
      diamonds: 20
    },
    sparkleColor: '#FFD700',
    isRainbow: true, // Special property
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="rainbowGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#FF6B6B"/>
            <stop offset="16.66%" style="stop-color:#FF8E8E"/>
            <stop offset="33.33%" style="stop-color:#FFD93D"/>
            <stop offset="50%" style="stop-color:#6BCF7F"/>
            <stop offset="66.66%" style="stop-color:#4ECDC4"/>
            <stop offset="83.33%" style="stop-color:#45B7D1"/>
            <stop offset="100%" style="stop-color:#96CEB4"/>
        </radialGradient>
        <radialGradient id="rainbowShimmer" cx="0.5" cy="0.3">
            <stop offset="0%" style="stop-color:#FFFFFF" stop-opacity="0.8"/>
            <stop offset="50%" style="stop-color:#FFD700" stop-opacity="0.6"/>
            <stop offset="100%" style="stop-color:#FFFFFF" stop-opacity="0.3"/>
        </radialGradient>
    </defs>

    <!-- Rainbow body -->
    <circle cx="32" cy="32" r="30" fill="url(#rainbowGrad)" stroke="#FFD700" stroke-width="2"/>
    
    <!-- Shimmer effect -->
    <circle cx="32" cy="32" r="26" fill="url(#rainbowShimmer)" opacity="0.7">
        <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="rotate" values="0 32 32;360 32 32" dur="4s" repeatCount="indefinite"/>
    </circle>

    <!-- Rainbow sparkles -->
    <g fill="#FFD700" opacity="0.8">
        <polygon points="16,16 18,18 16,20 14,18" transform="rotate(45 16 18)">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" begin="0s"/>
        </polygon>
        <polygon points="48,16 50,18 48,20 46,18" transform="rotate(45 48 18)">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" begin="0.5s"/>
        </polygon>
        <polygon points="16,48 18,50 16,52 14,50" transform="rotate(45 16 50)">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" begin="1s"/>
        </polygon>
        <polygon points="48,48 50,50 48,52 46,50" transform="rotate(45 48 50)">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" begin="1.5s"/>
        </polygon>
    </g>

    <!-- Eyes -->
    <ellipse cx="24" cy="26" rx="6" ry="6" fill="white"/>
    <ellipse cx="40" cy="26" rx="6" ry="6" fill="white"/>
    <circle cx="24" cy="26" r="3" fill="black"/>
    <circle cx="40" cy="26" r="3" fill="black"/>
    <circle cx="25.5" cy="24.5" r="1.5" fill="white"/>
    <circle cx="41.5" cy="24.5" r="1.5" fill="white"/>

    <!-- Happy mouth -->
    <path d="M26,38 Q32,44 38,38" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>

    <!-- Magic aura -->
    <circle cx="32" cy="32" r="30" fill="none" stroke="#FFD700" stroke-width="1" opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" values="1;3;1" dur="3s" repeatCount="indefinite"/>
    </circle>
</svg>`
  },
  BOMB_FRUIT: {
    index: 98,
    type: 'BOMB_FRUIT',
    emoji: '💣',
    radius: 30,
    nextType: null, // Explodes instead of merging
    color: '#FF4444',
    scoreValue: 0, // Bonus based on explosion
    cost: {
      diamonds: 10
    },
    sparkleColor: '#FF6B6B',
    isBomb: true, // Special property
    explosionRadius: 80, // 3x3 area roughly
    fuseTime: 10000, // 10 seconds fuse time
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="bombGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#666666"/>
            <stop offset="50%" style="stop-color:#333333"/>
            <stop offset="100%" style="stop-color:#111111"/>
        </radialGradient>
        <radialGradient id="fuseGrad" cx="0.5" cy="0.3">
            <stop offset="0%" style="stop-color:#FFA500"/>
            <stop offset="100%" style="stop-color:#FF4500"/>
        </radialGradient>
    </defs>

    <!-- Bomb body -->
    <circle cx="32" cy="32" r="30" fill="url(#bombGrad)" stroke="#000000" stroke-width="2"/>

    <g fill="white" stroke="black" stroke-width="1.5">
        <circle cx="24" cy="30" r="5"/>
        <circle cx="40" cy="29" r="6"/>
    </g>
    <circle cx="24" cy="30" r="2" fill="black"/>
    <circle cx="40" cy="30" r="3" fill="black"/>
    <circle cx="32" cy="32" r="30" fill="none" stroke="#FF0000" stroke-width="2" opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1s" repeatCount="indefinite"/>
    </circle>
    <path d="M32 15 Q30 8 26 6" stroke="url(#fuseGrad)" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="24" cy="5" r="3" fill="#FFD700" opacity="0.9">
        <animate attributeName="r" values="2;5;2" dur="0.7s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.7;1;0.7" dur="0.7s" repeatCount="indefinite"/>
    </circle>
</svg>`
  },
  MOLD_FRUIT: {
    index: 99, // Special index to avoid conflicts
    type: 'MOLD_FRUIT',
    emoji: '🟫',
    radius: 35,
    nextType: null, // Disappears instead of merging
    color: '#5D4037',
    scoreValue: -50, // Negative score for risk/reward
    cost: {
      diamonds: 1
    },
    sparkleColor: '#8D6E63',
    isMold: true, // Special property
    lifespan: 300000, // 5 minutes in milliseconds
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
        <radialGradient id="moldGrad" cx="0.3" cy="0.3">
            <stop offset="0%" style="stop-color:#6D4C41"/>
            <stop offset="50%" style="stop-color:#5D4037"/>
            <stop offset="100%" style="stop-color:#3E2723"/>
        </radialGradient>
    </defs>

    <!-- Mold base -->
    <circle cx="32" cy="32" r="28" fill="url(#moldGrad)" stroke="#3E2723" stroke-width="2"/>

    <!-- Mold spots pattern -->
    <g fill="#4CAF50" opacity="0.7">
        <circle cx="20" cy="18" r="3" opacity="0.6"/>
        <circle cx="47" cy="22" r="2.5" opacity="0.5"/>
        <circle cx="18" cy="40" r="2" opacity="0.4"/>
        <circle cx="48" cy="42" r="3.5" opacity="0.7"/>
        <circle cx="32" cy="48" r="2" opacity="0.5"/>
        <circle cx="28" cy="16" r="1.5" opacity="0.6"/>
        <circle cx="51" cy="36" r="2.5" opacity="0.8"/>
        <circle cx="24" cy="44" r="1.8" opacity="0.4"/>
        <circle cx="40" cy="16" r="1.2" opacity="0.3"/>
    </g>

    <!-- X eyes (dead/moldy) -->
    <g stroke="#000000" stroke-width="2.5" stroke-linecap="round">
        <line x1="20" y1="22" x2="28" y2="30"/>
        <line x1="28" y1="22" x2="20" y2="30"/>
        <line x1="36" y1="22" x2="44" y2="30"/>
        <line x1="44" y1="22" x2="36" y2="30"/>
    </g>

    <!-- Droopy mouth -->
    <path d="M26,40 Q32,36 38,40" stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round"/>

    <!-- Warning glow effect (animated) -->
    <circle cx="32" cy="32" r="28" fill="none" stroke="#4CAF50" stroke-width="1" opacity="0.6">
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="stroke-width" values="2;4;2" dur="2s" repeatCount="indefinite"/>
    </circle>
</svg>`
  }
}

export const RAINBOW_FRUIT_CONFIG = {
  spawnChance: 0.03, // 3% chance per fruit drop in endless mode
  minSpawnDelay: 90000, // Minimum 1.5 minutes between spawns
  maxSpawnDelay: 300000, // Maximum 5 minutes between spawns
  maxConcurrent: 1, // Only one rainbow at a time
  bonusMultiplier: 2.5, // 2.5x score bonus when used in merge
  universalMerger: true, // Can merge with any fruit type

  // Visual effects
  spawnEffect: {
    particles: 20,
    colors: ['#FF6B6B', '#FFD93D', '#6BCF7F', '#4ECDC4', '#45B7D1', '#96CEB4'],
    duration: 2000
  },
  mergeEffect: {
    particles: 30,
    colors: ['#FF6B6B', '#FFD93D', '#6BCF7F', '#4ECDC4', '#45B7D1', '#96CEB4'],
    duration: 2500
  },

  // Audio cues (for future implementation)
  sounds: {
    spawn: 'rainbow_spawn',
    merge: 'rainbow_merge'
  }
}

export const BOMB_FRUIT_CONFIG = {
  spawnChance: 0.1, // 5% chance per fruit drop in endless mode
  minSpawnDelay: 45000, // Minimum 45 seconds between spawns
  maxSpawnDelay: 180000, // Maximum 3 minutes between spawns
  fuseTime: 10000, // 10 seconds until explosion
  explosionRadius: 70, // Radius in pixels
  bonusPerFruit: 100, // Bonus points per destroyed fruit
  maxConcurrent: 1, // Only one bomb at a time
  screenShakeIntensity: 8, // Screen shake strength
  screenShakeDuration: 800, // Screen shake duration in ms

  // Visual effects
  spawnEffect: {
    particles: 12,
    color: '#FF4444',
    duration: 1200
  },
  explosionEffect: {
    particles: 20,
    color: '#FF6B6B',
    duration: 2000
  },

  // Audio cues (for future implementation)
  sounds: {
    spawn: 'bomb_spawn',
    tick: 'bomb_tick',
    explosion: 'bomb_explosion'
  }
}

export const MOLD_FRUIT_CONFIG = {
  spawnChance: 0.05, // 5% chance per fruit drop in endless mode
  minSpawnDelay: 60000, // Minimum 1 minute between spawns
  maxSpawnDelay: 120000, // Maximum 2 minutes between spawns
  lifespan: 60000, // 1 minute lifespan
  warningFlashTime: 20000, // Flash warning in last 20 seconds
  scoreEffect: -1000, // Negative points when touched/removed
  maxConcurrent: 1, // Only one mold fruit at a time
  minSize: 50,
  minRadius: 10,      // Fruit disappears below this radius
  shrinkOnHit: 0.4,     // px removed per collision
  hitCooldown: 300,   // ms between shrink-on-hit events per fruit

  // Visual effects
  spawnEffect: {
    particles: 8,
    color: '#5D4037',
    duration: 1000
  },
  disappearEffect: {
    particles: 12,
    color: '#8D6E63',
    duration: 1500
  },

  // Audio cues (for future implementation)
  sounds: {
    spawn: 'mold_spawn',
    warning: 'mold_warning',
    disappear: 'mold_disappear'
  }
}

export const POINTS_CONFIG = {
	DURATION: 2000,
	MAX_DISTANCE: 100,
	START_OFFSET_Y: -40,
}

// Level Goal Configuration
export const HAWK_FRUIT_LEVELS = {
	1: {
		targetFruit: 'APPLE',
		title: 'Easy',
		description: "Erstelle einen Apfel",
		starThresholds: {
			1: { targetFruit: 'APPLE', moves: 14 },
			2: { targetFruit: 'APPLE', moves: 10 },
			3: { targetFruit: 'APPLE', moves: 6 },
		}
	},
	2: {
		targetFruit: 'GRAPEFRUIT',
		title: 'Medium',
		description: "Erstelle einen Pfirsiche",
		starThresholds: {
			1: { targetFruit: 'GRAPEFRUIT', moves: 26 },
			2: { targetFruit: 'GRAPEFRUIT', moves: 20 },
			3: { targetFruit: 'GRAPEFRUIT', moves: 16 }
		}
	},
	3: {
		targetFruit: 'PINEAPPLE',
		title: 'Expert',
		description: "Erstelle eine Ananas",
		starThresholds: {
			1: { targetFruit: 'PINEAPPLE', moves: 60 },
			2: { targetFruit: 'PINEAPPLE', moves: 50 },
			3: { targetFruit: 'PINEAPPLE', moves: 40 }
		}
	},
	4: {
		targetFruit: 'COCONUT',
		title: 'Legend',
		description: "Erstelle eine Kokosnuss",
		starThresholds: {
			1: { targetFruit: 'COCONUT', moves: 100 },
			2: { targetFruit: 'COCONUT', moves: 90 },
			3: { targetFruit: 'COCONUT', moves: 80 }
		}
	},
	5: {
		targetFruit: 'MELON',
		title: 'Epic',
		description: "Erstelle eine Melone",
		starThresholds: {
			1: { targetFruit: 'MELON', moves: 150 },
			2: { targetFruit: 'MELON', moves: 140 },
			3: { targetFruit: 'MELON', moves: 130 }
		}
	},
	6: {
		targetFruit: null,
		title: 'Unlimited',
		description: "Erstelle so viele Früchte wie möglich",
		isEndless: true,
		starThresholds: {
			1: { score: 5000, merges: 50 },
			2: { score: 15000, merges: 120 },
			3: { score: 35000, merges: 250 }
		},
		endless: {
			scoreMilestones: [2000, 5000, 15000, 35000],
			timeCheckpoints: [60, 300, 600, 1200],
			comboThresholds: [10, 25, 50, 100]
		}
	},
}

export const hawkFruitConfig = {
	gameId: 'hawkFruit',
	gameTitle: 'Hawk Fruit',
	gameDescription: 'Merge fruits to create new combinations',
	gameIcon: 'hawk-fruit',
	levels: Object.values(HAWK_FRUIT_LEVELS).map((level, index) => ({
		level: index + 1,
		...level
	}))
}

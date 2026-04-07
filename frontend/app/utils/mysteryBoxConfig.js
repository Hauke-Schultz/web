// Mystery Box system configuration
export const MYSTERY_BOX_CONFIG = {
  // Requirements
  requiredDailyRewards: 5,           // How many daily rewards needed

  // Achievement thresholds
  achievementThresholds: [
    { count: 1, achievementId: 'mystery_box_first' },
    { count: 5, achievementId: 'mystery_box_collector' },
    { count: 10, achievementId: 'mystery_box_master' }
  ],

  // Visual settings
  animationDuration: 200,
  sparkleCount: 4,
}

// Exclusive Mystery Box Items - NOT available in shop!
export const MYSTERY_ITEMS = [
  // Tier 1: Common Mystery Items (Box 1-3)
  {
    id: 'magic_hat',
    name: 'Magic Hat',
    description: 'A mysterious hat that sparkles with ancient magic',
    category: 'profile',
    rarity: 'rare',
    icon: '🎩',
    type: 'cosmetic',
    tier: 1,
    mysteryBoxNumber: 1
  },
  {
    id: 'crystal_orb',
    name: 'Crystal Orb',
    description: 'A glowing orb that reveals hidden secrets',
    category: 'profile',
    rarity: 'rare',
    icon: '🔮',
    type: 'cosmetic',
    tier: 1,
    mysteryBoxNumber: 2
  },
  {
    id: 'golden_feather',
    name: 'Golden Feather',
    description: 'A feather from a legendary phoenix',
    category: 'profile',
    rarity: 'rare',
    icon: '🪶',
    type: 'cosmetic',
    tier: 1,
    mysteryBoxNumber: 3
  },

  // Tier 2: Epic Mystery Items (Box 4-6)
  {
    id: 'unicorn_horn',
    name: 'Unicorn Horn',
    description: 'A rare horn from the last unicorn in the realm',
    category: 'profile',
    rarity: 'epic',
    icon: '🦄',
    type: 'cosmetic',
    tier: 2,
    mysteryBoxNumber: 4
  },
  {
    id: 'dragon_scale',
    name: 'Dragon Scale',
    description: 'A shimmering scale from an ancient dragon',
    category: 'profile',
    rarity: 'epic',
    icon: '🐲',
    type: 'cosmetic',
    tier: 2,
    mysteryBoxNumber: 5
  },
  {
    id: 'star_fragment',
    name: 'Star Fragment',
    description: 'A piece of a fallen star, still glowing with cosmic energy',
    category: 'profile',
    rarity: 'epic',
    icon: '⭐',
    type: 'cosmetic',
    tier: 2,
    mysteryBoxNumber: 6
  },

  // Tier 3: Legendary Mystery Items (Box 7+)
  {
    id: 'cosmic_crown',
    name: 'Cosmic Crown',
    description: 'A crown forged from the essence of the universe itself',
    category: 'profile',
    rarity: 'legendary',
    icon: '👑',
    type: 'cosmetic',
    tier: 3,
    mysteryBoxNumber: 7
  },
  {
    id: 'infinity_gem',
    name: 'Infinity Gem',
    description: 'A gem containing infinite possibilities and power',
    category: 'profile',
    rarity: 'legendary',
    icon: '💎',
    type: 'cosmetic',
    tier: 3,
    mysteryBoxNumber: 8
  },
  {
    id: 'time_hourglass',
    name: 'Time Hourglass',
    description: 'An hourglass that can bend the flow of time itself',
    category: 'profile',
    rarity: 'legendary',
    icon: '⏳',
    type: 'cosmetic',
    tier: 3,
    mysteryBoxNumber: 9
  },
  {
    id: 'celestial_wings',
    name: 'Celestial Wings',
    description: 'Wings of pure light that grant divine powers',
    category: 'profile',
    rarity: 'legendary',
    icon: '🪽',
    type: 'cosmetic',
    tier: 3,
    mysteryBoxNumber: 10
  },
  {
    id: 'phoenix_tear',
    name: 'Phoenix Tear',
    description: 'A crystallized tear with the power of rebirth',
    category: 'profile',
    rarity: 'legendary',
    icon: '💧',
    type: 'cosmetic',
    tier: 3,
    mysteryBoxNumber: 11
  },
  {
    id: 'void_orb',
    name: 'Void Orb',
    description: 'An orb containing the mysteries of the void',
    category: 'profile',
    rarity: 'legendary',
    icon: '🌑',
    type: 'cosmetic',
    tier: 3,
    mysteryBoxNumber: 12
  },
  {
    id: 'eternal_flame',
    name: 'Eternal Flame',
    description: 'A flame that never dies, burning with eternal energy',
    category: 'profile',
    rarity: 'legendary',
    icon: '🔥',
    type: 'cosmetic',
    tier: 3,
    mysteryBoxNumber: 13
  },
  {
    id: 'galaxy_heart',
    name: 'Galaxy Heart',
    description: 'A heart-shaped nebula containing entire galaxies',
    category: 'profile',
    rarity: 'legendary',
    icon: '💜',
    type: 'cosmetic',
    tier: 3,
    mysteryBoxNumber: 14
  },
  {
    id: 'divine_halo',
    name: 'Divine Halo',
    description: 'A radiant halo blessed by celestial beings',
    category: 'profile',
    rarity: 'legendary',
    icon: '😇',
    type: 'cosmetic',
    tier: 3,
    mysteryBoxNumber: 15
  },
]

// Helper function to get mystery item for specific box number
export const getMysteryItemForBox = (mysteryBoxNumber) => {
  // First, try to get specific item for this box number
  let item = MYSTERY_ITEMS.find(item => item.mysteryBoxNumber === mysteryBoxNumber)

  if (!item) {
    // Fallback: Get random item based on tier
    let availableItems = []

    if (mysteryBoxNumber <= 3) {
      // Tier 1: Common items
      availableItems = MYSTERY_ITEMS.filter(item => item.tier === 1)
    } else if (mysteryBoxNumber <= 6) {
      // Tier 2: Epic items
      availableItems = MYSTERY_ITEMS.filter(item => item.tier === 2)
    } else {
      // Tier 3: Legendary items
      availableItems = MYSTERY_ITEMS.filter(item => item.tier === 3)
    }

    // Get random item from available tier
    if (availableItems.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableItems.length)
      item = availableItems[randomIndex]
    }
  }

  return item
}

// Helper function to calculate mystery box reward (now returns item instead of currency)
export const calculateMysteryBoxReward = (mysteryBoxNumber) => {
  // Use mysteryBoxNumber as seed for consistent item selection
  const item = getMysteryItemForBox(mysteryBoxNumber)

  if (!item) {
    console.error(`No mystery item found for box ${mysteryBoxNumber}`)
    return null
  }

  return {
    item: item,
    type: 'mystery_box',
    mysteryBoxNumber,
    isSpecial: item.tier >= 3, // Legendary items are "special"
    message: item.tier >= 3 ? `Legendary ${item.name} discovered!` : `${item.name} discovered!`
  }
}

// Rest of the existing helper functions remain the same...
export const getPreviewMysteryItem = (mysteryBoxNumber) => {
  const reward = calculateMysteryBoxReward(mysteryBoxNumber)
  return reward ? reward.item : null
}

export const canClaimMysteryBox = (dailyRewardsCounter, lastClaimedCounter = 0) => {
  const hasEnoughRewards = dailyRewardsCounter > 0 &&
      dailyRewardsCounter % MYSTERY_BOX_CONFIG.requiredDailyRewards === 0
  const notAlreadyClaimed = dailyRewardsCounter > lastClaimedCounter
  return hasEnoughRewards && notAlreadyClaimed
}

export const getMysteryBoxProgress = (dailyRewardsCounter, lastClaimedCounter = 0) => {
  const required = MYSTERY_BOX_CONFIG.requiredDailyRewards
  const current = dailyRewardsCounter % required
  const remaining = required - current
  const percentage = (current / required) * 100

  const canClaim = canClaimMysteryBox(dailyRewardsCounter, lastClaimedCounter)
  const mysteryBoxNumber = Math.floor(dailyRewardsCounter / required)

  return {
    current,
    required,
    remaining,
    percentage: Math.round(percentage),
    isComplete: canClaim,
    mysteryBoxNumber,
    lastClaimedCounter,
    eligibleButClaimed: dailyRewardsCounter % required === 0 && !canClaim
  }
}
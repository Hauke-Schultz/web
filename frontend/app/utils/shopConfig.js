export const SHOP_CATEGORIES = {
  profile: {
    id: 'profile',
    name: 'Profile',
    icon: 'user',
    color: 'primary',
    description: 'Avatar customizations and visual upgrades'
  },
  items: {
    id: 'items',
    name: 'Items',
    icon: 'star',
    color: 'warning',
    description: 'Game enhancements and bonuses'
  },
  utilities: {
    id: 'utilities',
    name: 'Utilities',
    icon: 'settings',
    color: 'info',
    description: 'Helpful tools and features'
  },
  gifts: {
    id: 'gifts',
    name: 'Gifts',
    icon: 'heart',
    color: 'success',
    description: 'Send cosmetic items as gifts to friends'
  }
}

export const SHOP_ITEMS = [
  // Simple Cosmetic Items with Emojis
  {
    id: 'regular_glasses',
    name: 'Smart Glasses',
    description: 'Classic eyeglasses for the intellectual look',
    category: 'profile',
    price: { coins: 1000, diamonds: 0 },
    rarity: 'common',
    icon: '👓',
    type: 'cosmetic',
    purchaseLimit: 1
  },
  {
    id: 'cap',
    name: 'Baseball Cap',
    description: 'Sporty cap for casual gaming',
    category: 'profile',
    price: { coins: 2000, diamonds: 2 },
    rarity: 'common',
    icon: '🧢',
    type: 'cosmetic',
    purchaseLimit: 1
  },
  {
    id: 'sunglasses',
    name: 'Cool Sunglasses',
    description: 'Look cool with stylish sunglasses',
    category: 'profile',
    price: { coins: 4000, diamonds: 4 },
    rarity: 'common',
    icon: '🕶️',
    type: 'cosmetic',
    purchaseLimit: 1
  },
  {
    id: 'tophat',
    name: 'Top Hat',
    description: 'Elegant top hat for distinguished players',
    category: 'profile',
    price: { coins: 10000, diamonds: 20 },
    rarity: 'rare',
    icon: '🎩',
    type: 'cosmetic',
    purchaseLimit: 1
  },
  {
    id: 'car',
    name: 'Cool Car',
    description: 'Show off with your own car',
    category: 'profile',
    price: { coins: 50000, diamonds: 100 },
    rarity: 'epic',
    icon: '🚗',
    type: 'cosmetic',
    purchaseLimit: 1
  },
  {
    id: 'crown',
    name: 'Golden Crown',
    description: 'Royal crown for true champions',
    category: 'profile',
    price: { coins: 85000, diamonds: 250 },
    rarity: 'legendary',
    icon: '👑',
    type: 'cosmetic',
    purchaseLimit: 1
  },

  // Simple Power-ups
  {
    id: 'hammer_powerup',
    name: 'Fruit Hammer',
    description: 'Remove any fruit instantly! Perfect for clearing dangerous situations',
    category: 'items',
    price: { coins: 500, diamonds: 5 },
    rarity: 'common',
    icon: '🔨',
    type: 'consumable',
    purchaseLimit: null
  },
  {
    id: 'undo_move',
    name: 'Undo Move',
    description: 'Take back your last move. Use wisely!',
    category: 'items',
    price: { coins: 500, diamonds: 5 },
    rarity: 'common',
    icon: '↩️',
    type: 'consumable',
    purchaseLimit: null,
  },

  // Simple Utilities
  /*
  {
    id: 'level_skip',
    name: 'Skip Level',
    description: 'Skip any level instantly',
    category: 'utilities',
    price: { coins: 0, diamonds: 10 },
    rarity: 'epic',
    icon: '⏭️',
    type: 'consumable',
    purchaseLimit: null
  }
  */

  // Friendship Items
  {
    id: 'friendship_ring',
    name: 'Friendship Ring',
    description: 'A symbol of eternal friendship and connection',
    category: 'gifts',
    price: { coins: 2500, diamonds: 8 },
    rarity: 'rare',
    icon: '💍',
    type: 'cosmetic',
    purchaseLimit: 10,
    giftOnly: false
  },
  {
    id: 'friendship_bracelet',
    name: 'Friendship Bracelet',
    description: 'Handcrafted bracelet to celebrate your friendship',
    category: 'gifts',
    price: { coins: 1500, diamonds: 5 },
    rarity: 'uncommon',
    icon: '📿',
    type: 'cosmetic',
    purchaseLimit: 10,
    giftOnly: false
  },
  {
    id: 'love_letter',
    name: 'Love Letter',
    description: 'A heartfelt letter expressing your appreciation',
    category: 'gifts',
    price: { coins: 800, diamonds: 2 },
    rarity: 'common',
    icon: '💌',
    type: 'cosmetic',
    purchaseLimit: 10,
    giftOnly: false
  },

  // Celebration Items
  {
    id: 'birthday_cake',
    name: 'Birthday Cake',
    description: 'Celebrate special moments with a delicious cake',
    category: 'gifts',
    price: { coins: 3000, diamonds: 10 },
    rarity: 'rare',
    icon: '🎂',
    type: 'cosmetic',
    purchaseLimit: 10,
    giftOnly: false
  },
  {
    id: 'party_hat',
    name: 'Party Hat',
    description: 'Perfect for celebrating achievements together',
    category: 'gifts',
    price: { coins: 1200, diamonds: 3 },
    rarity: 'uncommon',
    icon: '🎉',
    type: 'cosmetic',
    purchaseLimit: 10,
    giftOnly: false
  },
  {
    id: 'champagne_bottle',
    name: 'Champagne Bottle',
    description: 'Toast to success and friendship',
    category: 'gifts',
    price: { coins: 2000, diamonds: 6 },
    rarity: 'uncommon',
    icon: '🍾',
    type: 'cosmetic',
    purchaseLimit: 5,
    giftOnly: false
  },

  // Luck & Fortune Items
  {
    id: 'four_leaf_clover',
    name: 'Four Leaf Clover',
    description: 'Share some luck with your friends',
    category: 'gifts',
    price: { coins: 3800, diamonds: 7 },
    rarity: 'rare',
    icon: '🍀',
    type: 'cosmetic',
    purchaseLimit: 5,
    giftOnly: false
  },
  {
    id: 'lucky_coin',
    name: 'Lucky Coin',
    description: 'An ancient coin that brings good fortune',
    category: 'gifts',
    price: { coins: 10000, diamonds: 10 },
    rarity: 'uncommon',
    icon: '🪙',
    type: 'cosmetic',
    purchaseLimit: 5,
    giftOnly: false
  },

  // Nature & Beauty Items
  {
    id: 'red_rose',
    name: 'Red Rose',
    description: 'A classic symbol of love and appreciation',
    category: 'gifts',
    price: { coins: 600, diamonds: 2 },
    rarity: 'common',
    icon: '🌹',
    type: 'cosmetic',
    purchaseLimit: 10,
    giftOnly: false
  },
  {
    id: 'bouquet_flowers',
    name: 'Flower Bouquet',
    description: 'Beautiful mixed bouquet of colorful flowers',
    category: 'gifts',
    price: { coins: 1800, diamonds: 6 },
    rarity: 'uncommon',
    icon: '💐',
    type: 'cosmetic',
    purchaseLimit: 10,
    giftOnly: false
  },
  {
    id: 'butterfly',
    name: 'Magical Butterfly',
    description: 'Delicate butterfly that brings joy and beauty',
    category: 'gifts',
    price: { coins: 22000, diamonds: 18 },
    rarity: 'rare',
    icon: '🦋',
    type: 'cosmetic',
    purchaseLimit: 10,
    giftOnly: false
  },

  // Precious & Luxury Items
  {
    id: 'diamond_gem',
    name: 'Precious Diamond',
    description: 'A rare and valuable diamond for special friends',
    category: 'gifts',
    price: { coins: 30000, diamonds: 25 },
    rarity: 'epic',
    icon: '💎',
    type: 'cosmetic',
    purchaseLimit: 5,
    giftOnly: false
  },
  {
    id: 'crystal_ball',
    name: 'Crystal Ball',
    description: 'Mystical crystal ball for fortune telling',
    category: 'gifts',
    price: { coins: 45000, diamonds: 28 },
    rarity: 'epic',
    icon: '🔮',
    type: 'cosmetic',
    purchaseLimit: 5,
    giftOnly: false
  },
  {
    id: 'golden_star',
    name: 'Golden Star',
    description: 'Shining golden star to honor achievements',
    category: 'gifts',
    price: { coins: 50000, diamonds: 30 },
    rarity: 'epic',
    icon: '⭐',
    type: 'cosmetic',
    purchaseLimit: 5,
    giftOnly: false
  },
  {
    id: 'treasure_chest',
    name: 'Treasure Chest',
    description: 'Mysterious chest filled with precious memories',
    category: 'gifts',
    price: { coins: 120000, diamonds: 50 },
    rarity: 'legendary',
    icon: '🏆',
    type: 'cosmetic',
    purchaseLimit: 5,
    giftOnly: false
  },

  // Fun & Playful Items
  {
    id: 'teddy_bear',
    name: 'Cute Teddy Bear',
    description: 'Adorable teddy bear for comfort and companionship',
    category: 'gifts',
    price: { coins: 130000, diamonds: 100 },
    rarity: 'uncommon',
    icon: '🧸',
    type: 'cosmetic',
    purchaseLimit: 1,
    giftOnly: false
  },
  {
    id: 'rainbow',
    name: 'Rainbow Bridge',
    description: 'Beautiful rainbow connecting hearts and dreams',
    category: 'gifts',
    price: { coins: 250000, diamonds: 200 },
    rarity: 'rare',
    icon: '🌈',
    type: 'cosmetic',
    purchaseLimit: 5,
    giftOnly: false
  }
]

export const RARITY_CONFIG = {
  common: {
    name: 'Common',
    color: '#6B7280',
    borderColor: '#9CA3AF'
  },
  uncommon: {
    name: 'Uncommon',
    color: '#10B981',
    borderColor: '#34D399'
  },
  rare: {
    name: 'Rare',
    color: '#3B82F6',
    borderColor: '#60A5FA'
  },
  epic: {
    name: 'Epic',
    color: '#8B5CF6',
    borderColor: '#A78BFA'
  },
  legendary: {
    name: 'Legendary',
    color: '#F59E0B',
    borderColor: '#FBBF24'
  }
}

export const shopConfig = {
  categories: Object.values(SHOP_CATEGORIES),
  items: SHOP_ITEMS,
  rarities: RARITY_CONFIG
}
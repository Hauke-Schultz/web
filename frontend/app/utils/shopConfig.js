export const SHOP_CATEGORIES = [
  { id: 'profile', label: 'Profile', emoji: '👤' },
  { id: 'items',   label: 'Items',   emoji: '⚡' },
  { id: 'gifts',   label: 'Gifts',   emoji: '🎁' },
]

export const SHOP_ITEMS = [
  // ── Profile ───────────────────────────────────────────
  {
    id: 'regular_glasses', name: 'Smart Glasses',
    description: 'Klassische Brille für den intellektuellen Look.',
    category: 'profile', icon: '👓', rarity: 'common',
    price: { coins: 1000, diamonds: 0 }, purchaseLimit: 1,
  },
  {
    id: 'cap', name: 'Baseball Cap',
    description: 'Sportliche Kappe für entspanntes Gaming.',
    category: 'profile', icon: '🧢', rarity: 'common',
    price: { coins: 2000, diamonds: 2 }, purchaseLimit: 1,
  },
  {
    id: 'sunglasses', name: 'Cool Sunglasses',
    description: 'Stylische Sonnenbrille für den coolen Auftritt.',
    category: 'profile', icon: '🕶️', rarity: 'common',
    price: { coins: 4000, diamonds: 4 }, purchaseLimit: 1,
  },
  {
    id: 'tophat', name: 'Top Hat',
    description: 'Eleganter Zylinder für distinguierte Spieler.',
    category: 'profile', icon: '🎩', rarity: 'rare',
    price: { coins: 10000, diamonds: 20 }, purchaseLimit: 1,
  },
  {
    id: 'car', name: 'Cool Car',
    description: 'Zeig allen dein eigenes Auto.',
    category: 'profile', icon: '🚗', rarity: 'epic',
    price: { coins: 50000, diamonds: 100 }, purchaseLimit: 1,
  },
  {
    id: 'crown', name: 'Golden Crown',
    description: 'Königliche Krone für wahre Champions.',
    category: 'profile', icon: '👑', rarity: 'legendary',
    price: { coins: 85000, diamonds: 250 }, purchaseLimit: 1,
  },

  // ── Items (Consumables) ───────────────────────────────
  {
    id: 'hammer_powerup', name: 'Fruit Hammer',
    description: 'Entferne eine Frucht sofort! Perfekt für brenzlige Situationen.',
    category: 'items', icon: '🔨', rarity: 'common',
    price: { coins: 500, diamonds: 5 }, purchaseLimit: null, type: 'consumable',
  },
  {
    id: 'undo_move', name: 'Undo Move',
    description: 'Nimm deinen letzten Zug zurück. Weise einsetzen!',
    category: 'items', icon: '↩️', rarity: 'common',
    price: { coins: 500, diamonds: 5 }, purchaseLimit: null, type: 'consumable',
  },

  // ── Gifts ─────────────────────────────────────────────
  {
    id: 'love_letter', name: 'Love Letter',
    description: 'Ein herzlicher Brief als Zeichen der Wertschätzung.',
    category: 'gifts', icon: '💌', rarity: 'common',
    price: { coins: 800, diamonds: 2 }, purchaseLimit: 10,
  },
  {
    id: 'red_rose', name: 'Red Rose',
    description: 'Ein klassisches Symbol der Zuneigung.',
    category: 'gifts', icon: '🌹', rarity: 'common',
    price: { coins: 600, diamonds: 2 }, purchaseLimit: 10,
  },
  {
    id: 'party_hat', name: 'Party Hat',
    description: 'Perfekt zum Feiern gemeinsamer Erfolge.',
    category: 'gifts', icon: '🎉', rarity: 'uncommon',
    price: { coins: 1200, diamonds: 3 }, purchaseLimit: 10,
  },
  {
    id: 'friendship_bracelet', name: 'Friendship Bracelet',
    description: 'Handgefertigtes Armband als Zeichen der Freundschaft.',
    category: 'gifts', icon: '📿', rarity: 'uncommon',
    price: { coins: 1500, diamonds: 5 }, purchaseLimit: 10,
  },
  {
    id: 'bouquet_flowers', name: 'Flower Bouquet',
    description: 'Wunderschöner Blumenstrauß in bunten Farben.',
    category: 'gifts', icon: '💐', rarity: 'uncommon',
    price: { coins: 1800, diamonds: 6 }, purchaseLimit: 10,
  },
  {
    id: 'champagne_bottle', name: 'Champagne Bottle',
    description: 'Stoß auf Erfolge und Freundschaft an.',
    category: 'gifts', icon: '🍾', rarity: 'uncommon',
    price: { coins: 2000, diamonds: 6 }, purchaseLimit: 5,
  },
  {
    id: 'friendship_ring', name: 'Friendship Ring',
    description: 'Ein Symbol ewiger Freundschaft.',
    category: 'gifts', icon: '💍', rarity: 'rare',
    price: { coins: 2500, diamonds: 8 }, purchaseLimit: 10,
  },
  {
    id: 'birthday_cake', name: 'Birthday Cake',
    description: 'Feiere besondere Momente mit einem leckeren Kuchen.',
    category: 'gifts', icon: '🎂', rarity: 'rare',
    price: { coins: 3000, diamonds: 10 }, purchaseLimit: 10,
  },
  {
    id: 'four_leaf_clover', name: 'Four Leaf Clover',
    description: 'Teile etwas Glück mit deinen Freunden.',
    category: 'gifts', icon: '🍀', rarity: 'rare',
    price: { coins: 3800, diamonds: 7 }, purchaseLimit: 5,
  },
  {
    id: 'lucky_coin', name: 'Lucky Coin',
    description: 'Eine alte Münze, die Glück bringen soll.',
    category: 'gifts', icon: '🪙', rarity: 'uncommon',
    price: { coins: 10000, diamonds: 10 }, purchaseLimit: 5,
  },
  {
    id: 'butterfly', name: 'Magical Butterfly',
    description: 'Ein zarter Schmetterling, der Freude bringt.',
    category: 'gifts', icon: '🦋', rarity: 'rare',
    price: { coins: 22000, diamonds: 18 }, purchaseLimit: 10,
  },
  {
    id: 'diamond_gem', name: 'Precious Diamond',
    description: 'Ein seltener Diamant für besondere Freunde.',
    category: 'gifts', icon: '💎', rarity: 'epic',
    price: { coins: 30000, diamonds: 25 }, purchaseLimit: 5,
  },
  {
    id: 'crystal_ball', name: 'Crystal Ball',
    description: 'Mystische Kristallkugel zur Wahrsagerei.',
    category: 'gifts', icon: '🔮', rarity: 'epic',
    price: { coins: 45000, diamonds: 28 }, purchaseLimit: 5,
  },
  {
    id: 'golden_star', name: 'Golden Star',
    description: 'Leuchtender goldener Stern zur Ehrung von Leistungen.',
    category: 'gifts', icon: '⭐', rarity: 'epic',
    price: { coins: 50000, diamonds: 30 }, purchaseLimit: 5,
  },
  {
    id: 'treasure_chest', name: 'Treasure Chest',
    description: 'Mysteriöse Truhe voller kostbarer Erinnerungen.',
    category: 'gifts', icon: '🏆', rarity: 'legendary',
    price: { coins: 120000, diamonds: 50 }, purchaseLimit: 5,
  },
  {
    id: 'teddy_bear', name: 'Cute Teddy Bear',
    description: 'Niedlicher Teddybär für Geborgenheit und Gesellschaft.',
    category: 'gifts', icon: '🧸', rarity: 'uncommon',
    price: { coins: 130000, diamonds: 100 }, purchaseLimit: 1,
  },
  {
    id: 'rainbow', name: 'Rainbow Bridge',
    description: 'Wunderschöner Regenbogen, der Herzen verbindet.',
    category: 'gifts', icon: '🌈', rarity: 'rare',
    price: { coins: 250000, diamonds: 200 }, purchaseLimit: 5,
  },
]

export const RARITY = {
  common:    { label: 'Common',    text: 'text-white/50',   border: 'border-white/20'     },
  uncommon:  { label: 'Uncommon',  text: 'text-green-400',  border: 'border-green-400/40' },
  rare:      { label: 'Rare',      text: 'text-blue-400',   border: 'border-blue-400/50'  },
  epic:      { label: 'Epic',      text: 'text-purple-400', border: 'border-purple-400/50'},
  legendary: { label: 'Legendary', text: 'text-amber-400',  border: 'border-amber-400/60' },
}

export const INITIAL_CATALOG = [
  {
    id: "prod_1",
    name: "PlayStation 5 Pro",
    category: "Gaming Console",
    price: 699,
    oldPrice: 699,
    inStock: true,
  },
  {
    id: "prod_2",
    name: "NVIDIA RTX 5090 GPU",
    category: "PC Hardware",
    price: 1999,
    oldPrice: 1999,
    inStock: false,
  },
  {
    id: "prod_3",
    name: "MacBook Pro M4 Max",
    category: "Laptops",
    price: 3499,
    oldPrice: 3499,
    inStock: true,
  },
  {
    id: "prod_4",
    name: "Steam Deck OLED 1TB",
    category: "Handheld Gaming",
    price: 649,
    oldPrice: 649,
    inStock: true,
  },
  {
    id: "prod_5",
    name: 'LG 32" 4K OLED Monitor',
    category: "Displays",
    price: 1199,
    oldPrice: 1199,
    inStock: true,
  },
];

// Initial realistic user profiles to test dynamic routing!
export const INITIAL_USERS = [
  {
    id: "user_dev",
    name: "Alex (You - Pro Tester)",
    email: "alex.dev@pulsestream.io",
    avatar: "👨‍💻",
    subscriptions: {
      prod_1: { inApp: true, email: false }, // PS5: WebSockets only
      prod_2: { inApp: true, email: true }, // GPU: Both channels!
    },
  },
  {
    id: "user_gamer",
    name: "Sarah (Esports Gamer)",
    email: "sarah.gg@gmail.com",
    avatar: "🎮",
    subscriptions: {
      prod_1: { inApp: true, email: true }, // PS5: Both channels
      prod_4: { inApp: true, email: false }, // Steam Deck: In-app only
    },
  },
  {
    id: "user_busy",
    name: "Marcus (Offline Exec)",
    email: "marcus.exec@enterprise.com",
    avatar: "💼",
    subscriptions: {
      prod_3: { inApp: false, email: true }, // MacBook: Email only!
      prod_5: { inApp: false, email: true }, // Monitor: Email only!
    },
  },
];

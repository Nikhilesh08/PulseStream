export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  oldPrice: number;
  inStock: boolean;
  topicId: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  // Maps productId -> { inApp: boolean, email: boolean }
  subscriptions: Record<string, { inApp: boolean; email: boolean }>;
}

// Our active MongoDB Topic ID for testing live routing
const ACTIVE_TEST_TOPIC_ID = "6a58965371f1a54a102fc0cf";

export const INITIAL_CATALOG: Product[] = [
  {
    id: "prod_1",
    name: "PlayStation 5 Pro",
    category: "Gaming Console",
    price: 699,
    oldPrice: 699,
    inStock: true,
    topicId: ACTIVE_TEST_TOPIC_ID,
  },
  {
    id: "prod_2",
    name: "NVIDIA RTX 5090 GPU",
    category: "PC Hardware",
    price: 1999,
    oldPrice: 1999,
    inStock: false,
    topicId: ACTIVE_TEST_TOPIC_ID,
  },
  {
    id: "prod_3",
    name: "MacBook Pro M4 Max",
    category: "Laptops",
    price: 3499,
    oldPrice: 3499,
    inStock: true,
    topicId: ACTIVE_TEST_TOPIC_ID,
  },
  {
    id: "prod_4",
    name: "Steam Deck OLED 1TB",
    category: "Handheld Gaming",
    price: 649,
    oldPrice: 649,
    inStock: true,
    topicId: ACTIVE_TEST_TOPIC_ID,
  },
  {
    id: "prod_5",
    name: 'LG 32" 4K OLED Monitor',
    category: "Displays",
    price: 1199,
    oldPrice: 1199,
    inStock: true,
    topicId: ACTIVE_TEST_TOPIC_ID,
  },
];

// Initial realistic user profiles to test dynamic routing!
export const INITIAL_USERS: UserProfile[] = [
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

// Mock database for Wayfair return fraud detection demo.
// Four pre-seeded customers covering the four target fraud patterns.
// All dates relative to today: 2026-05-26.

export type ItemCategory =
  | "furniture"
  | "mattress"
  | "appliance"
  | "decor"
  | "clearance"
  | "personalized"
  | "open_box"
  | "plant"
  | "swatch";

export type ReturnReason =
  | "not_as_described"
  | "changed_mind"
  | "damaged_on_arrival"
  | "defective"
  | "missing_parts"
  | "wrong_item"
  | "too_firm"
  | "quality_issue"
  | "color_mismatch";

// "return" = item shipped back; "appeasement" = customer kept item, got credit/discount
export type InteractionType = "return" | "appeasement";

export interface Customer {
  customerId: string;
  name: string;
  email: string;
  accountCreatedDate: string;
  totalOrders: number;
  totalSpend: number;
}

export interface OrderItem {
  itemId: string;
  name: string;
  category: ItemCategory;
  price: number;
  quantity: number;
  nonReturnable: boolean;
}

export interface Order {
  orderId: string;
  customerId: string;
  orderDate: string;
  deliveryDate: string;
  items: OrderItem[];
  totalAmount: number;
}

export interface ReturnInteraction {
  interactionId: string;
  customerId: string;
  orderId: string;
  itemId: string;
  itemName: string;
  itemValue: number;
  type: InteractionType;
  claimDate: string;
  daysSinceDelivery: number;
  reason: ReturnReason;
  reasonText: string;
  // keptItem true = appeasement (customer never returned the product)
  keptItem: boolean;
  resolution: "full_refund" | "store_credit" | "partial_refund" | "replacement" | "denied";
  amountCredited: number;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const CUSTOMERS: Customer[] = [
  {
    customerId: "C001",
    name: "Marcus Lee",
    email: "marcus.lee@email.com",
    accountCreatedDate: "2024-08-14",
    totalOrders: 5,
    totalSpend: 4428,
  },
  {
    customerId: "C002",
    name: "Jennifer Park",
    email: "jennifer.park@email.com",
    accountCreatedDate: "2025-01-03",
    totalOrders: 5,
    totalSpend: 2886,
  },
  {
    customerId: "C003",
    name: "Ryan Thompson",
    email: "ryan.thompson@email.com",
    accountCreatedDate: "2023-11-20",
    totalOrders: 10,
    totalSpend: 3422,
  },
  {
    customerId: "C004",
    name: "Emma Wilson",
    email: "emma.wilson@email.com",
    accountCreatedDate: "2022-06-10",
    totalOrders: 6,
    totalSpend: 2304,
  },
];

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ORDERS: Order[] = [
  // --- Marcus Lee (C001) — Wardrobing: high-value furniture, always day 27-29 ---
  {
    orderId: "ORD-1001",
    customerId: "C001",
    orderDate: "2026-01-08",
    deliveryDate: "2026-01-15",
    items: [{ itemId: "I-1001", name: "Sectional Sofa", category: "furniture", price: 1299, quantity: 1, nonReturnable: false }],
    totalAmount: 1299,
  },
  {
    orderId: "ORD-1002",
    customerId: "C001",
    orderDate: "2026-02-05",
    deliveryDate: "2026-02-12",
    items: [{ itemId: "I-1002", name: "Dining Table Set", category: "furniture", price: 899, quantity: 1, nonReturnable: false }],
    totalAmount: 899,
  },
  {
    orderId: "ORD-1003",
    customerId: "C001",
    orderDate: "2026-02-26",
    deliveryDate: "2026-03-05",
    items: [{ itemId: "I-1003", name: "King Bed Frame", category: "furniture", price: 1100, quantity: 1, nonReturnable: false }],
    totalAmount: 1100,
  },
  {
    orderId: "ORD-1004",
    customerId: "C001",
    orderDate: "2026-04-03",
    deliveryDate: "2026-04-10",
    items: [{ itemId: "I-1004", name: "Coffee Table", category: "furniture", price: 450, quantity: 1, nonReturnable: false }],
    totalAmount: 450,
  },
  {
    // Active case: 16 days since delivery, within window — agent should flag pattern
    orderId: "ORD-1005",
    customerId: "C001",
    orderDate: "2026-05-03",
    deliveryDate: "2026-05-10",
    items: [{ itemId: "I-1005", name: "Living Room Sofa", category: "furniture", price: 1450, quantity: 1, nonReturnable: false }],
    totalAmount: 1450,
  },

  // --- Jennifer Park (C002) — Appeasement abuse: keeps items, collects discounts ---
  {
    orderId: "ORD-2001",
    customerId: "C002",
    orderDate: "2026-01-29",
    deliveryDate: "2026-02-05",
    items: [{ itemId: "I-2001", name: "5-Shelf Bookcase", category: "furniture", price: 299, quantity: 1, nonReturnable: false }],
    totalAmount: 299,
  },
  {
    orderId: "ORD-2002",
    customerId: "C002",
    orderDate: "2026-02-21",
    deliveryDate: "2026-02-28",
    items: [{ itemId: "I-2002", name: "Accent Chair", category: "furniture", price: 499, quantity: 1, nonReturnable: false }],
    totalAmount: 499,
  },
  {
    orderId: "ORD-2003",
    customerId: "C002",
    orderDate: "2026-03-15",
    deliveryDate: "2026-03-22",
    items: [{ itemId: "I-2003", name: "Patio Dining Set", category: "furniture", price: 699, quantity: 1, nonReturnable: false }],
    totalAmount: 699,
  },
  {
    orderId: "ORD-2004",
    customerId: "C002",
    orderDate: "2026-04-11",
    deliveryDate: "2026-04-18",
    items: [{ itemId: "I-2004", name: "Bedside Table", category: "furniture", price: 189, quantity: 1, nonReturnable: false }],
    totalAmount: 189,
  },
  {
    // Active case: "large tear in fabric, requesting compensation"
    orderId: "ORD-2005",
    customerId: "C002",
    orderDate: "2026-05-08",
    deliveryDate: "2026-05-15",
    items: [{ itemId: "I-2005", name: "3-Seat Linen Sofa", category: "furniture", price: 1200, quantity: 1, nonReturnable: false }],
    totalAmount: 1200,
  },

  // --- Ryan Thompson (C003) — Serial returner: 5/10 orders returned (50%) ---
  {
    orderId: "ORD-3001",
    customerId: "C003",
    orderDate: "2026-01-13",
    deliveryDate: "2026-01-20",
    items: [{ itemId: "I-3001", name: "Ergonomic Desk Chair", category: "furniture", price: 299, quantity: 1, nonReturnable: false }],
    totalAmount: 299,
  },
  {
    orderId: "ORD-3002",
    customerId: "C003",
    orderDate: "2026-01-18",
    deliveryDate: "2026-01-25",
    items: [{ itemId: "I-3002", name: "3-Shelf Bookcase", category: "furniture", price: 199, quantity: 1, nonReturnable: false }],
    totalAmount: 199,
  },
  {
    orderId: "ORD-3003",
    customerId: "C003",
    orderDate: "2026-02-03",
    deliveryDate: "2026-02-10",
    items: [{ itemId: "I-3003", name: "Large Area Rug", category: "decor", price: 349, quantity: 1, nonReturnable: false }],
    totalAmount: 349,
  },
  {
    orderId: "ORD-3004",
    customerId: "C003",
    orderDate: "2026-02-13",
    deliveryDate: "2026-02-20",
    items: [{ itemId: "I-3004", name: "Nightstand", category: "furniture", price: 159, quantity: 1, nonReturnable: false }],
    totalAmount: 159,
  },
  {
    orderId: "ORD-3005",
    customerId: "C003",
    orderDate: "2026-02-26",
    deliveryDate: "2026-03-05",
    items: [{ itemId: "I-3005", name: "Floor Lamp", category: "decor", price: 89, quantity: 1, nonReturnable: false }],
    totalAmount: 89,
  },
  {
    orderId: "ORD-3006",
    customerId: "C003",
    orderDate: "2026-03-03",
    deliveryDate: "2026-03-10",
    items: [{ itemId: "I-3006", name: "Throw Pillows 4-Pack", category: "decor", price: 65, quantity: 1, nonReturnable: false }],
    totalAmount: 65,
  },
  {
    orderId: "ORD-3007",
    customerId: "C003",
    orderDate: "2026-03-18",
    deliveryDate: "2026-03-25",
    items: [{ itemId: "I-3007", name: "TV Media Stand", category: "furniture", price: 449, quantity: 1, nonReturnable: false }],
    totalAmount: 449,
  },
  {
    orderId: "ORD-3008",
    customerId: "C003",
    orderDate: "2026-04-08",
    deliveryDate: "2026-04-15",
    items: [{ itemId: "I-3008", name: "Ottoman Set (2-pack)", category: "furniture", price: 229, quantity: 1, nonReturnable: false }],
    totalAmount: 229,
  },
  {
    orderId: "ORD-3009",
    customerId: "C003",
    orderDate: "2026-04-24",
    deliveryDate: "2026-05-01",
    items: [{ itemId: "I-3009", name: "Decorative Wall Mirror", category: "decor", price: 185, quantity: 1, nonReturnable: false }],
    totalAmount: 185,
  },
  {
    // Active case: just placed, requesting return "color not as expected"
    orderId: "ORD-3010",
    customerId: "C003",
    orderDate: "2026-05-11",
    deliveryDate: "2026-05-18",
    items: [{ itemId: "I-3010", name: "Outdoor Furniture Set", category: "furniture", price: 650, quantity: 1, nonReturnable: false }],
    totalAmount: 650,
  },

  // --- Emma Wilson (C004) — Clean customer: 1 legitimate return in 6 orders ---
  {
    orderId: "ORD-4001",
    customerId: "C004",
    orderDate: "2026-01-25",
    deliveryDate: "2026-02-01",
    items: [{ itemId: "I-4001", name: "6-Drawer Dresser", category: "furniture", price: 549, quantity: 1, nonReturnable: false }],
    totalAmount: 549,
  },
  {
    orderId: "ORD-4002",
    customerId: "C004",
    orderDate: "2026-02-08",
    deliveryDate: "2026-02-15",
    items: [{ itemId: "I-4002", name: "Desk Lamp", category: "decor", price: 79, quantity: 1, nonReturnable: false }],
    totalAmount: 79,
  },
  {
    orderId: "ORD-4003",
    customerId: "C004",
    orderDate: "2026-02-22",
    deliveryDate: "2026-03-01",
    items: [{ itemId: "I-4003", name: "Glass Coffee Table", category: "furniture", price: 329, quantity: 1, nonReturnable: false }],
    totalAmount: 329,
  },
  {
    orderId: "ORD-4004",
    customerId: "C004",
    orderDate: "2026-03-13",
    deliveryDate: "2026-03-20",
    items: [{ itemId: "I-4004", name: "Chunky Knit Throw", category: "decor", price: 49, quantity: 1, nonReturnable: false }],
    totalAmount: 49,
  },
  {
    orderId: "ORD-4005",
    customerId: "C004",
    orderDate: "2026-04-03",
    deliveryDate: "2026-04-10",
    items: [{ itemId: "I-4005", name: "Counter Height Bar Stools (set of 2)", category: "furniture", price: 399, quantity: 1, nonReturnable: false }],
    totalAmount: 399,
  },
  {
    // Active case: mattress within 100-day window — should auto-approve
    orderId: "ORD-4006",
    customerId: "C004",
    orderDate: "2026-04-13",
    deliveryDate: "2026-04-20",
    items: [{ itemId: "I-4006", name: "Memory Foam Mattress (Queen)", category: "mattress", price: 899, quantity: 1, nonReturnable: false }],
    totalAmount: 899,
  },
];

// ---------------------------------------------------------------------------
// Return & Appeasement History
// ---------------------------------------------------------------------------

export const RETURN_HISTORY: ReturnInteraction[] = [
  // Marcus Lee — 4 completed wardrobing returns
  {
    interactionId: "INT-1001",
    customerId: "C001",
    orderId: "ORD-1001",
    itemId: "I-1001",
    itemName: "Sectional Sofa",
    itemValue: 1299,
    type: "return",
    claimDate: "2026-02-11",
    daysSinceDelivery: 27,
    reason: "not_as_described",
    reasonText: "Sofa color looked different in person than on the website.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 1299,
  },
  {
    interactionId: "INT-1002",
    customerId: "C001",
    orderId: "ORD-1002",
    itemId: "I-1002",
    itemName: "Dining Table Set",
    itemValue: 899,
    type: "return",
    claimDate: "2026-03-12",
    daysSinceDelivery: 29,
    reason: "not_as_described",
    reasonText: "Table was smaller than expected. Doesn't fit the space.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 899,
  },
  {
    interactionId: "INT-1003",
    customerId: "C001",
    orderId: "ORD-1003",
    itemId: "I-1003",
    itemName: "King Bed Frame",
    itemValue: 1100,
    type: "return",
    claimDate: "2026-04-02",
    daysSinceDelivery: 28,
    reason: "changed_mind",
    reasonText: "We decided to redecorate in a different style.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 1100,
  },
  {
    interactionId: "INT-1004",
    customerId: "C001",
    orderId: "ORD-1004",
    itemId: "I-1004",
    itemName: "Coffee Table",
    itemValue: 450,
    type: "return",
    claimDate: "2026-05-08",
    daysSinceDelivery: 28,
    reason: "not_as_described",
    reasonText: "Finish looks cheap compared to website photos.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 450,
  },

  // Jennifer Park — 4 completed appeasement interactions (kept items, got credits)
  {
    interactionId: "INT-2001",
    customerId: "C002",
    orderId: "ORD-2001",
    itemId: "I-2001",
    itemName: "5-Shelf Bookcase",
    itemValue: 299,
    type: "appeasement",
    claimDate: "2026-02-12",
    daysSinceDelivery: 7,
    reason: "damaged_on_arrival",
    reasonText: "One shelf has a visible scratch. Sending photo. Would like compensation.",
    keptItem: true,
    resolution: "partial_refund",
    amountCredited: 45,
  },
  {
    interactionId: "INT-2002",
    customerId: "C002",
    orderId: "ORD-2002",
    itemId: "I-2002",
    itemName: "Accent Chair",
    itemValue: 499,
    type: "appeasement",
    claimDate: "2026-03-08",
    daysSinceDelivery: 9,
    reason: "missing_parts",
    reasonText: "Bag of hardware was missing. Chair arrived assembled so I can't tell if anything's wrong yet.",
    keptItem: true,
    resolution: "partial_refund",
    amountCredited: 75,
  },
  {
    interactionId: "INT-2003",
    customerId: "C002",
    orderId: "ORD-2003",
    itemId: "I-2003",
    itemName: "Patio Dining Set",
    itemValue: 699,
    type: "appeasement",
    claimDate: "2026-04-01",
    daysSinceDelivery: 10,
    reason: "damaged_on_arrival",
    reasonText: "One chair leg is bent. I'd prefer a partial refund over returning the whole set.",
    keptItem: true,
    resolution: "partial_refund",
    amountCredited: 100,
  },
  {
    interactionId: "INT-2004",
    customerId: "C002",
    orderId: "ORD-2004",
    itemId: "I-2004",
    itemName: "Bedside Table",
    itemValue: 189,
    type: "appeasement",
    claimDate: "2026-04-25",
    daysSinceDelivery: 7,
    reason: "damaged_on_arrival",
    reasonText: "Deep scratch on the top surface. Please credit my account.",
    keptItem: true,
    resolution: "store_credit",
    amountCredited: 30,
  },

  // Ryan Thompson — 5 returns across 10 orders
  {
    interactionId: "INT-3001",
    customerId: "C003",
    orderId: "ORD-3001",
    itemId: "I-3001",
    itemName: "Ergonomic Desk Chair",
    itemValue: 299,
    type: "return",
    claimDate: "2026-02-01",
    daysSinceDelivery: 12,
    reason: "not_as_described",
    reasonText: "Not as ergonomic as described. Back support is poor.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 299,
  },
  {
    interactionId: "INT-3002",
    customerId: "C003",
    orderId: "ORD-3003",
    itemId: "I-3003",
    itemName: "Large Area Rug",
    itemValue: 349,
    type: "return",
    claimDate: "2026-02-25",
    daysSinceDelivery: 15,
    reason: "color_mismatch",
    reasonText: "The color online was a warm beige but this is more grey.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 349,
  },
  {
    interactionId: "INT-3003",
    customerId: "C003",
    orderId: "ORD-3006",
    itemId: "I-3006",
    itemName: "Throw Pillows 4-Pack",
    itemValue: 65,
    type: "return",
    claimDate: "2026-03-20",
    daysSinceDelivery: 10,
    reason: "changed_mind",
    reasonText: "Decided I wanted a different pattern.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 65,
  },
  {
    interactionId: "INT-3004",
    customerId: "C003",
    orderId: "ORD-3008",
    itemId: "I-3008",
    itemName: "Ottoman Set (2-pack)",
    itemValue: 229,
    type: "return",
    claimDate: "2026-05-02",
    daysSinceDelivery: 17,
    reason: "defective",
    reasonText: "One ottoman arrived with a broken zipper on the storage compartment.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 229,
  },
  {
    interactionId: "INT-3005",
    customerId: "C003",
    orderId: "ORD-3009",
    itemId: "I-3009",
    itemName: "Decorative Wall Mirror",
    itemValue: 185,
    type: "return",
    claimDate: "2026-05-14",
    daysSinceDelivery: 13,
    reason: "quality_issue",
    reasonText: "Frame feels flimsy, not worth the price.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 185,
  },

  // Emma Wilson — 1 legitimate return
  {
    interactionId: "INT-4001",
    customerId: "C004",
    orderId: "ORD-4004",
    itemId: "I-4004",
    itemName: "Chunky Knit Throw",
    itemValue: 49,
    type: "return",
    claimDate: "2026-04-10",
    daysSinceDelivery: 21,
    reason: "color_mismatch",
    reasonText: "The sage green was much more yellow-green than the photo.",
    keptItem: false,
    resolution: "full_refund",
    amountCredited: 49,
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findCustomer(customerId: string): Customer | undefined {
  return CUSTOMERS.find((c) => c.customerId === customerId);
}

export function findOrder(orderId: string): Order | undefined {
  return ORDERS.find((o) => o.orderId === orderId);
}

export function getCustomerOrders(customerId: string): Order[] {
  return ORDERS.filter((o) => o.customerId === customerId);
}

export function getCustomerInteractions(customerId: string): ReturnInteraction[] {
  return RETURN_HISTORY.filter((r) => r.customerId === customerId);
}

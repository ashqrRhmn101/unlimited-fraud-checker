/**
 * A real fraud.bd response (captured while building the integration). Used for
 * the landing-page preview and the demo data — it never triggers an API call.
 */
export const SAMPLE_PHONE = "8801711124851";

export const SAMPLE_API_RESPONSE = {
  success: true,
  data: {
    phone: "01711124851",
    overall_stats: {
      total_orders: 130,
      total_delivered: 125,
      total_cancelled: 5,
      success_rate: 96,
    },
    advice: {
      type: "good",
      title: "পরামর্শ",
      message: "ফুল ক্যাশঅন ডেলিভারিতে পার্সেল দেওয়া যেতে পারে।",
      color: "text-green-500",
    },
    courier_breakdown: [
      { courier: "Steadfast", orders: 5, delivered: 5, returned: 0, cancelled: 0, unreached: 0, performance: 100 },
      { courier: "Pathao", orders: 23, delivered: 23, returned: 0, cancelled: 0, unreached: 0, performance: 100 },
      { courier: "Redx", orders: 90, delivered: 87, returned: 3, cancelled: 0, unreached: 0, performance: 97 },
      { courier: "SteadFast", orders: 9, delivered: 8, returned: 1, cancelled: 0, unreached: 0, performance: 89 },
      { courier: "PaperFly", orders: 3, delivered: 2, returned: 1, cancelled: 0, unreached: 0, performance: 67 },
    ],
    trust_tier: "Safe",
  },
} as const;

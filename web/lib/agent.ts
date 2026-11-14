/** Public catalogue of the merchant assistant's production data tools. */
export const TOOL_REGISTRY = [
  { name: "get_sales_summary", mode: "read" },
  { name: "search_bills", mode: "read" },
  { name: "get_inventory", mode: "read" },
  { name: "get_customer_purchase_summary", mode: "read" },
  { name: "get_item_sales_velocity", mode: "read" },
  { name: "calculate_stockout_forecast", mode: "read" },
] as const;

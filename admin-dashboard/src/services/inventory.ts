import { supabase } from "../lib/supabase";
import type { InventoryItem, InventoryOrder } from "../types/inventory";

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("created_at", { ascending: false });

  console.log("INVENTORY ITEMS:", data);
  console.log("INVENTORY ITEMS ERROR:", error);

  if (error) throw error;

  return (data || []).map(
    (item: any): InventoryItem => ({
      id: item.id,

      product: item.product_name,

      contact: "",

      currentQty: `${item.current_qty} ${item.unit}`,

      threshold: `${item.restock_threshold} ${item.unit}`,

      restockQty: `${item.restock_qty} ${item.unit}`,

      locationStatus: item.location ?? "",

      updatedAt: item.updated_at,
    })
  );
}

export async function getInventoryOrders(): Promise<InventoryOrder[]> {
  const { data, error } = await supabase
    .from("inventory_orders")
    .select("*")
    .order("requested_at", { ascending: false });

  console.log("INVENTORY ORDERS:", data);
  console.log("INVENTORY ORDERS ERROR:", error);

  if (error) throw error;

  // return (data || []).map(
  //   (order: any): InventoryOrder => ({
  //     id: order.id,

  //     itemName: "",

  //     quantity: order.quantity,

  //     status: order.status,

  //     requestedAt: order.requested_at,

  //     fulfilledAt: order.fulfilled_at,
  //   })
  // );

  return (data || []).map(
    (order: any): InventoryOrder => ({
      id: order.id,
      product: "",
      quantity: String(order.quantity ?? ""),
      status: order.status ?? "",
      requestedAt: order.requested_at,
      fulfilledAt: order.fulfilled_at,
    })
  );
}
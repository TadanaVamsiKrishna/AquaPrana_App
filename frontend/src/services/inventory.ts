import { supabase } from "../lib/supabase";

export async function saveInventoryItem(data: {
  name: string;
  unit: string;
  currentStock: number;
  restockThreshold: number;
  restockQuantity: number;
  location: string;
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User not logged in");
  }

  const { error } = await supabase
  .from("inventory_items")
  .insert({
    user_id: user.id,
    product_name: data.name,
    unit: data.unit,
    current_qty: data.currentStock,
    restock_threshold: data.restockThreshold,
    restock_qty: data.restockQuantity,
    location: data.location,
  });

  if (error) throw error;
}

export async function getInventoryItems() {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}


export async function restockInventoryItem(id: string) {
  const { data: item, error } = await supabase
    .from("inventory_items")
    .select("current_qty, restock_qty")
    .eq("id", id)
    .single();

  if (error) throw error;

  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({
      current_qty: Number(item.current_qty) + Number(item.restock_qty),
    })
    .eq("id", id);

  if (updateError) throw updateError;
}

export async function getInventoryItem(id: string) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  return data;
}


export async function updateInventoryItem(
  id: string,
  data: {
    product_name: string;
    unit: string;
    current_qty: number;
    restock_threshold: number;
    restock_qty: number;
    location: string;
  }
) {
  const { error } = await supabase
    .from("inventory_items")
    .update({
      product_name: data.product_name,
      unit: data.unit,
      current_qty: data.current_qty,
      restock_threshold: data.restock_threshold,
      restock_qty: data.restock_qty,
      location: data.location,
    })
    .eq("id", id);

  if (error) throw error;
}
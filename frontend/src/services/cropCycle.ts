// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { supabase } from "../lib/supabase";

import { supabase } from "@/lib/supabase";

export async function getCropCycleForPond(pondId: string) {
  const { data: activeCycle, error: activeError } = await supabase
    .from("crop_cycles")
    .select("id")
    .eq("pond_id", pondId)
    .eq("status", "active")
    .order("stocking_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) throw activeError;
  if (activeCycle) return activeCycle;

  const { data: latestCycle, error: latestError } = await supabase
    .from("crop_cycles")
    .select("id")
    .eq("pond_id", pondId)
    .order("stocking_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;
  return latestCycle;
}

// export async function createCropCycle(
//   pondId: string,
//   data: {
//     category: string;
//     species: string;
//     stockingDensity: number;
//     stockingDate: Date;
//     seedSupplier?: string;
//   }
// ){

//   // const pondId = await AsyncStorage.getItem("pond_id");

//   // if (!pondId) {
//   //   throw new Error("Pond ID not found");
//   // }

//   const { data: result, error } = await supabase
//     .from("crop_cycles")
//     .insert({
//       pond_id: pondId,
//       cycle_type: "new",
//       category: data.category,
//       species: data.species,
//       stocking_density: data.stockingDensity,
//       stocking_date: data.stockingDate.toISOString().split("T")[0],
//       seed_supplier: data.seedSupplier,
//       status: "active",
//     })
//     .select()
//     .single();

//   if (error) throw error;

//   return result;
// }

export async function createCropCycle(
  pondId: string,
  data: {
    category: string;
    species: string;
    stockingDensity: number;
    stockingDate: Date;
    seedSupplier?: string;
  }
) {
  console.log("pondId:", pondId);

  const { data: result, error } = await supabase
    .from("crop_cycles")
    .insert({
      pond_id: pondId,
      cycle_type: "new",
      category: data.category,
      species: data.species,
      stocking_density: data.stockingDensity,
      stocking_date: data.stockingDate.toISOString().split("T")[0],
      seed_supplier: data.seedSupplier,
      status: "active",
    })
    .select()
    .single();

  console.log("Inserted cycle:", result);
  console.log("Insert error:", error);

  if (error) throw error;

  return result;
}
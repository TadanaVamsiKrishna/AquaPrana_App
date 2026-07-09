// import { delay } from '../utils/helpers'
// import type { ExpenseRow } from '../types/pond'

// const expenses: ExpenseRow[] = [
//   {
//     id: 'e1',
//     pondName: 'PondScore Demo Alpha',
//     farmerName: 'Anirudh',
//     location: 'West Godavari, Andhra Pradesh',
//     species: 'Vannamei',
//     totalCost: 482500,
//     feedCost: 210000,
//     seedCost: 125000,
//     labourCost: 85000,
//     treatmentCost: 62500,
//     updatedAt: '2026-07-02T12:48:00',
//   },
//   {
//     id: 'e2',
//     pondName: 'My Pond',
//     farmerName: 'Anirudh',
//     location: 'West Godavari, Andhra Pradesh',
//     species: 'Vannamei',
//     totalCost: 318200,
//     feedCost: 140000,
//     seedCost: 90000,
//     labourCost: 52000,
//     treatmentCost: 36200,
//     updatedAt: '2026-06-28T09:10:00',
//   },
//   {
//     id: 'e3',
//     pondName: 'PondScore Demo Beta',
//     farmerName: 'Anirudh',
//     location: 'West Godavari, Andhra Pradesh',
//     species: 'Tiger',
//     totalCost: 868472,
//     feedCost: 390000,
//     seedCost: 250000,
//     labourCost: 140000,
//     treatmentCost: 88472,
//     updatedAt: '2026-07-01T16:20:00',
//   },
// ]

// export async function getExpenses(): Promise<ExpenseRow[]> {
//   await delay()
//   return expenses
// }


import { supabase } from "../lib/supabase";
import type { ExpenseRow } from "../types/pond";

export async function getExpenses(): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from("cycle_expenses")
    .select(`
      *,
      crop_cycles!cycle_expenses_cycle_id_fkey (
        species,
        ponds!crop_cycles_pond_id_fkey (
          name,
          users!ponds_user_id_fkey (
            name,
            district,
            state
          )
        )
      )
    `)
    .order("computed_at", { ascending: false });

  console.log("EXPENSE DATA:", data);
  console.log("EXPENSE ERROR:", error);

  if (error) throw error;

  return (data || []).map(
    (expense: any): ExpenseRow => ({
      id: expense.id,

      pondName:
        expense.crop_cycles?.ponds?.name ?? "",

      farmerName:
        expense.crop_cycles?.ponds?.users?.name ?? "",

      location:
        expense.crop_cycles?.ponds?.users
          ? `${expense.crop_cycles.ponds.users.district}, ${expense.crop_cycles.ponds.users.state}`
          : "",

      species:
        expense.crop_cycles?.species ?? "",

      totalCost: expense.total_cost ?? 0,

      feedCost: expense.feed_cost ?? 0,

      seedCost: expense.seed_cost ?? 0,

      labourCost: expense.labour_cost ?? 0,

      treatmentCost: expense.treatment_cost ?? 0,

      updatedAt: expense.computed_at,
    })
  );
}
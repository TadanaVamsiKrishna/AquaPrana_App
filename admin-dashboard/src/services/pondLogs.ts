// import { delay } from '../utils/helpers'
// import type { PondLog } from '../types/pond'

// const logs: PondLog[] = [
//   {
//     id: 'l1',
//     time: '2026-04-16T12:00:00',
//     pondName: 'PondScore Demo Alpha',
//     pondScore: 'Good Pondscore',
//     farmerName: 'Anirudh',
//     phone: '+918523055561',
//     doLevel: 6.2,
//     ph: 7.8,
//     temp: 29.2,
//     ammonia: 0.11,
//     feedKg: 25,
//     mortality: 2,
//     status: 'Stable',
//   },
//   {
//     id: 'l2',
//     time: '2026-04-16T09:30:00',
//     pondName: 'My Pond',
//     pondScore: 'Fair Pondscore',
//     farmerName: 'Anirudh',
//     phone: '+918523055561',
//     doLevel: 4.8,
//     ph: 8.1,
//     temp: 30.1,
//     ammonia: 0.28,
//     feedKg: 18,
//     mortality: 5,
//     status: 'Warning',
//   },
//   {
//     id: 'l3',
//     time: '2026-04-15T18:15:00',
//     pondName: 'PondScore Demo Beta',
//     pondScore: 'Good Pondscore',
//     farmerName: 'Anirudh',
//     phone: '+918523055561',
//     doLevel: 6.5,
//     ph: 7.6,
//     temp: 28.4,
//     ammonia: 0.09,
//     feedKg: 30,
//     mortality: 1,
//     status: 'Stable',
//   },
// ]

// export async function getPondLogs(): Promise<PondLog[]> {
//   await delay()
//   return logs
// }


import { supabase } from "../lib/supabase";
import type { PondLog } from "../types/pond";

export async function getPondLogs(): Promise<PondLog[]> {
  const { data, error } = await supabase
    .from("pond_logs")
    .select(`
      *,
      ponds!pond_logs_pond_id_fkey (
        name
      ),
      crop_cycles (
        id
      )
    `)
    .order("observed_at", { ascending: false });

  console.log("POND LOGS:", data);
  console.log("POND LOGS ERROR:", error);

  if (error) throw error;

  return (data || []).map(
    (log: any): PondLog => ({
      id: log.id,
      time: log.observed_at,

      pondName: log.ponds?.name ?? "",

      pondScore: "",

      farmerName: "",

      phone: "",

      doLevel: log.do_mgl ?? 0,

      ph: log.ph ?? 0,

      temp: log.temp_c ?? 0,

      ammonia: log.ammonia_mgl ?? 0,

      feedKg: log.feed_qty_kg ?? 0,

      mortality: log.mortality_count ?? 0,

      status: (log.mortality_count ?? 0) > 0 ? "Warning" : "Stable",
    })
  );
}

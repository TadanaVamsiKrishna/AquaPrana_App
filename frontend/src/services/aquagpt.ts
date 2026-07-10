import { supabase } from "../lib/supabase";

export async function askAquaGPT(
    question: string,
    pondId: string
  ) {
    const { data, error } =
      await supabase.functions.invoke(
        "aquagpt",
        {
          body: {
            question,
            pondId,
          },
        }
      );
  
    if (error) throw error;
  
    return data.answer;
  }
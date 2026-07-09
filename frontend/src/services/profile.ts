import { supabase } from "../lib/supabase";

export async function saveProfile(
  name: string,
  state: string,
  district: string,
  language: string
) {

  const {
    data:{user}
  } = await supabase.auth.getUser();

  return await supabase
      .from("users")
      .upsert({

        id:user?.id,

        phone:user?.phone,

        name,

        state,

        district,

        language

      });

}


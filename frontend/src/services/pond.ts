import { supabase } from "../lib/supabase";

export async function addPond(

    pond_name:string,

    area:number,

    depth:number,

    culture:string

){

const {

data:{user}

}=await supabase.auth.getUser();

return await supabase

.from("ponds")

.insert({

user_id:user?.id,

pond_name,

area,

depth,

culture

});

}


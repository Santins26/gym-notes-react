import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ymahhrqlqmrikyoaywoa.supabase.co";
const supabaseKey = "sb_publishable_ndPt4RNUaerBovPKWNxKEg_0cD6dExU";

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://shsfukzrtqwdhktwvljt.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc2Z1a3pydHF3ZGhrdHd2bGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MzA2NDMsImV4cCI6MjA5NDIwNjY0M30.kDjySwcd31f8ZiIEXkhPYiWV7_QG-36JrD9o-B-SiN8";

export const supabase = createClient(supabaseUrl, supabaseKey);
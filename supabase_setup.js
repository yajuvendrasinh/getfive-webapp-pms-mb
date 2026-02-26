// supabase_setup.js

const SUPABASE_URL = "https://ooytacbfpicvkfrthsax.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9veXRhY2JmcGljdmtmcnRoc2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTQ1NTYsImV4cCI6MjA4NzU3MDU1Nn0.ouPepi2oGq1HNuzJqRznjOS4iO0OnpRCM82TL5oXv88";

// Initialize Supabase Client
// Since we are loading via <script src="...">, 'supabase' is available globally from the UMD build.
// explicitly pass fetch to prevent SDK hangs in Chrome Extensions
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: window.localStorage,
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false
    },
    global: {
        fetch: (...args) => fetch(...args)
    }
});

// Make available globally for dashboard.js
window.supabaseClient = supabaseClient;

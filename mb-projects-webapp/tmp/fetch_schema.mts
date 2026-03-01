import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getSchema() {
    console.log("Fetching master_template...");
    const { data: mtData, error: mtError } = await supabase
        .from('master_template')
        .select('*')
        .limit(5);

    if (mtError) {
        console.error("Error fetching master_template:", mtError);
    } else {
        console.log(`Master Template Rows Found: ${mtData?.length}`);
        if (mtData && mtData.length > 0) {
            console.log("Master Template Columns:", Object.keys(mtData[0]));
            console.log("Sample Data:", mtData[0]);
        }
    }

    console.log("\nFetching tasks...");
    const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .limit(5);

    if (taskError) {
        console.error("Error fetching tasks:", taskError);
    } else {
        console.log(`Tasks Rows Found: ${taskData?.length}`);
        if (taskData && taskData.length > 0) {
            console.log("Tasks Columns:", Object.keys(taskData[0]));
            console.log("Sample Task Data:", taskData[0]);
        }
    }
}

getSchema();

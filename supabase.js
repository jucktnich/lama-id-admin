import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.86.0/+esm';

const supabaseUrl = 'https://supabase.lama-id.de'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzIxMjUzNjAwLAogICJleHAiOiAxODc5MDIwMDAwCn0.m5TdEY7e0ORCUNxKSDQSmRNjINgI6qIlyp38sCWlroE'

let supabase;

async function logUserInScript(servicekey, email, password) {
    if (servicekey) await logServiceKeyIn(servicekey)
    else await logEmailIn(email, password)
}

async function logServiceKeyIn(servicekey) {
    supabase = await createClient(supabaseUrl, servicekey);
    console.log('Supabase client started with service key', supabase);
}

async function logEmailIn(email, password) {
    supabase = await createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) throw new Error();
    console.log('Supabase client started with email', supabase)
}

export { supabase, logUserInScript };

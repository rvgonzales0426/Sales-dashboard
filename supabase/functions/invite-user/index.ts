// ============================================================================
// invite-user — Supabase Edge Function (Deno)
//
// Inviting a user needs the service-role key, which must never reach a browser.
// So the browser calls this function with the signed-in admin's JWT, the
// function verifies that the caller really is an admin, and only then uses the
// service-role client to send the invite and set the role.
//
// Deploy:  supabase functions deploy invite-user
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected
// by the platform — you do not set them yourself.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'You are not signed in.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Who is calling? This client runs as the caller, under RLS.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  })

  const { data: userResult, error: userError } = await caller.auth.getUser()
  if (userError || !userResult.user) return json({ error: 'You are not signed in.' }, 401)

  // 2. May they invite? Ask the database, never the request body.
  const { data: allowed, error: permissionError } = await caller.rpc('has_permission', {
    perm: 'users.invite',
  })
  if (permissionError) return json({ error: permissionError.message }, 500)
  if (!allowed) return json({ error: 'You do not have permission to invite people.' }, 403)

  // 3. Do the privileged work.
  let payload: { email?: string; role_key?: string; full_name?: string | null }
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Send a JSON body with an email address.' }, 400)
  }

  const email = payload.email?.trim()
  if (!email) return json({ error: 'An email address is required.' }, 400)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: payload.full_name ?? null },
    redirectTo: `${request.headers.get('origin') ?? url}/reset-password`,
  })

  if (inviteError) return json({ error: inviteError.message }, 400)

  // The signup trigger already created the profile with the default role.
  // Giving them a different one is a separate, deliberate step — and we look
  // the role up by key rather than trusting an id from the browser.
  if (payload.role_key && payload.role_key !== 'user' && invited.user) {
    const { data: role, error: roleLookupError } = await admin
      .from('roles')
      .select('id')
      .eq('key', payload.role_key)
      .maybeSingle()

    if (roleLookupError) return json({ error: roleLookupError.message }, 400)
    if (!role) return json({ error: `No role exists with the key "${payload.role_key}".` }, 400)

    const { error: updateError } = await admin
      .from('profiles')
      .update({ role_id: role.id })
      .eq('id', invited.user.id)

    if (updateError) return json({ error: updateError.message }, 400)
  }

  return json({ id: invited.user?.id, email })
})

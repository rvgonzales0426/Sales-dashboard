/**
 * Hand-written row types. If you prefer generated ones, run:
 *   supabase gen types typescript --project-id <ref> > src/types/database.gen.ts
 * and re-export from here.
 */

export interface Role {
  id: string
  /** Stable machine name used by has_role() and SYSTEM_ROLE_KEYS. */
  key: string
  label: string
  description: string | null
  /** Holds every permission implicitly. Cannot be granted rows individually. */
  is_superuser: boolean
  /** Built in — cannot be deleted or have its key changed. */
  is_system: boolean
  rank: number
  created_at: string
  updated_at: string
}

export interface Permission {
  key: string
  label: string
  description: string | null
  category: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  /** Joined by `select('*, role:roles(*)')`. Absent on queries that skip it. */
  role?: Role | null
}

/** Fields a user may change on their own profile. */
export type ProfileUpdate = Partial<Pick<Profile, 'full_name' | 'avatar_url'>>

/** Fields that need users.write, on anyone's profile. */
export type ProfileAdminUpdate = Partial<Pick<Profile, 'role_id' | 'is_active'>>

/** Fields the role editor can change. key is immutable on system roles. */
export type RoleUpsert = {
  key?: string
  label: string
  description: string | null
  rank: number
}

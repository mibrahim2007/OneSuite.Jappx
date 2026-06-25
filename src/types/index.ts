export interface JWTPayload {
  sub: string
  email: string
  tenant_id: string
  permissions: string[]
  role_ids: string[]
  iat: number
  exp: number
}

export interface RefreshTokenPayload {
  sub: string
  session_id: string
  iat: number
  exp: number
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export * from './database'

export interface Toast {
  id: number
  message: string
  variant: 'success' | 'error' | 'info'
  /** Optional single action, e.g. { label: 'Undo', handler: () => ... } */
  action?: { label: string; handler: () => void }
}

export interface NavItem {
  title: string
  icon: string
  to: string
  /** Omit to show the item to every signed-in user. */
  permissions?: readonly string[]
}

export interface Crumb {
  title: string
  to?: string
  disabled?: boolean
}

import type { Role } from './session'

export type ProjectAccent = 'accent' | 'forest' | 'clay'

export interface Project {
  id: string
  code: string
  name: string
  accent: ProjectAccent
}

/** A project as returned by the GET /api/projects list, with per-status bill counts. */
export interface ProjectSummary extends Project {
  pendingCount: number
  flaggedCount: number
  matchedCount: number
}

export type DeliveryStatus = 'PENDING' | 'REVIEW' | 'MATCHED'

/** One line of goods on a bill. */
export interface DeliveryItem {
  description: string
  quantity: number | null
  unit: string | null
  rate: number | null
  amount: number | null
}

export interface Delivery {
  id: number
  projectId: string
  vendor: string
  /** The item names joined: what lists show. */
  item: string
  items: DeliveryItem[]
  status: DeliveryStatus
  poNumber: string | null
  invoiceNumber: string | null
  /** YYYY-MM-DD, as printed on the bill. */
  billDate: string | null
  taxableAmount: number | null
  cgst: number | null
  sgst: number | null
  igst: number | null
  totalAmount: number | null
  ordered: number | null
  /** The items' quantities added up: what the office compares with the PO. */
  delivered: number | null
  quantityLowConfidence: boolean
  note: string | null
  photoUrl: string | null
  uploadedBy: string | null
  uploadedAt: string
  driveFileId: string | null
  driveWebViewLink: string | null
  driveSyncedAt: string | null
}

/** One value a save changed. Item fields are "items.2.quantity"; a whole row added or removed is "items.2". */
export interface BillChange {
  field: string
  from: string | number | null
  to: string | number | null
}

/** One save of a bill (GET /api/deliveries/<id>/changes; office and admin only). */
export interface BillHistoryEntry {
  id: number
  /** "sent": the supervisor sending it, with what they changed from the photo reading. "edited": an office save. */
  action: 'sent' | 'edited'
  fromReading: boolean
  changes: BillChange[]
  by: { name: string; role: Role }
  at: string
}

export interface AdminUser {
  id: number
  name: string
  initials: string
  role: Role
  phone: string
  createdAt: string
  projectsUploadedTo: number
  deliveryCount: number
}

export interface AdminOverview {
  userCounts: { supervisor: number; accountant: number; admin: number }
  projectCount: number
  deliveryCount: number
  pendingPasswordResets: number
}

export interface PasswordResetRequest {
  id: number
  status: 'PENDING' | 'RESOLVED'
  note: string | null
  createdAt: string
  resolvedAt: string | null
  user: { id: number; name: string; phone: string; role: Role }
  resolvedBy: string | null
}

export interface DriveStatus {
  configured: boolean
  connected: boolean
  account: {
    email: string
    connectedBy: string | null
    connectedAt: string
    sharedDriveId: string | null
    sharedDriveName: string | null
    rootFolderUrl: string | null
  } | null
}

export type NotificationKind = 'bill_new' | 'bill_flagged' | 'bill_matched' | 'password_reset'

export interface AppNotification {
  id: number
  kind: NotificationKind
  title: string
  body: string | null
  link: string | null
  createdAt: string
  read: boolean
}

/** GET /api/office/drive — read-only Drive links for accountants and admins. */
export interface OfficeDrive {
  connected: boolean
  email?: string
  sharedDriveName?: string | null
  rootFolderUrl?: string | null
  projectFolderUrls?: Record<string, string>
}

export interface SharedDrive {
  id: string
  name: string
}

export interface AdminDelivery extends Delivery {
  project: { code: string; name: string; accent: ProjectAccent }
}

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

export interface Delivery {
  id: number
  projectId: string
  vendor: string
  item: string
  status: DeliveryStatus
  poNumber: string | null
  ordered: number | null
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

import { db } from './db'
import type { Portfolio, PortfolioMember, FacilityKind } from '../types/facility'

function memberId(portfolioId: string, facilityId: string): string {
  return `${portfolioId}:${facilityId}`
}

export function facilityId(kind: FacilityKind, ccn: string): string {
  return `${kind}:${ccn}`
}

export async function listPortfolios(): Promise<Portfolio[]> {
  const rows = await db.portfolios.toArray()
  return rows.sort((a, b) => a.order - b.order)
}

export async function createPortfolio(name: string): Promise<Portfolio> {
  const count = await db.portfolios.count()
  const row: Portfolio = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    order: count
  }
  await db.portfolios.put(row)
  return row
}

export async function renamePortfolio(id: string, name: string): Promise<void> {
  const row = await db.portfolios.get(id)
  if (row) await db.portfolios.put({ ...row, name })
}

export async function deletePortfolio(id: string): Promise<void> {
  await db.transaction('rw', db.portfolios, db.portfolioMembers, async () => {
    await db.portfolios.delete(id)
    const members = await db.portfolioMembers.where('portfolioId').equals(id).toArray()
    await db.portfolioMembers.bulkDelete(members.map((m) => m.id))
  })
}

export async function listAllPortfolioMembers(): Promise<PortfolioMember[]> {
  return db.portfolioMembers.toArray()
}

export async function setFacilityInPortfolio(portfolioId: string, facId: string, inPortfolio: boolean): Promise<void> {
  const id = memberId(portfolioId, facId)
  if (inPortfolio) {
    const row: PortfolioMember = { id, portfolioId, facilityId: facId }
    await db.portfolioMembers.put(row)
  } else {
    await db.portfolioMembers.delete(id)
  }
}

export async function listPortfolioMemberIds(portfolioId: string): Promise<string[]> {
  const rows = await db.portfolioMembers.where('portfolioId').equals(portfolioId).toArray()
  return rows.map((r) => r.facilityId)
}

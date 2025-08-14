export function getStatusAfterPaid(paid: boolean, currentStatus: string) {
  return paid && currentStatus === 'pending' ? 'confirmed' : currentStatus
}

import { mutateStaff, stockChanged } from './staffStore'

export const messageStatus = { RECEIVED: 'Received', QUEUED_DEMO: 'Queued locally', SENT_DEMO: 'Sent · demo', DELIVERED_DEMO: 'Delivered · demo', FAILED_DEMO: 'Failed · demo' }
function find(items, id) { const item = items.find(row => row.id === id); if (!item) throw new Error('This record is no longer available. Refresh the list.'); return item }
function unchanged(item, expected) { if (JSON.stringify(item) !== expected) throw new Error('This record changed. Close and reopen it before continuing.') }
function text(value, maximum = 1000) { if (!value?.trim() || value.length > maximum) throw new Error(`Enter a note of up to ${maximum.toLocaleString()} characters.`); return value.trim() }

export function sendSupportReply(id, body, attachments, requestId) {
  return mutateStaff(['conversations:read', 'conversations:reply'], 'Conversation reply queued', state => {
    const chat = find(state.conversations, id)
    if (typeof requestId !== 'string' || !requestId) throw new Error('Refresh the reply composer before sending again.')
    if (chat.messages.some(message => message.requestId === requestId)) return
    if (!body.trim() && !attachments.length) throw new Error('Write a reply or attach a file.')
    if (body.length > 2000 || attachments.length > 3) throw new Error('Use up to 2,000 characters and 3 attachments.')
    const safe = attachments.map(file => {
      if (!file.name || file.name.length > 180 || file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'application/pdf', 'text/plain'].includes(file.type) || !file.url.startsWith(`data:${file.type};base64,`) || file.url.length > 1500000) throw new Error('Use PNG, JPEG, PDF or text attachments of up to 1 MB each.')
      return { name: file.name, size: file.size, type: file.type, url: file.url }
    })
    chat.messages.push({ id: crypto.randomUUID(), requestId, direction: 'OUTBOUND', text: body.trim(), attachments: safe, status: 'QUEUED_DEMO', at: new Date().toISOString() })
    chat.unread = 0
  })
}
export function progressSupportReply(chatId, messageId) {
  return mutateStaff(['conversations:read', 'conversations:reply'], 'Local message delivery advanced', state => {
    const message = find(find(state.conversations, chatId).messages, messageId)
    const next = { FAILED_DEMO: 'QUEUED_DEMO', QUEUED_DEMO: 'SENT_DEMO', SENT_DEMO: 'DELIVERED_DEMO' }[message.status]
    if (!next || message.direction !== 'OUTBOUND') throw new Error('This message cannot be advanced.')
    message.status = next; delete message.error
  })
}
export function receiveReturn(id, reference, expected) {
  return mutateStaff(['returns:read', 'returns:process'], 'Returned goods received', state => {
    const item = find(state.returns, id); unchanged(item, expected)
    if (item.status !== 'AWAITING_RECEIPT') throw new Error('This return has already been received.')
    item.receiptReference = text(reference, 150); item.status = 'RECEIVED'; item.receivedAt = new Date().toISOString()
    item.history.push({ at: item.receivedAt, action: 'Return received', actor: 'Staff demo', note: item.receiptReference })
  })
}
export function inspectReturn(id, input, expected) {
  return mutateStaff(['returns:read', 'returns:process'], 'Returned goods inspected', state => {
    const item = find(state.returns, id); unchanged(item, expected)
    if (item.status !== 'RECEIVED') throw new Error('Receive the goods before recording an inspection.')
    if (!['UNOPENED', 'GOOD', 'DAMAGED'].includes(input.condition)) throw new Error('Choose the returned goods condition.')
    if (!input.video?.name || !['video/mp4', 'video/webm', 'video/quicktime'].includes(input.video.type) || !Number.isSafeInteger(input.video.size) || input.video.size < 1 || input.video.size > 20 * 1024 * 1024) throw new Error('Select an MP4, WebM or MOV inspection video, up to 20 MB.')
    item.inspection = { condition: input.condition, notes: text(input.notes), video: { name: input.video.name.slice(0, 180), type: input.video.type, size: input.video.size }, at: new Date().toISOString() }
    item.history.push({ at: item.inspection.at, action: 'Inspection recorded', actor: 'Staff demo', note: `${input.condition} · ${item.inspection.video.name}` })
  })
}
export function restockReturn(id, destination, expected) {
  return mutateStaff(['returns:read', 'returns:process', 'inventory:receive'], 'Returned goods restocked', state => {
    const item = find(state.returns, id); unchanged(item, expected)
    if (item.status !== 'RECEIVED' || !item.inspection) throw new Error('Receive and inspect these goods before restocking.')
    if (!['SELLABLE', 'QUARANTINE'].includes(destination) || (destination === 'SELLABLE' && item.inspection.condition === 'DAMAGED')) throw new Error('Damaged goods must go to quarantined stock.')
    const row = state.inventory.find(entry => entry.sku === item.sku && entry.warehouseId === item.warehouseId)
    if (!row) throw new Error('This SKU and warehouse need a valid inventory record.')
    if (destination === 'SELLABLE') {
      const before = row.onHand
      if (!Number.isSafeInteger(row.onHand + item.quantity)) throw new Error('The returned quantity would exceed the supported stock limit.')
      row.onHand += item.quantity
      state.stockLedger.unshift({ id: crypto.randomUUID(), sku: item.sku, warehouseId: item.warehouseId, delta: item.quantity, before, after: row.onHand, kind: 'RETURN', reason: item.id, at: new Date().toISOString() })
      stockChanged(state, row)
    } else state.quarantine.push({ id: crypto.randomUUID(), returnId: id, sku: item.sku, warehouseId: item.warehouseId, quantity: item.quantity, condition: item.inspection.condition, at: new Date().toISOString() })
    item.status = 'RESTOCKED'; item.destination = destination
    item.history.push({ at: new Date().toISOString(), action: `Restocked to ${destination.toLowerCase()}`, actor: 'Staff demo', note: `${item.quantity} unit(s) · ${item.warehouseId}` })
  })
}
export function resolveComplaint(id, note, expected) {
  return mutateStaff(['complaints:read', 'complaints:resolve'], 'Complaint resolved', state => {
    const item = find(state.complaints, id); unchanged(item, expected)
    if (item.status === 'RESOLVED') throw new Error('This complaint has already been resolved.')
    item.resolution = text(note); item.resolvedAt = new Date().toISOString(); item.status = 'RESOLVED'
    item.history.push({ at: item.resolvedAt, action: 'Complaint resolved', actor: 'Staff demo', note: item.resolution })
  })
}

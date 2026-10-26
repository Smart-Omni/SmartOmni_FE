export function createSupportFixture() {
  return {
    conversations: [
      { id: 'chat-anh', customer: 'Minh Anh', platform: 'shopee', orderId: 'ST-201', unread: 1, messages: [
        { id: 'msg-1', direction: 'INBOUND', text: 'Could you confirm the colour of my tote before shipping?', at: '2026-10-26T02:30:00Z', status: 'RECEIVED', attachments: [] },
        { id: 'msg-2', direction: 'OUTBOUND', text: 'Your order is for the Natural tote. Here is the product reference.', at: '2026-10-26T02:35:00Z', status: 'DELIVERED_DEMO', attachments: [{ name: 'Natural tote reference', type: 'image/png', url: '/images/product/tote.png' }] },
      ] },
      { id: 'chat-bao', customer: 'Bao Tran', platform: 'shopee', orderId: 'ST-204', unread: 1, messages: [
        { id: 'msg-3', direction: 'INBOUND', text: 'My mug arrived with a crack. I would like to return it.', at: '2026-10-26T03:00:00Z', status: 'RECEIVED', attachments: [] },
        { id: 'msg-4', direction: 'OUTBOUND', text: 'Please keep the packaging while we review the return request.', at: '2026-10-26T03:05:00Z', status: 'FAILED_DEMO', error: 'Sample delivery failure. Retry after reviewing your reply.', attachments: [] },
      ] },
      { id: 'chat-ha', customer: 'Thanh Ha', platform: 'tiktok', orderId: 'ST-203', unread: 0, messages: [
        { id: 'msg-5', direction: 'INBOUND', text: 'Where can I find tracking information?', at: '2026-10-25T07:00:00Z', status: 'RECEIVED', attachments: [] },
      ] },
    ],
    returns: [
      { id: 'RET-104', orderId: 'ST-204', customer: 'Bao Tran', platform: 'shopee', sku: 'MUG-SND-02', warehouseId: 'WH-HCM', quantity: 1, reason: 'Cracked item on arrival', status: 'AWAITING_RECEIPT', at: '2026-10-26T03:10:00Z', inspection: null, history: [] },
      { id: 'RET-098', orderId: 'ST-190', customer: 'Linh Pham', platform: 'tiktok', sku: 'TOTE-NAT-01', warehouseId: 'WH-HCM', quantity: 1, reason: 'Unopened item · historical sample order', status: 'RECEIVED', receivedAt: '2026-10-25T08:00:00Z', at: '2026-10-25T07:00:00Z', inspection: null, history: [{ action: 'Return received', at: '2026-10-25T08:00:00Z', actor: 'Sample warehouse staff' }] },
    ],
    quarantine: [],
    complaints: [
      { id: 'CMP-104', customer: 'Bao Tran', orderId: 'ST-204', category: 'Damaged product', confidence: 0.94, basis: 'Message mentions a crack and a return request.', text: 'My mug arrived with a crack. I would like to return it.', priority: 'High', status: 'OPEN', at: '2026-10-26T03:00:00Z', resolution: '', history: [] },
      { id: 'CMP-103', customer: 'Thanh Ha', orderId: 'ST-203', category: 'Delivery question', confidence: 0.86, basis: 'Message asks for tracking information.', text: 'Where can I find tracking information?', priority: 'Normal', status: 'OPEN', at: '2026-10-25T07:00:00Z', resolution: '', history: [] },
      { id: 'CMP-090', customer: 'Quang Nguyen', orderId: 'ST-202', category: 'Product information', confidence: 0.91, basis: 'Customer asked about product dimensions.', text: 'Thank you for confirming the dimensions.', priority: 'Normal', status: 'RESOLVED', at: '2026-10-24T04:00:00Z', resolution: 'Shared the dimensions and customer confirmed receipt.', resolvedAt: '2026-10-24T05:00:00Z', history: [] },
    ],
    disputes: [
      { id: 'DSP-104', orderId: 'ST-204', customer: 'Bao Tran', platform: 'shopee', status: 'EVIDENCE_REQUIRED', deadline: '2026-10-29', amount: 229000, summary: 'Customer reported damage on delivery.', timeline: [{ at: '2026-10-26T03:10:00Z', title: 'Dispute opened', detail: 'Sample marketplace snapshot.' }, { at: '2026-10-26T03:20:00Z', title: 'Evidence requested', detail: 'Review the inspection video and return condition before responding on the marketplace.' }] },
      { id: 'DSP-080', orderId: 'ST-180', customer: 'Mai Tran', platform: 'tiktok', status: 'CLOSED', deadline: null, amount: 349000, summary: 'Historical delivery dispute resolved.', timeline: [{ at: '2026-10-20T02:00:00Z', title: 'Review completed', detail: 'Sample closed case; no live marketplace action.' }] },
    ],
  }
}

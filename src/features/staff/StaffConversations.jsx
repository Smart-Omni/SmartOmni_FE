import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Feedback, OwnerPanel } from '@/features/portal/components/OwnerWorkspaceUI'
import { messageStatus, progressSupportReply, sendSupportReply } from './lib/supportStore'
import styles from '@/features/portal/OwnerWorkspace.module.css'
import support from './StaffSupport.module.css'

const readFile = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, url: reader.result }); reader.onerror = () => reject(new Error('Could not read this attachment. Try another file.')); reader.readAsDataURL(file) })
export default function StaffConversations({ data, session }) {
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('ALL')
  const [selected, setSelected] = useState(data.conversations[0]?.id)
  const chats = data.conversations.filter(chat => `${chat.customer} ${chat.orderId}`.toLowerCase().includes(query.toLowerCase()) && (platform === 'ALL' || chat.platform === platform))
  const chat = chats.find(item => item.id === selected)
  return <><OwnerPanel title="Customer inbox"><div className={styles.filters}><label className={styles.field}>Search conversations<input type="search" placeholder="Customer or order ID" value={query} onChange={event => setQuery(event.target.value)} /></label><label className={styles.field}>Conversation marketplace<select value={platform} onChange={event => setPlatform(event.target.value)}><option value="ALL">All marketplaces</option><option value="shopee">Shopee</option><option value="tiktok">TikTok Shop</option></select></label></div><p>Sample customer conversations. Replies and delivery states stay in this browser.</p></OwnerPanel><div className={support.inbox}><label className={`${styles.field} ${support.mobileThreadPicker}`}>Customer conversation<select aria-label="Customer conversation" value={chat?.id || ""} onChange={event => setSelected(event.target.value)}><option value="">Choose a conversation</option>{chats.map(item => <option key={item.id} value={item.id}>{item.customer} · {item.orderId}</option>)}</select></label><nav className={support.threads} aria-label="Conversations">{chats.map(item => <button key={item.id} className={support.thread} aria-pressed={chat?.id === item.id} onClick={() => setSelected(item.id)}><strong>{item.customer}</strong><span>{item.platform} · {item.orderId}{item.unread ? ` · ${item.unread} unread` : ''}</span><span>{item.messages.at(-1)?.text}</span></button>)}</nav>{chat ? <Conversation key={chat.id} chat={chat} session={session} /> : <OwnerPanel title={chats.length ? 'Choose a conversation' : 'No matching conversations'}><p>{chats.length ? 'Select a customer to read their messages and attachments.' : 'Try another customer name or marketplace.'}</p><Button variant="outline" onClick={() => { setQuery(''); setPlatform('ALL'); setSelected(data.conversations[0]?.id) }}>Reset inbox filters</Button></OwnerPanel>}</div></>
}
function Conversation({ chat, session }) {
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState([])
  const [reading, setReading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const canReply = session.permissions.includes('conversations:reply')
  async function attach(event) {
    const files = [...event.target.files]; event.target.value = ''
    setFeedback(null)
    if (files.length + attachments.length > 3 || files.some(file => file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'application/pdf', 'text/plain'].includes(file.type))) { setFeedback({ error: true, message: 'Use up to 3 PNG, JPEG, PDF or text files, each at most 1 MB.' }); return }
    setReading(true)
    try { const added = await Promise.all(files.map(readFile)); setAttachments(current => [...current, ...added]) } catch (error) { setFeedback({ error: true, message: error.message }) } finally { setReading(false) }
  }
  function submit(event) {
    event.preventDefault()
    try { sendSupportReply(chat.id, draft, attachments, requestId); setDraft(''); setAttachments([]); setRequestId(crypto.randomUUID()); setFeedback({ message: 'Reply queued locally. Advance its demo delivery status below.' }) } catch (error) { setFeedback({ error: true, message: error.message }) }
  }
  function progress(messageId) { try { progressSupportReply(chat.id, messageId); setFeedback(null) } catch (error) { setFeedback({ error: true, message: error.message }) } }
  return <OwnerPanel title={`${chat.customer} · ${chat.orderId}`}><p>{chat.platform === 'shopee' ? 'Shopee' : 'TikTok Shop'} · Conversation {chat.id}</p><div className={support.messages} role="log" aria-label="Conversation messages" aria-live="polite">{chat.messages.map(message => <article key={message.id} className={`${support.message} ${message.direction === 'OUTBOUND' ? support.outbound : ''}`}><strong>{message.direction === 'OUTBOUND' ? 'Your team' : chat.customer}</strong><p>{message.text}</p>{message.attachments.map((file, index) => <div key={`${file.name}-${index}`}>{file.type.startsWith('image/') && <img src={file.url} alt={file.name} />}<a href={file.url} download={file.name}>{file.name}</a></div>)}<span className={support.meta}>{new Date(message.at).toLocaleString('en-GB')} · {messageStatus[message.status]}</span>{message.error && <p className={styles.error}>{message.error}</p>}{canReply && ['QUEUED_DEMO', 'SENT_DEMO', 'FAILED_DEMO'].includes(message.status) && <div><Button variant="outline" onClick={() => progress(message.id)}>{message.status === 'FAILED_DEMO' ? 'Retry demo reply' : message.status === 'QUEUED_DEMO' ? 'Mark sent in demo' : 'Mark delivered in demo'}</Button></div>}</article>)}</div>{canReply ? <form className={styles.form} onSubmit={submit}><label className={styles.field}>Reply<textarea maxLength={2000} placeholder="Write a reply to this customer" value={draft} onChange={event => setDraft(event.target.value)} /></label><label className={styles.field}>Attach files<input type="file" multiple disabled={reading} accept="image/png,image/jpeg,application/pdf,text/plain" onChange={attach} /></label><p className={styles.note}>Up to 3 files · 1 MB each · local browser storage only.</p>{attachments.length > 0 && <ul className={styles.list}>{attachments.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><Button type="button" variant="ghost" onClick={() => setAttachments(attachments.filter((_, at) => at !== index))}>Remove {file.name}</Button></li>)}</ul>}<div className={styles.actions}><Button type="submit" disabled={reading || (!draft.trim() && !attachments.length)}>{reading ? 'Reading attachments…' : 'Queue demo reply'}</Button></div></form> : <p>Your current permissions allow reading only. Ask the Owner for reply access.</p>}<Feedback value={feedback} /></OwnerPanel>
}

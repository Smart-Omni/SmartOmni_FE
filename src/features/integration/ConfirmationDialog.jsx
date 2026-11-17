import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Feedback } from '@/features/portal/components/OwnerWorkspaceUI'
import { useApiAction } from './apiHelpers'
import styles from '@/features/portal/OwnerWorkspace.module.css'

export function ConfirmationDialog({ title, description, submit, close, done }) {
  const action = useApiAction()
  return <Dialog open onOpenChange={open => { if (!open && !action.busy) close() }}>
    <DialogContent className={styles.dialog} showCloseButton={!action.busy}>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <Feedback value={action.feedback} />
      <div className={styles.actions}>
        <Button variant="secondary" onClick={close} disabled={action.busy}>Back</Button>
        <Button onClick={() => action.run(submit, 'Saved.', done)} disabled={action.busy}>{action.busy ? 'Saving…' : 'Confirm'}</Button>
      </div>
    </DialogContent>
  </Dialog>
}

import { useCallback, useEffect, useState } from 'react'

export function useApiResource(loader) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ data: null, error: '', loader: null, revision: -1 })
  const reload = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    loader(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, error: '', loader, revision })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ data: null, error: error.message, errorStatus: error.status, loader, revision })
    })
    return () => controller.abort()
  }, [loader, revision])
  const loading = state.loader !== loader || state.revision !== revision
  return { data: loading ? null : state.data, error: loading ? '' : state.error, errorStatus: loading ? undefined : state.errorStatus, loading, reload }
}

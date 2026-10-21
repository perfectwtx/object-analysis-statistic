import { useEffect, useRef } from 'react';
import { createLatestRequest } from '../lib/latest-request.js';

export function useLatestRequest() {
  const ref = useRef(null);
  if (!ref.current) ref.current = createLatestRequest();
  useEffect(() => () => ref.current.cancel(), []);
  return ref.current;
}

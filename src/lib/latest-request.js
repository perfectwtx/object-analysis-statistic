// AbortController 负责节约请求，序号负责隔离不遵守 signal 的响应和 Promise 回调。
export function createLatestRequest() {
  let controller, generation = 0;
  function cancel() { generation++; controller?.abort(); controller = null; }
  return {
    cancel,
    async run(execute, { onStart, onSuccess, onError, onFinally } = {}) {
      cancel();
      const own = generation;
      controller = new AbortController();
      const signal = controller.signal;
      onStart?.();
      try {
        const data = await execute(signal);
        if (own === generation) onSuccess?.(data);
      } catch (e) {
        if (own === generation && !signal.aborted) onError?.(e);
      } finally {
        if (own === generation) { controller = null; onFinally?.(); }
      }
    },
  };
}

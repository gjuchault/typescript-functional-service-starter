export function promiseWithTimeout<T>(
  timeoutMs: number,
  promise: () => Promise<T>
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error("Promise timed out")),
      timeoutMs
    );
  });

  return Promise.race([promise(), timeoutPromise]).then((result) => {
    clearTimeout(timeoutHandle);
    return result;
  });
}

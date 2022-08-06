import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

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

type ResultPromise<E, A> =
  | {
      readonly _tag: "Timeout";
    }
  | E.Either<E, A>;

export function taskEitherWithTimeout<E, A>(
  timeoutMs: number
): (callback: TE.TaskEither<E, A>) => TE.TaskEither<Error, A> {
  return function (callback: TE.TaskEither<E, A>) {
    return async function () {
      let timeoutHandle: NodeJS.Timeout;

      const timeoutPromise = new Promise<ResultPromise<E, A>>((resolve) => {
        timeoutHandle = setTimeout(
          () => resolve({ _tag: "Timeout" }),
          timeoutMs
        );
      });

      return Promise.race([callback(), timeoutPromise]).then((result) => {
        clearTimeout(timeoutHandle);

        switch (result._tag) {
          case "Timeout":
            return E.left(new Error("Promise timed out"));
          case "Left":
            return E.left(E.toError(result));
          case "Right":
            return E.right(result.right);
        }
      });
    };
  };
}

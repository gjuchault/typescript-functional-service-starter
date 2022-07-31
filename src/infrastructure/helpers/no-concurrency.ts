import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

export function noConcurrency<E, A>(): (
  callback: TE.TaskEither<E, A>
) => TE.TaskEither<E, O.Option<A>> {
  let isRunning = false;

  return (callback: TE.TaskEither<E, A>) => {
    return async function () {
      if (isRunning) {
        return E.right(O.none);
      }

      isRunning = true;

      const result = await callback();

      isRunning = false;

      return pipe(
        result,
        E.map((element) => O.of(element))
      );
    };
  };
}

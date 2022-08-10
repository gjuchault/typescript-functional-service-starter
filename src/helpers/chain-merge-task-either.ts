import * as Apply from "fp-ts/Apply";
import * as R from "fp-ts/Record";
import * as TE from "fp-ts/TaskEither";

type EnforceNonEmptyRecord<R> = keyof R extends never ? never : R;

export const chainMergeTaskEither = <
  A extends Record<string, unknown>,
  B extends Record<string, unknown>
>(
  o: (a: A) => {
    readonly [K in keyof B]: TE.TaskEither<Error, B[K]>;
  }
): ((ma: TE.TaskEither<Error, A>) => TE.TaskEither<Error, A & B>) =>
  TE.chain((a: A) => {
    return Apply.sequenceS(TE.ApplyPar)({
      ...R.map((v) => TE.of(v))(a),
      ...o(a),
    } as EnforceNonEmptyRecord<
      {
        readonly [K in keyof B]: TE.TaskEither<Error, B[K]>;
      } & {
        readonly [K in keyof A]: TE.TaskEither<Error, A[K]>;
      }
    >);
  }) as (ma: TE.TaskEither<Error, A>) => TE.TaskEither<Error, A & B>;

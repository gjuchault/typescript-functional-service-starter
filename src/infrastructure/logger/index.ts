import * as IO from "fp-ts/lib/IO";
import { pino, Logger as PinoLogger } from "pino";
import type { Config } from "../../config";
import { pinoMixin as telemetryMixin } from "../telemetry/instrumentations/pino";

export interface Logger {
  readonly fatal: (message: string, payload?: unknown) => IO.IO<void>;
  readonly error: (message: string, payload?: unknown) => IO.IO<void>;
  readonly warn: (message: string, payload?: unknown) => IO.IO<void>;
  readonly info: (message: string, payload?: unknown) => IO.IO<void>;
  readonly debug: (message: string, payload?: unknown) => IO.IO<void>;
  readonly trace: (message: string, payload?: unknown) => IO.IO<void>;
  readonly silent: (message: string, payload?: unknown) => IO.IO<void>;
  readonly flush: () => IO.IO<void>;
}

export function createLogger(
  serviceName: string,
  { config }: { config: Config }
): Logger {
  const logger = pino({
    name: "app",
    level: config.logLevel,
    formatters: {
      // format level as string instead of number
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin: telemetryMixin,
  }).child({
    serviceName,
  });

  return makePinoFunctionalWrapper(logger);
}

function makePinoFunctionalWrapper(logger: PinoLogger) {
  return {
    fatal(message: string, payload?: unknown) {
      return () => logger.fatal(payload, message);
    },

    error(message: string, payload?: unknown) {
      return () => logger.error(payload ?? {}, message);
    },

    warn(message: string, payload?: unknown) {
      return () => logger.warn(payload ?? {}, message);
    },

    info(message: string, payload?: unknown) {
      return () => logger.info(payload ?? {}, message);
    },

    debug(message: string, payload?: unknown) {
      return () => logger.debug(payload ?? {}, message);
    },

    trace(message: string, payload?: unknown) {
      return () => logger.trace(payload ?? {}, message);
    },

    silent(message: string, payload?: unknown) {
      return () => logger.silent(payload ?? {}, message);
    },

    flush() {
      return () => logger.flush();
    },
  };
}

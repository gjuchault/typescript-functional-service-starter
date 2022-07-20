import { pino, Logger as PinoLogger } from "pino";
import { getConfig } from "../../config";
import { pinoMixin as telemetryMixin } from "../telemetry/instrumentations/pino";

export type Logger = PinoLogger;

export function createLogger(serviceName: string): Logger {
  const { logLevel } = getConfig();

  const logger = pino({
    name: "app",
    level: logLevel,
    formatters: {
      // format level as string instead of number
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    hooks: {
      // reverse pino method so it goes logger.method(message, details) instead
      // of logger.method(details, message)
      logMethod(inputArguments: unknown[], method) {
        if (inputArguments.length >= 2) {
          const argument1 = inputArguments[0];
          const argument2 = inputArguments[1];
          return Reflect.apply(method, this, [
            argument2,
            argument1,
            ...inputArguments.slice(2),
          ]) as unknown;
        }

        return method.apply(this, inputArguments as [string, ...unknown[]]);
      },
    },
    mixin: telemetryMixin,
  });

  return logger.child({
    serviceName,
  });
}

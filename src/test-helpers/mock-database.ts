import { ClientConfiguration, createMockPool, MockPoolOverrides } from "slonik";
import { wrapSlonikAsFunctional } from "../infrastructure/database";

export function createMockDatabase(
  overrides: MockPoolOverrides,
  clientConfigurationInput?: Partial<ClientConfiguration>
) {
  const mockPool = createMockPool(overrides, clientConfigurationInput);

  return wrapSlonikAsFunctional(mockPool);
}

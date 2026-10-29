import { DemoVaultGateway } from "./demo-gateway";
import { isTauriRuntime, TauriVaultGateway, type VaultGateway } from "./vault-client";

export function createVaultGateway(): VaultGateway {
  return isTauriRuntime() ? new TauriVaultGateway() : new DemoVaultGateway();
}

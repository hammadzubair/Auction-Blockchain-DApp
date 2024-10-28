import { C, Lucid, Credential, Network } from "https://deno.land/x/lucid@0.10.7/src/mod.ts";

export function addressFromPaymentCredential(
  paymentCredential: Credential,
  network: Network,
  stakeCredential?: Credential,
): Address {
  return C.BaseAddress.new(
    networkToId(network),
    paymentCredential.type === "Key"
      ? C.StakeCredential.from_keyhash(C.Ed25519KeyHash.from_hex(paymentCredential.hash))
      : C.StakeCredential.from_scripthash(C.ScriptHash.from_hex(paymentCredential.hash)),
    stakeCredential?.type === "Key"
      ? C.StakeCredential.from_keyhash(C.Ed25519KeyHash.from_hex(stakeCredential.hash))
      : stakeCredential?.type === "Script"
      ? C.StakeCredential.from_scripthash(C.ScriptHash.from_hex(stakeCredential.hash))
      : undefined,
  )
    .to_address()
    .to_bech32(undefined);
}
  
function networkToId(network: Network): number {
  switch (network) {
    case "Preview":
    case "Preprod":
    case "Custom":
      return 0;
    case "Mainnet":
      return 1;
    default:
      throw new Error("Network not found");
  }
}
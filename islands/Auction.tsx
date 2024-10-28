import { useState } from "preact/hooks";
import { Blockfrost, Lucid } from "lucid/mod.ts";
import Seller from "./Seller.tsx";
import Bidder from "./Bidder.tsx";
import { Input } from "../components/Input.tsx";
import { Button } from "../components/Button.tsx";

export default function Auction() {
  const [role, setRole] = useState<"seller" | "bidder" | null>(null);
  const [blockfrostAPIKey, setBlockfrostAPIKey] = useState<string>("");
  const [lucid, setLucid] = useState<Lucid | null>(null);

  const setupLucid = async (e: Event) => {
    e.preventDefault();

    try {
      if (!window.cardano || !window.cardano.eternl) {
        throw new Error(
          "Eternl wallet extension is not available. Please ensure it is installed and enabled.",
        );
      }

      const lucidInstance = await Lucid.new(
        new Blockfrost(
          "https://cardano-preview.blockfrost.io/api/v0",
          blockfrostAPIKey,
        ),
        "Preview",
      );

      const api = await window.cardano.eternl.enable();
      if (!api.getUtxos) {
        throw new Error("Eternl wallet API does not support getUtxos method.");
      }
      lucidInstance.selectWallet(api);
      console.log("walletapi fetch from broweser and and set into lucid:", api);

      setLucid(lucidInstance);
      console.log("initialize Lucid:", lucidInstance);
    } catch (error) {
      console.error("Failed to initialize Lucid:", error);
    }
  };

  return (
    <div>
      {!lucid
        ? (
          <form class="mt-10 grid grid-cols-1 gap-y-8" onSubmit={setupLucid}>
            <Input
              type="text"
              id="blockfrostAPIKey"
              onInput={(e) => setBlockfrostAPIKey(e.currentTarget.value)}
            >
              Blockfrost API Key
            </Input>

            <Button type="submit">Setup Lucid</Button>
          </form>
        )
        : (
          <>
            {!role && (
              <div class="mt-10 grid grid-cols-1 gap-y-8">
                <Button onClick={() => setRole("seller")}>I am a Seller</Button>
                <Button onClick={() => setRole("bidder")}>I am a Bidder</Button>
              </div>
            )}

            {role === "seller" && <Seller lucid={lucid} />}
            {role === "bidder" && <Bidder lucid={lucid} />}
          </>
        )}
    </div>
  );
}

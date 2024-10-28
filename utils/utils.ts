import {
  applyDoubleCborEncoding,
  applyParamsToScript,
  fromText,
  Lucid,
  SpendingValidator,
} from "lucid/mod.ts";  


//import * as lucid from "https://deno.land/x/lucid@0.10.7/mod.ts";

import blueprint from "../plutus.json" assert { type: "json" };

export type Validators = {
  auction: SpendingValidator;
};

export function readValidators(): Validators {
  const auction = blueprint.validators.find((v) =>
    v.title === "auction.auction"
  );

  if (!auction) {
    throw new Error("Auction validator not found");
  }

  return {
    auction: {
      type: "PlutusV2",
      script: auction.compiledCode,
    },
  };
}

export type AppliedValidators = {
  auction: SpendingValidator;
  auctionAddress: string;
};

export function applyParams(
  object: string,
  deadline: number,
  validators: Validators,
  lucid: Lucid,
): AppliedValidators {
  const auction = applyParamsToScript(validators.auction.script, [
    fromText(object),
    BigInt(deadline),
  ]);

  const auctionAddress = lucid.utils.validatorToAddress({
    type: "PlutusV2",
    script: auction,
  });

  return {
    auction: { type: "PlutusV2", script: applyDoubleCborEncoding(auction) },
    auctionAddress,
  };
}

import { Head } from "$fresh/runtime.ts";
import Auction from "../islands/Auction.tsx";
import { readValidators, Validators} from "../utils/utils.ts";
import { Handlers, PageProps } from "$fresh/server.ts";


interface Data {
  validators: Validators;
}

export const handler: Handlers<Data> = {
  GET(_req, ctx) {
    const validators = readValidators();
    return ctx.render({ validators });
  },
};


export default function Home({ data }: PageProps<Data>) {
  const { validators } = data;

  return (
    <>
      <Head>
        <title>Auction</title>
      </Head>

      <div class="max-w-2xl mx-auto mt-20 mb-10">
        <div class="mb-10">
          <h2 class="text-lg font-semibold text-gray-900">
            Auction Contract
          </h2>

          <h3 class="mt-4 mb-2">Auction Validator</h3>
          <pre class="bg-gray-200 p-2 rounded overflow-x-scroll">
            {validators.auction.script}
          </pre>
        </div>

        <Auction validators={validators} />
      </div>
    </>
  );
}
import {
  ARWEAVE_UPLOAD_ENDPOINT,
  Attribute,
  createAssociatedTokenAccountInstruction,
  createMasterEditionV3,
  createMetadataV2,
  updateMetadataV2,
  createMint,
  Creator,
  ENDPOINT_NAME,
  findProgramAddress,
  getAssetCostToStore,
  notify,
  programIds,
  sendTransactionWithRetry,
  StringPublicKey,
  toPublicKey,
  WalletSigner,
} from '@oyster/common';
import React, { Dispatch, SetStateAction } from 'react';
import { MintLayout, Token } from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import crypto from 'crypto';

import { AR_SOL_HOLDER_ID } from '../utils/ids';
import BN from 'bn.js';
import {
  Collection,
  DataV2,
  Uses,
} from '@metaplex-foundation/mpl-token-metadata';

const RESERVED_TXN_MANIFEST = 'manifest.json';
const RESERVED_METADATA = 'metadata.json';

interface IArweaveResult {
  error?: string;
  messages?: Array<{
    filename: string;
    status: 'success' | 'fail';
    transactionId?: string;
    error?: string;
  }>;
}

const uploadToArweave = async (data: FormData): Promise<IArweaveResult> => {
  const resp = await fetch(ARWEAVE_UPLOAD_ENDPOINT, {
    method: 'POST',
    // @ts-ignore
    body: data,
  });

  if (!resp.ok) {
    return Promise.reject(
      new Error(
        'Unable to upload the artwork to Arweave. Please wait and then try again.',
      ),
    );
  }

  const result: IArweaveResult = await resp.json();

  if (result.error) {
    return Promise.reject(new Error(result.error));
  }

  return result;
};

export const mintNFT = async (
  connection: Connection,
  wallet: WalletSigner | undefined,
  endpoint: ENDPOINT_NAME,
  files: File[],
  metadata: {
    name: string;
    symbol: string;
    description: string;
    image: string | undefined;
    animation_url: string | undefined;
    attributes: Attribute[] | undefined;
    external_url: string;
    properties: any;
    creators: Creator[] | null;
    sellerFeeBasisPoints: number;
    collection?: string;
    uses?: Uses;
  },
  isDynamicCharmanderPokemon: boolean,
  progressCallback: Dispatch<SetStateAction<number>>,
  maxSupply?: number,
): Promise<{
  metadataAccount: StringPublicKey;
} | void> => {
  if (!wallet?.publicKey) return;

  const additionalAttributes: Attribute[] = isDynamicCharmanderPokemon
    ? [
        {
          trait_type: 'isDynamicCharmanderPokemon',
          value: 'true',
          display_type: 'Is Dynamic Charmander Pokemon?',
        },
        {
          trait_type: 'evolutionIndex',
          value: '0',
          display_type: 'Evolution Index',
        },
      ]
    : [];
  const metadataContent = {
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description,
    seller_fee_basis_points: metadata.sellerFeeBasisPoints,
    image: isDynamicCharmanderPokemon
      ? 'https://www.arweave.net/sMmfOCzGXT_rOdBZ8ADCd_I0WtN1S_BZWWZE7eDwwqY?ext=jpeg'
      : metadata.image,
    animation_url: metadata.animation_url,
    attributes: !isDynamicCharmanderPokemon
      ? metadata.attributes
      : [...(metadata.attributes || []), ...additionalAttributes],
    external_url: metadata.external_url,
    properties: {
      ...metadata.properties,
      creators: metadata.creators?.map(creator => {
        return {
          address: creator.address,
          share: creator.share,
        };
      }),
    },
    collection: metadata.collection
      ? new PublicKey(metadata.collection).toBase58()
      : null,
    use: metadata.uses ? metadata.uses : null,
  };

  const realFiles: File[] = [
    ...files,
    new File([JSON.stringify(metadataContent)], RESERVED_METADATA),
  ];

  const { instructions: pushInstructions, signers: pushSigners } =
    await prepPayForFilesTxn(wallet, realFiles);

  progressCallback(1);

  const TOKEN_PROGRAM_ID = programIds().token;

  // Allocate memory for the account
  const mintRent = await connection.getMinimumBalanceForRentExemption(
    MintLayout.span,
  );
  // const accountRent = await connection.getMinimumBalanceForRentExemption(
  //   AccountLayout.span,
  // );

  // This owner is a temporary signer and owner of metadata we use to circumvent requesting signing
  // twice post Arweave. We store in an account (payer) and use it post-Arweave to update MD with new link
  // then give control back to the user.
  // const payer = new Account();
  const payerPublicKey = wallet.publicKey.toBase58();
  const instructions: TransactionInstruction[] = [...pushInstructions];
  const signers: Keypair[] = [...pushSigners];

  // This is only temporarily owned by wallet...transferred to program by createMasterEdition below
  const mintKey = createMint(
    instructions,
    wallet.publicKey,
    mintRent,
    0,
    // Some weird bug with phantom where it's public key doesnt mesh with data encode wellff
    toPublicKey(payerPublicKey),
    toPublicKey(payerPublicKey),
    signers,
  ).toBase58();

  const recipientKey = (
    await findProgramAddress(
      [
        wallet.publicKey.toBuffer(),
        programIds().token.toBuffer(),
        toPublicKey(mintKey).toBuffer(),
      ],
      programIds().associatedToken,
    )
  )[0];

  createAssociatedTokenAccountInstruction(
    instructions,
    toPublicKey(recipientKey),
    wallet.publicKey,
    wallet.publicKey,
    toPublicKey(mintKey),
  );

  const metadataAccount = await createMetadataV2(
    new DataV2({
      symbol: metadata.symbol,
      name: metadata.name,
      uri: ' '.repeat(64), // size of url for arweave
      sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
      creators: metadata.creators,
      collection: metadata.collection
        ? new Collection({
            key: new PublicKey(metadata.collection).toBase58(),
            verified: false,
          })
        : null,
      uses: metadata.uses || null,
    }),
    payerPublicKey,
    mintKey,
    payerPublicKey,
    instructions,
    wallet.publicKey.toBase58(),
  );
  progressCallback(2);

  // TODO: enable when using payer account to avoid 2nd popup
  // const block = await connection.getRecentBlockhash('singleGossip');
  // instructions.push(
  //   SystemProgram.transfer({
  //     fromPubkey: wallet.publicKey,
  //     toPubkey: payerPublicKey,
  //     lamports: 0.5 * LAMPORTS_PER_SOL // block.feeCalculator.lamportsPerSignature * 3 + mintRent, // TODO
  //   }),
  // );

  const { txid } = await sendTransactionWithRetry(
    connection,
    wallet,
    instructions,
    signers,
    'single',
  );
  progressCallback(3);

  try {
    await connection.confirmTransaction(txid, 'max');
    progressCallback(4);
  } catch {
    // ignore
  }

  // Force wait for max confirmations
  // await connection.confirmTransaction(txid, 'max');
  await connection.getParsedConfirmedTransaction(txid, 'confirmed');

  progressCallback(5);

  // this means we're done getting AR txn setup. Ship it off to ARWeave!
  const data = new FormData();
  data.append('transaction', txid);
  data.append('env', endpoint);

  const tags = realFiles.reduce(
    (acc: Record<string, Array<{ name: string; value: string }>>, f) => {
      acc[f.name] = [{ name: 'mint', value: mintKey }];
      return acc;
    },
    {},
  );
  data.append('tags', JSON.stringify(tags));
  realFiles.map(f => data.append('file[]', f));

  // TODO: convert to absolute file name for image

  const result: IArweaveResult = await uploadToArweave(data);
  progressCallback(6);

  const metadataFile = result.messages?.find(
    m => m.filename === RESERVED_TXN_MANIFEST,
  );
  if (metadataFile?.transactionId && wallet.publicKey) {
    const updateInstructions: TransactionInstruction[] = [];
    const updateSigners: Keypair[] = [];

    // TODO: connect to testnet arweave
    const arweaveLink = `https://arweave.net/${metadataFile.transactionId}`;
    await updateMetadataV2(
      new DataV2({
        symbol: metadata.symbol,
        name: metadata.name,
        uri: arweaveLink,
        sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
        creators: metadata.creators,
        collection: metadata.collection
          ? new Collection({
              key: new PublicKey(metadata.collection).toBase58(),
              verified: false,
            })
          : null,
        uses: metadata.uses || null,
      }),
      undefined,
      undefined,
      mintKey,
      payerPublicKey,
      updateInstructions,
      metadataAccount,
    );

    updateInstructions.push(
      Token.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        toPublicKey(mintKey),
        toPublicKey(recipientKey),
        toPublicKey(payerPublicKey),
        [],
        1,
      ),
    );

    progressCallback(7);
    // // In this instruction, mint authority will be removed from the main mint, while
    // // minting authority will be maintained for the Printing mint (which we want.)
    await createMasterEditionV3(
      maxSupply !== undefined ? new BN(maxSupply) : undefined,
      mintKey,
      payerPublicKey,
      payerPublicKey,
      payerPublicKey,
      updateInstructions,
    );

    // TODO: enable when using payer account to avoid 2nd popup
    /*  if (maxSupply !== undefined)
      updateInstructions.push(
        setAuthority({
          target: authTokenAccount,
          currentAuthority: payerPublicKey,
          newAuthority: wallet.publicKey,
          authorityType: 'AccountOwner',
        }),
      );
*/
    // TODO: enable when using payer account to avoid 2nd popup
    // Note with refactoring this needs to switch to the updateMetadataAccount command
    // await transferUpdateAuthority(
    //   metadataAccount,
    //   payerPublicKey,
    //   wallet.publicKey,
    //   updateInstructions,
    // );

    progressCallback(8);

    await sendTransactionWithRetry(
      connection,
      wallet,
      updateInstructions,
      updateSigners,
    );

    notify({
      message: 'Art created on Solana',
      description: (
        <a href={arweaveLink} target="_blank" rel="noopener noreferrer">
          Arweave Link
        </a>
      ),
      type: 'success',
    });

    // TODO: refund funds

    // send transfer back to user
  }
  // TODO:
  // 1. Jordan: --- upload file and metadata to storage API
  // 2. pay for storage by hashing files and attaching memo for each file

  return { metadataAccount };
};

export const evolvePokemonNFT = async (
  connection: Connection,
  wallet: WalletSigner | undefined,
  endpoint: ENDPOINT_NAME,
  metadata: {
    name: string;
    symbol: string;
    description: string;
    image: string | undefined;
    animation_url: string | undefined;
    attributes: Attribute[] | undefined;
    external_url: string;
    properties: any;
    creators: Creator[] | null;
    sellerFeeBasisPoints: number;
    collection?: string;
    uses?: Uses;
  },
  newEvolutionIndex: number,
  mintKey: string,
): Promise<void> => {
  if (!wallet?.publicKey) return;

  const attributes = metadata.attributes ? [...metadata.attributes] : [];
  const evolutionIndex = attributes.findIndex(
    attr => attr.trait_type === 'evolutionIndex',
  );
  if (evolutionIndex && evolutionIndex >= 0) {
    attributes.splice(evolutionIndex, 1);
  }
  const additionalAttributes: Attribute[] = [
    {
      trait_type: 'evolutionIndex',
      value: `${newEvolutionIndex}`,
      display_type: 'Evolution Index',
    },
  ];

  const creators = metadata.properties.creators || metadata.creators?.map(creator => {
    return {
      address: creator.address,
      share: creator.share,
    };
  });

  const newImage =
    newEvolutionIndex === 1
      ? 'https://www.arweave.net/atvajZ1awqRU92UiglTNsVekICktdlycHBltw8mkqvs?ext=jpeg'
      : newEvolutionIndex === 2
      ? 'https://www.arweave.net/feiSpWJbNExeBKpwd5R9KldHP9-2FVqwBEy6YWqjv5o?ext=jpeg'
      : 'https://www.arweave.net/1GREIvzEUePhWrZmrGYuzEc6IuUKiBw6O8l2IvDkz1E?ext=jpeg';
  const metadataContent = {
    name: metadata.name,
    symbol: metadata.symbol,
    description: metadata.description,
    seller_fee_basis_points: metadata.sellerFeeBasisPoints,
    image: newImage,
    animation_url: metadata.animation_url,
    attributes: [...attributes, ...additionalAttributes],
    external_url: metadata.external_url,
    properties: {
      ...metadata.properties,
      creators,
    },
    collection: metadata.collection
      ? new PublicKey(metadata.collection).toBase58()
      : null,
    use: metadata.uses ? metadata.uses : null,
  };

  const realFiles: File[] = [
    new File([JSON.stringify(metadataContent)], RESERVED_METADATA),
  ];

  const { instructions: pushInstructions, signers: pushSigners } =
    await prepPayForFilesTxn(wallet, realFiles);

  const payerPublicKey = wallet.publicKey.toBase58();
  const instructions: TransactionInstruction[] = [...pushInstructions];
  const signers: Keypair[] = [...pushSigners];

  // TODO: enable when using payer account to avoid 2nd popup
  // const block = await connection.getRecentBlockhash('singleGossip');
  // instructions.push(
  //   SystemProgram.transfer({
  //     fromPubkey: wallet.publicKey,
  //     toPubkey: payerPublicKey,
  //     lamports: 0.5 * LAMPORTS_PER_SOL // block.feeCalculator.lamportsPerSignature * 3 + mintRent, // TODO
  //   }),
  // );

  const { txid } = await sendTransactionWithRetry(
    connection,
    wallet,
    instructions,
    signers,
    'single',
  );

  try {
    await connection.confirmTransaction(txid, 'max');
  } catch {
    // ignore
  }

  // Force wait for max confirmations
  // await connection.confirmTransaction(txid, 'max');
  await connection.getParsedConfirmedTransaction(txid, 'confirmed');

  // this means we're done getting AR txn setup. Ship it off to ARWeave!
  const data = new FormData();
  data.append('transaction', txid);
  data.append('env', endpoint);

  const tags = realFiles.reduce(
    (acc: Record<string, Array<{ name: string; value: string }>>, f) => {
      acc[f.name] = [{ name: 'mint', value: mintKey }];
      return acc;
    },
    {},
  );
  data.append('tags', JSON.stringify(tags));
  realFiles.map(f => data.append('file[]', f));

  const result: IArweaveResult = await uploadToArweave(data);

  const metadataFile = result.messages?.find(
    m => m.filename === RESERVED_TXN_MANIFEST,
  );

  if (metadataFile?.transactionId && wallet.publicKey) {
    const updateInstructions: TransactionInstruction[] = [];
    const updateSigners: Keypair[] = [];

    // TODO: connect to testnet arweave
    const arweaveLink = `https://arweave.net/${metadataFile.transactionId}`;
    await updateMetadataV2(
      new DataV2({
        symbol: metadata.symbol,
        name: metadata.name,
        uri: arweaveLink,
        sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
        creators: metadata.creators,
        collection: metadata.collection
          ? new Collection({
              key: new PublicKey(metadata.collection).toBase58(),
              verified: false,
            })
          : null,
        uses: metadata.uses || null,
      }),
      undefined,
      undefined,
      mintKey,
      payerPublicKey,
      updateInstructions,
    );

    await sendTransactionWithRetry(
      connection,
      wallet,
      updateInstructions,
      updateSigners,
    );

    notify({
      message: 'Pokemon evolved!!!',
      description: (
        <a href={arweaveLink} target="_blank" rel="noopener noreferrer">
          Arweave Link
        </a>
      ),
      type: 'success',
    });
  }
};

export const prepPayForFilesTxn = async (
  wallet: WalletSigner,
  files: File[],
): Promise<{
  instructions: TransactionInstruction[];
  signers: Keypair[];
}> => {
  const memo = programIds().memo;

  const instructions: TransactionInstruction[] = [];
  const signers: Keypair[] = [];

  if (wallet.publicKey)
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: AR_SOL_HOLDER_ID,
        lamports: await getAssetCostToStore(files),
      }),
    );

  for (let i = 0; i < files.length; i++) {
    const hashSum = crypto.createHash('sha256');
    hashSum.update(await files[i].text());
    const hex = hashSum.digest('hex');
    instructions.push(
      new TransactionInstruction({
        keys: [],
        programId: memo,
        data: Buffer.from(hex),
      }),
    );
  }

  return {
    instructions,
    signers,
  };
};

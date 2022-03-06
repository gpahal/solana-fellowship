import React, { useState } from 'react';
import {
  Row,
  Col,
  Divider,
  Layout,
  Tag,
  Button,
  Skeleton,
  List,
  Card,
} from 'antd';
import { useParams } from 'react-router-dom';
import { useArt, useExtendedArt } from '../../hooks';

import { ArtContent } from '../../components/ArtContent';
import {
  Attribute, Creator,
  IMetadataExtension,
  shortenAddress,
  useConnection,
  useConnectionConfig, useMeta, useUserAccounts,
} from '@oyster/common';
import { useWallet } from '@solana/wallet-adapter-react';
import { MetaAvatar } from '../../components/MetaAvatar';
import { sendSignMetadata } from '../../actions/sendSignMetadata';
import { ViewOn } from '../../components/ViewOn';
import { ArtType } from '../../types';
import { ArtMinting } from '../../components/ArtMinting';
import { evolvePokemonNFT } from '../../actions';

const { Content } = Layout;

export const ArtView = () => {
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const [remountArtMinting, setRemountArtMinting] = useState(0);
  const [evolving, setEvolving] = useState(false);
  const { pullUserMetadata } = useMeta();
  const { userAccounts, refresh } = useUserAccounts();
  const [refreshIndex, setRefreshIndex] = useState(0);

  const connection = useConnection();
  const { endpoint } = useConnectionConfig();
  const art = useArt(id, refreshIndex);
  let badge = '';
  let maxSupply = '';
  if (art.type === ArtType.NFT) {
    badge = 'Unique';
  } else if (art.type === ArtType.Master) {
    badge = 'NFT 0';
    if (art.maxSupply !== undefined) {
      maxSupply = art.maxSupply.toString();
    } else {
      maxSupply = 'Unlimited';
    }
  } else if (art.type === ArtType.Print) {
    badge = `${art.edition} of ${art.supply}`;
  }
  const { ref, data } = useExtendedArt(id, refreshIndex);

  // const { userAccounts } = useUserAccounts();

  // const accountByMint = userAccounts.reduce((prev, acc) => {
  //   prev.set(acc.info.mint.toBase58(), acc);
  //   return prev;
  // }, new Map<string, TokenAccount>());

  const description = data?.description;
  const attributes = data?.attributes;

  const [isDynamicCharmanderPokemon, evolutionIndex] =
    checkIfDynamicCharmanderPokemon(data);

  const pubkey = wallet?.publicKey?.toBase58() || '';

  const evolvePokemonInner = async () => {
      if (
        !art.mint ||
        !data ||
        !isDynamicCharmanderPokemon ||
        evolutionIndex < 0 ||
        evolutionIndex > 2
      ) {
        return;
      }

      const creators: Array<Creator> | null = art.creators?.map(artist => {
        if (!artist.address || !artist.verified || !artist.share) {
          return null;
        }
        return new Creator({
          address: artist.address,
          verified: artist.verified,
          share: artist.share,
        });
      }).filter(c => c != null) as Array<Creator> || null;

      const metadata = {
        name: data.name,
        symbol: data.symbol,
        creators,
        collection: data.collection,
        description: data.description,
        sellerFeeBasisPoints: data.seller_fee_basis_points,
        image: data.image,
        animation_url: data.animation_url,
        attributes: data.attributes,
        external_url: data.external_url,
        properties: {
          files: data.properties.files,
          category: data.properties?.category,
          creators: data.properties?.creators,
        },
      };

      await evolvePokemonNFT(
        connection,
        wallet,
        endpoint.name,
        metadata,
        evolutionIndex + 1,
        art.mint,
      );
  };

  const evolvePokemon = async (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    try {
      setEvolving(true);
      await evolvePokemonInner();
      refresh();
      await pullUserMetadata(userAccounts);
    } catch (e) {
      console.error(e);
    }
    setEvolving(false);
    setRefreshIndex(i => i + 1);
  };

  const tag = (
    <div className="info-header">
      <Tag color="blue">UNVERIFIED</Tag>
    </div>
  );

  const unverified = (
    <>
      {tag}
      <div style={{ fontSize: 12 }}>
        <i>
          This artwork is still missing verification from{' '}
          {art.creators?.filter(c => !c.verified).length} contributors before it
          can be considered verified and sellable on the platform.
        </i>
      </div>
      <br />
    </>
  );

  return (
    <Content>
      <Col>
        <Row ref={ref}>
          <Col
            xs={{ span: 24 }}
            md={{ span: 12 }}
            style={{ paddingRight: '30px' }}
          >
            <ArtContent
              style={{ width: '100%', height: 'auto', margin: '0 auto' }}
              height={300}
              width={300}
              className="artwork-image"
              pubkey={id}
              active={true}
              allowMeshRender={true}
              artView={true}
            />
          </Col>
          {/* <Divider /> */}
          <Col
            xs={{ span: 24 }}
            md={{ span: 12 }}
            style={{ textAlign: 'left', fontSize: '1.4rem' }}
          >
            <Row>
              <div style={{ fontWeight: 700, fontSize: '4rem' }}>
                {art.title || <Skeleton paragraph={{ rows: 0 }} />}
              </div>
            </Row>
            {isDynamicCharmanderPokemon && evolutionIndex < 3 && (
              <Row>
                <div style={{ marginBottom: '12px' }}>
                  <Button
                    onClick={evolvePokemon}
                    disabled={evolving}
                    style={evolving ? { color: "gray" } : { color: "white" }}
                  >
                    {evolving ? "Evolving Pokemon..." : "Evolve Pokemon"}
                  </Button>
                </div>
              </Row>
            )}
            <Row>
              <Col span={6}>
                <h6>Royalties</h6>
                <div className="royalties">
                  {((art.seller_fee_basis_points || 0) / 100).toFixed(2)}%
                </div>
              </Col>
              <Col span={12}>
                <ViewOn id={id} />
              </Col>
            </Row>
            <Row>
              <Col>
                <h6 style={{ marginTop: 5 }}>Created By</h6>
                <div className="creators">
                  {(art.creators || []).map((creator, idx) => {
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: 5,
                        }}
                      >
                        <MetaAvatar creators={[creator]} size={64} />
                        <div>
                          <span className="creator-name">
                            {creator.name ||
                              shortenAddress(creator.address || '')}
                          </span>
                          <div style={{ marginLeft: 10 }}>
                            {!creator.verified &&
                              (creator.address === pubkey ? (
                                <Button
                                  onClick={async () => {
                                    try {
                                      await sendSignMetadata(
                                        connection,
                                        wallet,
                                        id,
                                      );
                                    } catch (e) {
                                      console.error(e);
                                      return false;
                                    }
                                    return true;
                                  }}
                                >
                                  Approve
                                </Button>
                              ) : (
                                tag
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Col>
            </Row>
            <Row>
              <Col>
                <h6 style={{ marginTop: 5 }}>Edition</h6>
                <div className="art-edition">{badge}</div>
              </Col>
            </Row>
            {art.type === ArtType.Master && (
              <Row>
                <Col>
                  <h6 style={{ marginTop: 5 }}>Max Supply</h6>
                  <div className="art-edition">{maxSupply}</div>
                </Col>
              </Row>
            )}
            {/* <Button
                  onClick={async () => {
                    if(!art.mint) {
                      return;
                    }
                    const mint = new PublicKey(art.mint);

                    const account = accountByMint.get(art.mint);
                    if(!account) {
                      return;
                    }

                    const owner = wallet.publicKey;

                    if(!owner) {
                      return;
                    }
                    const instructions: any[] = [];
                    await updateMetadata(undefined, undefined, true, mint, owner, instructions)

                    sendTransaction(connection, wallet, instructions, [], true);
                  }}
                >
                  Mark as Sold
                </Button> */}

            {/* TODO: Add conversion of MasterEditionV1 to MasterEditionV2 */}
            <ArtMinting
              id={id}
              key={remountArtMinting}
              onMint={async () => await setRemountArtMinting(prev => prev + 1)}
            />
          </Col>
          <Col span="12">
            <Divider />
            {art.creators?.find(c => !c.verified) && unverified}
            <br />
            <div className="info-header">ABOUT THE CREATION</div>
            <div className="info-content">{description}</div>
            <br />
            {/*
              TODO: add info about artist
            <div className="info-header">ABOUT THE CREATOR</div>
            <div className="info-content">{art.about}</div> */}
          </Col>
          <Col span="12">
            {attributes && (
              <>
                <Divider />
                <br />
                <div className="info-header">Attributes</div>
                <List size="large" grid={{ column: 4 }}>
                  {attributes.map(attribute => (
                    <List.Item key={attribute.trait_type}>
                      <Card title={attribute.trait_type}>
                        {attribute.value}
                      </Card>
                    </List.Item>
                  ))}
                </List>
              </>
            )}
          </Col>
        </Row>
      </Col>
    </Content>
  );
};

function checkIfDynamicCharmanderPokemon(
  data?: IMetadataExtension,
): [boolean, number] {
  if (
    !data ||
    !data.attributes ||
    getAttribute(data.attributes, 'isDynamicCharmanderPokemon') !== 'true'
  ) {
    return [false, 0];
  }

  const image = data.image;
  const evolutionIndexStr = getAttribute(data.attributes, 'evolutionIndex');
  if (evolutionIndexStr === '0') {
    if (
      image !==
      'https://www.arweave.net/sMmfOCzGXT_rOdBZ8ADCd_I0WtN1S_BZWWZE7eDwwqY?ext=jpeg'
    ) {
      return [false, 0];
    }
    return [true, 0];
  } else if (evolutionIndexStr === '1') {
    if (
      image !==
      'https://www.arweave.net/atvajZ1awqRU92UiglTNsVekICktdlycHBltw8mkqvs?ext=jpeg'
    ) {
      return [false, 0];
    }
    return [true, 1];
  } else if (evolutionIndexStr === '2') {
    if (
      image !==
      'https://www.arweave.net/feiSpWJbNExeBKpwd5R9KldHP9-2FVqwBEy6YWqjv5o?ext=jpeg'
    ) {
      return [false, 0];
    }
    return [true, 2];
  } else if (evolutionIndexStr === '3') {
    if (
      image !==
      'https://www.arweave.net/1GREIvzEUePhWrZmrGYuzEc6IuUKiBw6O8l2IvDkz1E?ext=jpeg'
    ) {
      return [false, 0];
    }
    return [true, 3];
  }
  return [false, 0];
}

function getAttribute(
  attributes: Attribute[],
  name: string,
): string | undefined {
  return attributes.find(attr => attr.trait_type === name)?.value.toString();
}

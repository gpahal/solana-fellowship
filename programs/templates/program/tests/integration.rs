use {
    template_program::{
        instruction::{CustomInstruction, sample_create},
        processor::Processor,
        state::get_account_key_and_seeds,
    },
    assert_matches::assert_matches,
    solana_program::{
        native_token::LAMPORTS_PER_SOL,
        pubkey::Pubkey,
    },
    solana_sdk::{signature::Signer, transaction::Transaction},
    solana_program_test::{processor, tokio, ProgramTest}
};

#[tokio::test]
async fn test_transaction() {
    let program_id = Pubkey::new_unique();
    let pt = ProgramTest::new(
        "template_program",
        program_id,
        processor!(Processor::process_instruction),
    );

    let (mut banks_client, payer, recent_blockhash) = pt.start().await;

    let (record_account_key, _seeds) =
        get_account_key_and_seeds(&program_id, &payer.pubkey());

    let instruction = sample_create(
        program_id,
        CustomInstruction::SampleCreate { lamports: LAMPORTS_PER_SOL / 10 },
        payer.pubkey(),
        record_account_key,
        payer.pubkey(),
    ).unwrap();
    let mut transaction = Transaction::new_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);

    assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));
}

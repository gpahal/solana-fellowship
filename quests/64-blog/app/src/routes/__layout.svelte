<script>
	import Header from '$lib/header/Header.svelte';
	import '../app.css';

	import { onMount } from 'svelte';
	import { loadAnchorClient } from '$lib/helpers/utils';

	let loaded;

	onMount(async () => {
		// setup some globals
		import('buffer').then((Buffer) => {
			global.Buffer = Buffer.Buffer;
		});

		const Buffer = await import('buffer');
		global.Buffer = Buffer.Buffer;

		await loadAnchorClient();
		loaded = true;
	});
</script>

<svelte:head>
	<script>
		global = globalThis; // for solana web3 repo
	</script>
</svelte:head>
<Header />

<main>
	{#if loaded}
		<slot />
	{:else}
		Loading...
	{/if}
</main>

<style>
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		width: 100%;
		max-width: 1024px;
		margin: 0 auto;
		box-sizing: border-box;
	}

	footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 40px;
	}

	footer a {
		font-weight: bold;
	}

	@media (min-width: 480px) {
		footer {
			padding: 40px 0;
		}
	}
</style>

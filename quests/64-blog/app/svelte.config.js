import sveltePreprocess from 'svelte-preprocess';
// const adapter_ipfs = require('sveltejs-adapter-ipfs');
import vercelAdapter from '@sveltejs/adapter-vercel';
// const path = require('path');
import { mdsvex } from 'mdsvex';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.svx', '.md', '.svelte.md'],
	preprocess: [
		mdsvex({
			extensions: ['.svx', '.md', '.svelte.md'],
			layout: {
				article: 'src/layouts/article.svelte'
			}
		}),
		sveltePreprocess()
	],

	kit: {
		// adapter: adapter_ipfs({
		// 	removeBuiltInServiceWorkerRegistration: true,
		// 	injectPagesInServiceWorker: true
		// }),
		adapter: vercelAdapter({
			outfile: '../build'
		}),
		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte'
		// failed attempt to get Vercel to read a directory outside of this root ./app/ folder :/
		// vite: () => ({
		// 	resolve: {
		// 		alias: {
		// 			$idl: path.resolve('./target/idl/')
		// 		}
		// 	}
		// })
	}
};

export default config;
